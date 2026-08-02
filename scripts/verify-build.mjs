import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const MAX_CHUNK_BYTES = 300_000
export const MAX_BUDGETED_TOTAL_BYTES = 750_000

const REMOTE_URL_PATTERN = /https?:\/\/[^\s"'`<>(),;{}[\]]+/g
const PROTOCOL_RELATIVE_FONTS_PATTERN = /\/\/fonts\.[^\s"'`<>(),;{}[\]]+/g
const REMOTE_DYNAMIC_IMPORT_PATTERN = /import\s*\(\s*(['"`])((?:https?:)?\/\/[^'"`]+)\1\s*\)/g
const ANALYTICS_KEYWORDS = [
  'gtag',
  'google-analytics',
  'googletagmanager',
  'sentry',
  'mixpanel',
  'segment.io',
  'amplitude',
  'hotjar',
  'fullstory',
  'plausible.io',
]
const TEXT_FILE_PATTERN = /\.(?:js|css|html)$/

/**
 * Recursively lists every file under `dir`, returned as `dir`-relative,
 * forward-slash-joined paths (regardless of host OS path separator).
 */
export function listFiles(dir) {
  const results = []

  const walk = (currentDir) => {
    const entries = readdirSync(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)

      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.isFile()) {
        results.push(path.relative(dir, fullPath).split(path.sep).join('/'))
      }
    }
  }

  walk(dir)

  return results.sort((left, right) => left.localeCompare(right))
}

/**
 * Sums the byte size of every file in `files`, EXCLUDING `icons/*.png` --
 * those PNG icons are required by the Chrome Web Store and are explicitly
 * excluded from the aggregate budget per the release plan.
 */
export function sumBudgetedBytes(files, dir) {
  let total = 0

  for (const file of files) {
    if (isBudgetExcludedIcon(file)) {
      continue
    }

    total += statSync(path.join(dir, file)).size
  }

  return total
}

function isBudgetExcludedIcon(file) {
  return file.startsWith('icons/') && file.endsWith('.png')
}

/**
 * Scans every `.js`/`.css`/`.html` file's text content for remote references
 * the extension should never bake in: http(s):// literals, protocol-relative
 * `//fonts.` references, analytics-style imports, and remote dynamic
 * `import(...)` calls. Any exact literal present in `allowlist` (an array of
 * `{ literal, reason }`) is skipped.
 *
 * Returns the list of violations (not just a boolean) so callers/tests can
 * assert on specifics: `{ file, literal, line, context, kind }`.
 */
export function findRemoteReferences(files, dir, allowlist = []) {
  const allowedLiterals = new Set(allowlist.map((entry) => entry.literal))
  const violations = []

  const textFiles = files.filter((file) => TEXT_FILE_PATTERN.test(file))

  for (const file of textFiles) {
    const content = readFileSync(path.join(dir, file), 'utf8')

    // A remote-URL-shaped match (http(s)://, //fonts., or a dynamic
    // import() target) that also contains a known analytics keyword is
    // reported as the more specific 'analytics-import' kind. This is
    // narrower than scanning the whole file for bare keyword occurrences
    // (e.g. "sentry" inside a CSS class name or a code comment, neither of
    // which is a remote reference at all) -- and it keeps the allowlist
    // meaningful, since an allowlisted keyword can no longer silently
    // suppress an unrelated, genuinely remote analytics URL that happens
    // not to contain it.
    const classifyKind = (literal, defaultKind) => {
      const lowerLiteral = literal.toLowerCase()
      const isAnalytics = ANALYTICS_KEYWORDS.some((keyword) =>
        lowerLiteral.includes(keyword.toLowerCase()),
      )

      return isAnalytics ? 'analytics-import' : defaultKind
    }

    collectPatternMatches({
      violations,
      file,
      content,
      pattern: REMOTE_URL_PATTERN,
      kind: 'remote-url',
      allowedLiterals,
      literalFromMatch: (match) => match[0],
      classifyKind,
    })

    collectPatternMatches({
      violations,
      file,
      content,
      pattern: PROTOCOL_RELATIVE_FONTS_PATTERN,
      kind: 'protocol-relative-fonts',
      allowedLiterals,
      literalFromMatch: (match) => match[0],
      classifyKind,
    })

    collectPatternMatches({
      violations,
      file,
      content,
      pattern: REMOTE_DYNAMIC_IMPORT_PATTERN,
      kind: 'remote-dynamic-import',
      allowedLiterals,
      literalFromMatch: (match) => match[2],
      classifyKind,
    })
  }

  return violations
}

function collectPatternMatches({
  violations,
  file,
  content,
  pattern,
  kind,
  allowedLiterals,
  literalFromMatch,
  classifyKind,
}) {
  for (const match of content.matchAll(pattern)) {
    const literal = literalFromMatch(match)

    if (allowedLiterals.has(literal)) {
      continue
    }

    const resolvedKind = classifyKind ? classifyKind(literal, kind) : kind

    violations.push(
      buildViolation({ file, content, index: match.index, literal, kind: resolvedKind }),
    )
  }
}

function buildViolation({ file, content, index, literal, kind }) {
  const upToMatch = content.slice(0, index)
  const line = upToMatch.split('\n').length
  const contextStart = Math.max(0, index - 30)
  const contextEnd = Math.min(content.length, index + literal.length + 30)
  const context = content.slice(contextStart, contextEnd)

  return { file, literal, line, context, kind }
}

function defaultAllowlistPath() {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), 'remote-reference-allowlist.json')
}

function loadAllowlist(allowlistPath) {
  const raw = readFileSync(allowlistPath, 'utf8')
  const parsed = JSON.parse(raw)

  if (!Array.isArray(parsed)) {
    throw new Error(`Remote reference allowlist at ${allowlistPath} must be a JSON array`)
  }

  return parsed
}

/**
 * Orchestrates the full release budget check against a built `dist/`-style
 * directory: manifest + icons present, no source maps, no oversized JS
 * chunk, the aggregate budgeted size under budget, and no unallowlisted
 * remote references. Throws with a message identifying exactly which budget
 * failed (and by how much) on the first failure; prints measured sizes to
 * stdout on success.
 */
export function assertBuild(distDir, options = {}) {
  const allowlist =
    options.allowlist ?? loadAllowlist(options.allowlistPath ?? defaultAllowlistPath())

  const files = listFiles(distDir)

  const manifestRelativePath = 'manifest.json'
  if (!files.includes(manifestRelativePath)) {
    throw new Error(`Build verification failed: ${manifestRelativePath} is missing from ${distDir}`)
  }

  const manifest = JSON.parse(readFileSync(path.join(distDir, manifestRelativePath), 'utf8'))
  const iconPaths = Object.values(manifest.icons ?? {})

  if (iconPaths.length === 0) {
    throw new Error('Build verification failed: manifest.json declares no icons')
  }

  for (const iconPath of iconPaths) {
    if (!files.includes(iconPath)) {
      throw new Error(
        `Build verification failed: icon "${iconPath}" declared in manifest.json is missing from the build`,
      )
    }
  }

  const mapFiles = files.filter((file) => file.endsWith('.map'))
  if (mapFiles.length > 0) {
    throw new Error(
      `Build verification failed: source map(s) present in the build: ${mapFiles.join(', ')}`,
    )
  }

  const jsFiles = files.filter((file) => file.endsWith('.js'))
  const chunkSizes = jsFiles.map((file) => ({
    file,
    bytes: statSync(path.join(distDir, file)).size,
  }))

  for (const chunk of chunkSizes) {
    if (chunk.bytes > MAX_CHUNK_BYTES) {
      throw new Error(
        `Build verification failed: JS chunk "${chunk.file}" is ${chunk.bytes} bytes, ` +
          `${chunk.bytes - MAX_CHUNK_BYTES} bytes over the ${MAX_CHUNK_BYTES}-byte per-chunk budget`,
      )
    }
  }

  const budgetedTotal = sumBudgetedBytes(files, distDir)
  if (budgetedTotal > MAX_BUDGETED_TOTAL_BYTES) {
    throw new Error(
      `Build verification failed: budgeted total is ${budgetedTotal} bytes, ` +
        `${budgetedTotal - MAX_BUDGETED_TOTAL_BYTES} bytes over the ${MAX_BUDGETED_TOTAL_BYTES}-byte aggregate budget`,
    )
  }

  const violations = findRemoteReferences(files, distDir, allowlist)
  if (violations.length > 0) {
    const details = violations
      .map(
        (violation) =>
          `  - [${violation.kind}] ${violation.file}:${violation.line} -> ${violation.literal}`,
      )
      .join('\n')

    throw new Error(
      `Build verification failed: ${violations.length} unallowlisted remote reference(s) found:\n${details}`,
    )
  }

  console.log('Build verification passed.')
  console.log(`Budgeted total: ${budgetedTotal} / ${MAX_BUDGETED_TOTAL_BYTES} bytes`)
  console.log('JS chunk sizes:')
  for (const chunk of chunkSizes.sort((left, right) => right.bytes - left.bytes)) {
    console.log(`  ${chunk.file}: ${chunk.bytes} / ${MAX_CHUNK_BYTES} bytes`)
  }

  return { budgetedTotal, chunkSizes }
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]

if (isMainModule) {
  const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')

  try {
    assertBuild(distDir)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
