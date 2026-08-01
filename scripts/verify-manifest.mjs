import { readFile } from 'node:fs/promises'

const manifestPath = new URL('../dist/manifest.json', import.meta.url)
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Manifest assertion failed: ${message}`)
  }
}

assert(manifest.manifest_version === 3, 'manifest_version must be 3')
assert(manifest.minimum_chrome_version === '102', "minimum_chrome_version must be '102'")
assert(manifest.action?.default_popup === 'index.html', "action.default_popup must be 'index.html'")

const expectedPermissions = ['clipboardWrite', 'storage', 'tabGroups', 'tabs']
const permissions = [...(manifest.permissions ?? [])].sort((left, right) =>
  left.localeCompare(right),
)
assert(
  JSON.stringify(permissions) === JSON.stringify(expectedPermissions),
  `permissions must equal ${JSON.stringify(expectedPermissions)}`,
)

assert(!('host_permissions' in manifest), 'host_permissions must be absent')
assert(!('background' in manifest), 'background must be absent')
assert(!('content_scripts' in manifest), 'content_scripts must be absent')
