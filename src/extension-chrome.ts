import type { SettingsStorageArea } from './shared/settings/settings-repository'

export interface ExtensionChrome {
  storage: {
    local: SettingsStorageArea
  }
}

export function getExtensionChrome(): ExtensionChrome {
  const chrome = (globalThis as typeof globalThis & { chrome?: unknown }).chrome

  if (!isExtensionChrome(chrome)) {
    throw new Error(
      'Chrome extension storage API is unavailable. This app must run as a Chrome extension.',
    )
  }

  return chrome
}

function isExtensionChrome(value: unknown): value is ExtensionChrome {
  if (!value || typeof value !== 'object') {
    return false
  }

  const storage = (value as { storage?: unknown }).storage

  if (!storage || typeof storage !== 'object') {
    return false
  }

  const local = (storage as { local?: unknown }).local

  return Boolean(
    local &&
    typeof local === 'object' &&
    typeof (local as Partial<SettingsStorageArea>).get === 'function' &&
    typeof (local as Partial<SettingsStorageArea>).set === 'function' &&
    typeof (local as Partial<SettingsStorageArea>).remove === 'function',
  )
}
