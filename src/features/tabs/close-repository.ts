import type { TabDescriptor } from '../../domain/browser'

const storageKey = 'lastClosedTabs'

export interface CloseSnapshot {
  closedAt: number
  tabs: Array<TabDescriptor & { windowId: number; index: number }>
}

/**
 * Mirrors SettingsStorageArea's shape but is kept separate so this module
 * doesn't depend on the settings feature — this repository is backed by
 * chrome.storage.session, not chrome.storage.local.
 */
export interface SessionStorageArea {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  remove(keys: string | string[]): Promise<void>
}

export interface CloseRepository {
  load(): Promise<CloseSnapshot | null>
  save(snapshot: CloseSnapshot): Promise<void>
  clear(): Promise<void>
}

export function createCloseRepository(storage: SessionStorageArea): CloseRepository {
  return {
    async load() {
      const stored = await storage.get(storageKey)
      const value = stored[storageKey]

      return isCloseSnapshot(value) ? value : null
    },
    async save(snapshot) {
      await storage.set({ [storageKey]: snapshot })
    },
    async clear() {
      await storage.remove(storageKey)
    },
  }
}

function isCloseSnapshot(value: unknown): value is CloseSnapshot {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Partial<CloseSnapshot>

  return typeof candidate.closedAt === 'number' && Array.isArray(candidate.tabs)
}
