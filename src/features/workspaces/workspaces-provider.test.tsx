import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TabRecord, TabSnapshot } from '../../domain/browser'
import { SettingsContext } from '../../shared/settings/settings-context'
import type { SettingsContextValue } from '../../shared/settings/settings-context'
import { Toaster } from '../../shared/ui/toaster'
import { TabsContext } from '../tabs/tabs-context'
import type { TabsContextValue } from '../tabs/tabs-context'
import { useWorkspaces } from './use-workspaces'
import type { Workspace } from './workspace'
import { WorkspacesProvider } from './workspaces-provider'
import type { WorkspaceRepository } from './workspace-repository'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('WorkspacesProvider', () => {
  it('saves the current window as a new, complete workspace via repository.put', async () => {
    const user = userEvent.setup()
    const put = vi.fn().mockResolvedValue(undefined)
    const repository = createRepository({ put })
    const snapshot = createSnapshot()

    renderProvider({ repository, snapshot })

    await user.click(screen.getByRole('button', { name: 'Save current window' }))

    await waitFor(() => expect(put).toHaveBeenCalled())
    const [saved] = put.mock.calls[0] as [Workspace]

    expect(typeof saved.id).toBe('string')
    expect(saved.id.length).toBeGreaterThan(0)
    expect(saved.name).toBe('Research')
    expect(typeof saved.createdAt).toBe('string')
    expect(typeof saved.updatedAt).toBe('string')
    expect(saved.tabs).toEqual([
      { url: 'https://a.example.com/', title: 'Tab A', pinned: false },
      { url: 'https://b.example.com/', title: 'Tab B', pinned: false },
    ])
  })

  it('reports skipped tabs in the save toast when some tabs cannot be restored', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    const snapshot: TabSnapshot = {
      tabs: [
        createTab({ id: 1, windowId: 1, index: 0, url: 'https://a.example.com/', title: 'Tab A' }),
        createTab({ id: 2, windowId: 1, index: 1, url: 'https://b.example.com/', title: 'Tab B' }),
        createTab({ id: 3, windowId: 1, index: 2, url: 'chrome://extensions', title: 'Extensions' }),
      ],
      groups: [],
      currentWindowId: 1,
      capturedAt: 0,
    }

    renderProvider({ repository, snapshot })

    await user.click(screen.getByRole('button', { name: 'Save current window' }))

    expect(
      await screen.findByText('Saved 2 tabs; 1 tabs could not be restored and were omitted.'),
    ).toBeVisible()
  })

  it('shows a plain success toast when nothing was skipped', async () => {
    const user = userEvent.setup()
    const repository = createRepository()

    renderProvider({ repository, snapshot: createSnapshot() })

    await user.click(screen.getByRole('button', { name: 'Save current window' }))

    expect(await screen.findByText('Saved 2 tabs')).toBeVisible()
  })

  it('fails outright with no saved workspace when zero tabs in the window are restorable', async () => {
    const user = userEvent.setup()
    const put = vi.fn().mockResolvedValue(undefined)
    const repository = createRepository({ put })
    const snapshot: TabSnapshot = {
      tabs: [createTab({ id: 1, windowId: 1, index: 0, url: 'chrome://extensions' })],
      groups: [],
      currentWindowId: 1,
      capturedAt: 0,
    }

    renderProvider({ repository, snapshot })

    await user.click(screen.getByRole('button', { name: 'Save current window' }))

    expect(await screen.findByText('No tabs in this window could be saved.')).toBeVisible()
    expect(put).not.toHaveBeenCalled()
  })

  it('renames a workspace: updatedAt changes while createdAt and tabs are preserved', async () => {
    const user = userEvent.setup()
    const existing = createStoredWorkspace()
    const put = vi.fn().mockResolvedValue(undefined)
    const repository = createRepository({
      list: vi.fn().mockResolvedValue({ workspaces: [existing], skippedCount: 0 }),
      put,
    })

    renderProvider({ repository, snapshot: createSnapshot() })
    expect(await screen.findByText('Research')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Rename' }))

    await waitFor(() => expect(put).toHaveBeenCalled())
    const [saved] = put.mock.calls[0] as [Workspace]

    expect(saved.id).toBe(existing.id)
    expect(saved.name).toBe('Renamed')
    expect(saved.createdAt).toBe(existing.createdAt)
    expect(saved.tabs).toEqual(existing.tabs)
    expect(saved.updatedAt).not.toBe(existing.updatedAt)
  })

  it('deletes from storage before removing the workspace from the UI (write-before-report)', async () => {
    const user = userEvent.setup()
    const existing = createStoredWorkspace()
    const deleteDeferred = createDeferred<void>()
    let deleted = false
    const list = vi.fn().mockImplementation(() =>
      Promise.resolve({ workspaces: deleted ? [] : [existing], skippedCount: 0 }),
    )
    const del = vi.fn().mockImplementation(() => deleteDeferred.promise)
    const repository = createRepository({ list, delete: del })

    renderProvider({ repository, snapshot: createSnapshot() })
    expect(await screen.findByText('Research')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(del).toHaveBeenCalledExactlyOnceWith(existing.id)
    // Storage delete hasn't resolved yet -- the UI must still show the workspace.
    expect(screen.getByText('Research')).toBeVisible()

    deleted = true
    deleteDeferred.resolve()

    await waitFor(() => expect(screen.queryByText('Research')).not.toBeInTheDocument())
  })

  it('undoDelete restores the exact deleted record via repository.put', async () => {
    const user = userEvent.setup()
    const existing = createStoredWorkspace()
    const put = vi.fn().mockResolvedValue(undefined)
    let deleted = false
    const list = vi.fn().mockImplementation(() =>
      Promise.resolve({ workspaces: deleted ? [] : [existing], skippedCount: 0 }),
    )
    const del = vi.fn().mockImplementation(() => {
      deleted = true
      return Promise.resolve()
    })
    const repository = createRepository({ list, put, delete: del })

    renderProvider({ repository, snapshot: createSnapshot() })
    expect(await screen.findByText('Research')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByText('Research')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Undo delete' }))

    await waitFor(() => expect(put).toHaveBeenCalledExactlyOnceWith(existing))
  })
})

function renderProvider({
  repository,
  snapshot,
}: {
  repository: WorkspaceRepository
  snapshot: TabSnapshot
}) {
  return render(
    <TabsContext value={createTabsContextValue(snapshot)}>
      <SettingsContext value={createSettingsContextValue()}>
        <WorkspacesProvider repository={repository}>
          <Harness />
          <Toaster />
        </WorkspacesProvider>
      </SettingsContext>
    </TabsContext>,
  )
}

function createSettingsContextValue(): SettingsContextValue {
  return {
    settings: { theme: 'light', scope: 'current', copyFormat: 'markdown' },
    resolvedTheme: 'light',
    persistenceError: null,
    async updateSettings() {},
  }
}

function Harness() {
  const { workspaces, status, saveCurrentWindow, renameWorkspace, deleteWorkspace, undoDelete } =
    useWorkspaces()

  return (
    <div>
      <output data-testid="status">{status}</output>
      <ul>
        {workspaces.map((workspace) => (
          <li key={workspace.id}>{workspace.name}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => void saveCurrentWindow('Research').catch(() => undefined)}
      >
        Save current window
      </button>
      <button
        type="button"
        onClick={() => void renameWorkspace('ws-1', 'Renamed').catch(() => undefined)}
      >
        Rename
      </button>
      <button type="button" onClick={() => void deleteWorkspace('ws-1')}>
        Delete
      </button>
      <button type="button" onClick={() => void undoDelete()}>
        Undo delete
      </button>
    </div>
  )
}

function createTabsContextValue(snapshot: TabSnapshot): TabsContextValue {
  return {
    snapshot,
    status: 'ready',
    error: null,
    refresh: vi.fn().mockResolvedValue(undefined),
    activateTab: vi.fn().mockResolvedValue(undefined),
  }
}

function createRepository(overrides: Partial<WorkspaceRepository> = {}): WorkspaceRepository {
  return {
    list: vi.fn().mockResolvedValue({ workspaces: [], skippedCount: 0 }),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    replaceAll: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function createStoredWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'ws-1',
    name: 'Research',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    tabs: [{ url: 'https://example.com/', title: 'Example', pinned: false }],
    ...overrides,
  }
}

function createSnapshot(): TabSnapshot {
  return {
    tabs: [
      createTab({ id: 1, windowId: 1, index: 0, url: 'https://a.example.com/', title: 'Tab A' }),
      createTab({ id: 2, windowId: 1, index: 1, url: 'https://b.example.com/', title: 'Tab B' }),
      createTab({ id: 3, windowId: 2, index: 0, url: 'https://c.example.com/', title: 'Tab C' }),
    ],
    groups: [],
    currentWindowId: 1,
    capturedAt: 0,
  }
}

function createTab(overrides: Partial<TabRecord> = {}): TabRecord {
  return {
    id: 1,
    windowId: 1,
    index: 0,
    title: 'Tab',
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

function createDeferred<Value>() {
  let resolve: (value: Value) => void = () => {
    throw new Error('Deferred promise is not initialized')
  }
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}
