import { normalizeSettings } from './settings'
import type { Settings } from './settings'

const storageKey = 'settings'

export interface SettingsStorageArea {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  remove(keys: string | string[]): Promise<void>
}

export interface SettingsRepository {
  load(): Promise<Settings>
  save(settings: Settings): Promise<void>
  reset(): Promise<void>
}

export function createSettingsRepository(storage: SettingsStorageArea): SettingsRepository {
  return {
    async load() {
      const stored = await storage.get(storageKey)
      return normalizeSettings(stored.settings)
    },
    async save(settings) {
      await storage.set({ [storageKey]: settings })
    },
    async reset() {
      await storage.remove(storageKey)
    },
  }
}
