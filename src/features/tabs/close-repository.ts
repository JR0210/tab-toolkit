import type { TabDescriptor, TabGroupColor } from '../../domain/browser'

const GROUP_COLORS: ReadonlySet<TabGroupColor> = new Set([
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
])

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

/**
 * Default CloseRepository backed by the real chrome.storage.session area.
 * Resolves the chrome API lazily (per call) rather than at construction
 * time, so it's safe to use as a default parameter value even when
 * constructed outside a real extension (e.g. by a component that only
 * conditionally needs it) — the resulting rejection surfaces from load/save/
 * clear, not from calling this factory itself.
 */
export function createChromeCloseRepository(): CloseRepository {
  return createCloseRepository({
    get: (keys) => getChromeSessionStorage().get(keys),
    set: (items) => getChromeSessionStorage().set(items),
    remove: (keys) => getChromeSessionStorage().remove(keys),
  })
}

function getChromeSessionStorage(): SessionStorageArea {
  const chrome = (globalThis as typeof globalThis & { chrome?: unknown }).chrome

  if (!chrome || typeof chrome !== 'object') {
    throw new Error(
      'Chrome session storage is unavailable. This app must run as a Chrome extension.',
    )
  }

  const storage = (chrome as { storage?: { session?: SessionStorageArea } }).storage?.session

  if (!storage) {
    throw new Error(
      'Chrome session storage is unavailable. This app must run as a Chrome extension.',
    )
  }

  return storage
}

function isCloseSnapshot(value: unknown): value is CloseSnapshot {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Partial<CloseSnapshot>

  return (
    typeof candidate.closedAt === 'number' &&
    Array.isArray(candidate.tabs) &&
    candidate.tabs.every(isDescriptorEntry)
  )
}

function isDescriptorEntry(value: unknown): value is CloseSnapshot['tabs'][number] {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Partial<CloseSnapshot['tabs'][number]>

  return (
    typeof candidate.url === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.pinned === 'boolean' &&
    typeof candidate.windowId === 'number' &&
    typeof candidate.index === 'number' &&
    (candidate.group === undefined || isGroupDescriptor(candidate.group))
  )
}

function isGroupDescriptor(value: unknown): value is NonNullable<TabDescriptor['group']> {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Partial<NonNullable<TabDescriptor['group']>>

  return (
    typeof candidate.title === 'string' &&
    typeof candidate.color === 'string' &&
    GROUP_COLORS.has(candidate.color as TabGroupColor)
  )
}
