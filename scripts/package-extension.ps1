<#
.SYNOPSIS
    Builds and packages the Tab Toolkit Chrome extension into a reproducible,
    versioned Chrome Web Store ZIP.

.DESCRIPTION
    Runs the full release verification gate (npm run verify:release --
    lint/typecheck, the Vitest suite, the production build, the manifest
    checks, and the bundle/remote-reference budget checks) and refuses to
    package an unverified build. Reads the version out of the freshly built
    dist/manifest.json, zips the CONTENTS of dist/ (not the dist folder
    itself, so manifest.json/index.html/etc. sit at the archive root) into
    release/tab-toolkit-<version>.zip, and self-checks the resulting archive
    doesn't contain source maps, a nested dist/ prefix, or anything that
    looks like source/test/node_modules content.

    Only an exact-same-version pre-existing ZIP in release/ is removed
    before packaging -- other version ZIPs in release/, if any, are left
    alone.
#>

$ErrorActionPreference = 'Stop'

function Fail([string]$Message) {
    Write-Error $Message
    exit 1
}

try {
    # Resolve everything relative to this script's own location, not the
    # caller's working directory.
    $repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
    $distDir = Join-Path $repoRoot 'dist'
    $releaseDir = Join-Path $repoRoot 'release'

    Write-Host "Repository root: $repoRoot"

    Write-Host "`nRunning npm run verify:release ..."
    Push-Location $repoRoot
    try {
        & npm run verify:release
        $verifyExitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }

    if ($verifyExitCode -ne 0) {
        Fail "npm run verify:release failed (exit code $verifyExitCode) -- refusing to package an unverified build."
    }

    if (-not (Test-Path $distDir)) {
        Fail "dist/ does not exist at $distDir even after verify:release succeeded."
    }

    $manifestPath = Join-Path $distDir 'manifest.json'
    if (-not (Test-Path $manifestPath)) {
        Fail "dist/manifest.json is missing at $manifestPath."
    }

    $manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
    $version = $manifest.version

    if ([string]::IsNullOrWhiteSpace($version)) {
        Fail 'dist/manifest.json has no version field.'
    }

    Write-Host "Packaging version: $version"

    New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

    $zipName = "tab-toolkit-$version.zip"
    $zipPath = Join-Path $releaseDir $zipName

    # Remove ONLY an exact-same-version pre-existing archive -- other
    # version ZIPs already in release/ are left alone.
    if (Test-Path $zipPath) {
        Write-Host "Removing pre-existing $zipName ..."
        Remove-Item -Force -Path $zipPath
    }

    # Zip the CONTENTS of dist/ (not the dist folder itself, so
    # manifest.json/index.html/etc. sit at the archive root). Built by hand
    # via System.IO.Compression.ZipArchive rather than Compress-Archive:
    # Windows PowerShell 5.1's Compress-Archive (this script is deliberately
    # invoked via `powershell`, not `pwsh`) writes entry names with backslash
    # path separators, which violates the ZIP spec and risks a Chrome/other
    # zip reader failing to resolve nested paths like "assets/index.js" --
    # building the archive directly guarantees forward-slash entry names
    # regardless of PowerShell edition or OS.
    Write-Host "Compressing $distDir contents into $zipPath ..."
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem

    $distDirFullName = (Resolve-Path $distDir).Path
    $zipStream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create)
    try {
        $zipArchive = New-Object System.IO.Compression.ZipArchive(
            $zipStream,
            [System.IO.Compression.ZipArchiveMode]::Create)
        try {
            $files = Get-ChildItem -Path $distDirFullName -Recurse -File
            foreach ($file in $files) {
                $relativePath = $file.FullName.Substring($distDirFullName.Length + 1) -replace '\\', '/'
                $entry = $zipArchive.CreateEntry($relativePath, [System.IO.Compression.CompressionLevel]::Optimal)
                $entryStream = $entry.Open()
                try {
                    $fileStream = [System.IO.File]::OpenRead($file.FullName)
                    try {
                        $fileStream.CopyTo($entryStream)
                    } finally {
                        $fileStream.Dispose()
                    }
                } finally {
                    $entryStream.Dispose()
                }
            }
        } finally {
            $zipArchive.Dispose()
        }
    } finally {
        $zipStream.Dispose()
    }

    if (-not (Test-Path $zipPath)) {
        Fail "Archive creation did not produce $zipPath."
    }

    # Self-check: verify the archive's own entries before declaring success.
    Write-Host "`nVerifying archive contents ..."
    $archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        $entries = $archive.Entries | ForEach-Object { $_.FullName }
    } finally {
        $archive.Dispose()
    }

    if ($entries.Count -eq 0) {
        Fail "$zipName contains no entries."
    }

    $violations = @()
    foreach ($entry in $entries) {
        if ($entry -match '\\') {
            $violations += "'$entry' uses a backslash path separator instead of '/'"
        }

        $normalized = $entry -replace '\\', '/'

        if ($normalized -match '^dist/') {
            $violations += "'$entry' is nested under a dist/ prefix"
        } elseif ($normalized -match '\.map$') {
            $violations += "'$entry' is a source map"
        } elseif ($normalized -match '(^|/)src/') {
            $violations += "'$entry' looks like it came from src/"
        } elseif ($normalized -match '(^|/)node_modules/') {
            $violations += "'$entry' looks like it came from node_modules/"
        } elseif ($normalized -match '\.test\.|\.spec\.|(^|/)tests?/') {
            $violations += "'$entry' looks like a test file"
        }
    }

    if ($violations.Count -gt 0) {
        $details = $violations -join "`n  - "
        Fail "$zipName failed self-check:`n  - $details"
    }

    Write-Host "Archive verified: $($entries.Count) entries, none unapproved."
    Write-Host "`nCreated $zipPath"
    foreach ($entry in $entries | Sort-Object) {
        Write-Host "  $entry"
    }

    exit 0
} catch {
    Write-Error $_
    exit 1
}
