import { vi } from 'vitest'
import type { TabRecord, TabSnapshot } from '../domain/browser'
import type { Workspace } from '../features/workspaces/workspace'
import type { Settings } from '../shared/settings/settings'
import type { SettingsStorageArea } from '../shared/settings/settings-repository'

/**
 * Shared data builders for tests that need real TabRecord/TabSnapshot/
 * Workspace shapes -- consolidating the near-identical `createTab`/
 * `createSnapshot`/`createStoredWorkspace` helpers that otherwise get
 * hand-rolled per test file (see e.g. App.test.tsx, TabsView.test.tsx,
 * SelectionDock.test.tsx, workspaces-provider.test.tsx). Kept intentionally
 * small: only what tab-toolkit.integration.test.tsx itself needs, not a
 * speculative do-everything fixture module.
 */

export function createTab(
  overrides: Partial<TabRecord> & Pick<TabRecord, 'id' | 'windowId'>,
): TabRecord {
  return {
    index: 0,
    title: 'Untitled tab',
    url: 'https://example.com/',
    domain: 'example.com',
    faviconUrl: null,
    pinned: false,
    muted: false,
    audible: false,
    active: false,
    discarded: false,
    groupId: null,
    ...overrides,
  }
}

export function createSnapshot(overrides: Partial<TabSnapshot> = {}): TabSnapshot {
  return {
    tabs: [],
    groups: [],
    currentWindowId: 1,
    capturedAt: 1,
    ...overrides,
  }
}

export function createWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'ws-1',
    name: 'Research',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    tabs: [{ url: 'https://example.com/', title: 'Example', pinned: false }],
    ...overrides,
  }
}

/**
 * A settings-shaped storage area returning fixed settings, for App's
 * required `repository` prop. Defaults to `theme: 'light'` deliberately --
 * `'system'` would make SettingsProvider call `window.matchMedia`, which
 * jsdom doesn't implement unless a test explicitly stubs it (see
 * App.test.tsx's `createMediaQueryList`); tests using this fixture shouldn't
 * need to care about that unless they're specifically testing theme.
 */
export function createSettingsStorage(overrides: Partial<Settings> = {}): SettingsStorageArea {
  const settings: Settings = {
    theme: 'light',
    scope: 'current',
    copyFormat: 'markdown',
    ...overrides,
  }

  return {
    async get() {
      return { settings }
    },
    async set() {},
    async remove() {},
  }
}

/**
 * A minimal in-memory implementation of the `{ get, set, remove }` storage
 * shape shared by CloseRepository's SessionStorageArea and
 * WorkspaceRepository's WorkspaceStorageArea -- lets a test wrap the REAL
 * `createCloseRepository`/`createWorkspaceRepository` factories around a
 * fake backing store instead of hand-mocking `load`/`save`/`put`/`delete`,
 * so the repository's actual read/write/validate logic runs for real.
 */
export function createInMemoryStorageArea(): {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  remove(keys: string | string[]): Promise<void>
} {
  const store = new Map<string, unknown>()

  return {
    get: vi.fn(async (keys?: string | string[] | Record<string, unknown> | null) => {
      if (keys === undefined || keys === null) {
        return Object.fromEntries(store)
      }

      const requested = Array.isArray(keys)
        ? keys
        : typeof keys === 'string'
          ? [keys]
          : Object.keys(keys)
      const result: Record<string, unknown> = {}

      for (const key of requested) {
        if (store.has(key)) {
          result[key] = store.get(key)
        }
      }

      return result
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) {
        store.set(key, value)
      }
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        store.delete(key)
      }
    }),
  }
}
