import { afterEach, describe, expect, it, vi } from 'vitest'
import { getExtensionChrome } from './extension-chrome'
import type { SettingsStorageArea } from './shared/settings/settings-repository'

describe('getExtensionChrome', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns Chrome storage when the extension API is available', () => {
    // Catches a runtime-boundary helper that rejects a valid extension API or
    // returns a different dependency than the one Chrome provides.
    const storage = createStorage()
    vi.stubGlobal('chrome', { storage: { local: storage } })

    expect(getExtensionChrome().storage.local).toBe(storage)
  })

  it('throws an intentional error when Chrome local storage is unavailable', () => {
    // Catches an unguarded runtime dereference that leaks an opaque TypeError
    // outside the Chrome-extension environment.
    vi.stubGlobal('chrome', undefined)

    expect(() => getExtensionChrome()).toThrow(
      'Chrome extension storage API is unavailable. This app must run as a Chrome extension.',
    )
  })

  it('throws an intentional error when Chrome local storage is incomplete', () => {
    // Catches a truthy storage object that lacks the methods required by the
    // settings repository and would otherwise fail later with a TypeError.
    vi.stubGlobal('chrome', { storage: { local: {} } })

    expect(() => getExtensionChrome()).toThrow(
      'Chrome extension storage API is unavailable. This app must run as a Chrome extension.',
    )
  })
})

function createStorage(): SettingsStorageArea {
  return {
    async get() {
      return {}
    },
    async set() {},
    async remove() {},
  }
}
