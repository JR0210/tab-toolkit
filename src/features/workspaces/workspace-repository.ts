import { validateWorkspace } from './workspace'
import type { Workspace } from './workspace'

const storageKey = 'workspaces'

/**
 * Mirrors SettingsStorageArea's shape but is kept separate so this module
 * doesn't depend on the settings feature -- same precedent as
 * close-repository.ts's SessionStorageArea, even though the shape is
 * identical, to avoid coupling unrelated features together.
 */
export interface WorkspaceStorageArea {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  remove(keys: string | string[]): Promise<void>
}

export interface WorkspaceListResult {
  workspaces: Workspace[]
  skippedCount: number
}

export interface WorkspaceRepository {
  list(): Promise<WorkspaceListResult>
  put(workspace: Workspace): Promise<void>
  delete(id: string): Promise<void>
  replaceAll(workspaces: Workspace[]): Promise<void>
}

export function createWorkspaceRepository(storage: WorkspaceStorageArea): WorkspaceRepository {
  async function readAll(): Promise<WorkspaceListResult> {
    const stored = await storage.get(storageKey)
    const raw = stored[storageKey]
    const rawArray = Array.isArray(raw) ? raw : []

    const workspaces: Workspace[] = []
    let skippedCount = 0

    for (const entry of rawArray) {
      const workspace = validateWorkspace(entry)

      if (workspace) {
        workspaces.push(workspace)
      } else {
        skippedCount += 1
      }
    }

    return { workspaces, skippedCount }
  }

  async function writeAll(workspaces: Workspace[]): Promise<void> {
    const sorted = [...workspaces].sort((left, right) => {
      if (left.updatedAt === right.updatedAt) {
        return 0
      }

      return left.updatedAt < right.updatedAt ? 1 : -1
    })

    await storage.set({ [storageKey]: sorted })
  }

  // put/delete/replaceAll are each a read-modify-write of the full array, so
  // two concurrent calls (e.g. renaming one workspace while deleting another
  // -- each WorkspaceCard tracks its own pending state, so both can be
  // in flight at once) would otherwise both read the same base state and the
  // later write would silently clobber the earlier one. Chaining every
  // mutation onto this promise serializes them, mirroring SettingsProvider's
  // saveChain.
  let chain: Promise<unknown> = Promise.resolve()

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = chain.then(operation)
    chain = result.catch(() => undefined)
    return result
  }

  return {
    list: readAll,
    put(workspace) {
      return enqueue(async () => {
        const { workspaces } = await readAll()
        const index = workspaces.findIndex((existing) => existing.id === workspace.id)

        if (index === -1) {
          workspaces.push(workspace)
        } else {
          workspaces[index] = workspace
        }

        await writeAll(workspaces)
      })
    },
    delete(id) {
      return enqueue(async () => {
        const { workspaces } = await readAll()

        await writeAll(workspaces.filter((workspace) => workspace.id !== id))
      })
    },
    replaceAll(workspaces) {
      return enqueue(() => writeAll(workspaces))
    },
  }
}

/**
 * Default WorkspaceRepository backed by the real chrome.storage.local area.
 * Resolves the chrome API lazily (per call) rather than at construction
 * time, so it's safe to use as a default parameter value even when
 * constructed outside a real extension -- the resulting rejection surfaces
 * from list/put/delete/replaceAll, not from calling this factory itself.
 */
export function createChromeWorkspaceRepository(): WorkspaceRepository {
  return createWorkspaceRepository({
    get: (keys) => getChromeLocalStorage().get(keys),
    set: (items) => getChromeLocalStorage().set(items),
    remove: (keys) => getChromeLocalStorage().remove(keys),
  })
}

function getChromeLocalStorage(): WorkspaceStorageArea {
  const chrome = (globalThis as typeof globalThis & { chrome?: unknown }).chrome

  if (!chrome || typeof chrome !== 'object') {
    throw new Error('Chrome local storage is unavailable. This app must run as a Chrome extension.')
  }

  const storage = (chrome as { storage?: { local?: WorkspaceStorageArea } }).storage?.local

  if (!storage) {
    throw new Error('Chrome local storage is unavailable. This app must run as a Chrome extension.')
  }

  return storage
}
