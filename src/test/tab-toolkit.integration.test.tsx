import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import type { BrowserGateway } from '../chrome/browser-gateway'
import { createCloseRepository } from '../features/tabs/close-repository'
import { formatTabsForClipboard } from '../features/export/copy-format'
import { buildExportRows, EXPORT_FIELDS, serializeCsv } from '../features/export/export-format'
import { tabsToDescriptors } from '../features/workspaces/workspace-mapper'
import type { Workspace } from '../features/workspaces/workspace'
import type { WorkspaceRepository } from '../features/workspaces/workspace-repository'
import { createSettingsRepository } from '../shared/settings/settings-repository'
import type { ClipboardGateway } from '../platform/clipboard-gateway'
import type { DownloadGateway, DownloadRequest } from '../platform/download-gateway'
import { createStubBrowserGateway } from './browser-gateway-mock'
import {
  createInMemoryStorageArea,
  createSettingsStorage,
  createSnapshot,
  createTab,
} from './fixtures'

/**
 * Exercises the COMPLETE popup -- the real <App> tree with every gateway
 * injected as a fake -- through the cross-feature flows the plan calls out:
 * two-window rendering, search/select, copy, export, a partial-failure bulk
 * action, close+undo (including a real platform keyboard shortcut), saving a
 * workspace, importing a mix of valid/invalid URLs, and opening a saved
 * workspace. Each already-covered feature's OWN behavior/contract is tested
 * elsewhere (TabsView.test.tsx, SelectionDock.test.tsx,
 * workspaces-provider.test.tsx, ImportDialog.test.tsx, etc.) -- this file is
 * specifically about the WIRING between them: that the exact ids/records a
 * feature hands off actually reach the next feature/gateway unmodified, and
 * that every toast matches what the underlying fake actually returned.
 */

beforeEach(() => {
  // jsdom doesn't implement matchMedia; both SettingsProvider (system theme)
  // and sonner's Toaster call it unconditionally on mount, matching every
  // other App-rendering test file's setup (see App.test.tsx).
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(createStubMediaQueryList()))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  // A no-op when a given test never faked timers -- a safety net so the CSV
  // export test's fake system clock can't leak into later tests if it fails
  // before reaching its own vi.useRealTimers() call.
  vi.useRealTimers()
})

describe('tab-toolkit end-to-end wiring', () => {
  it('renders two windows of tabs, filters them by search across both windows, selects the matches, and copies them in Markdown to the injected clipboard', async () => {
    const user = userEvent.setup()
    const tabResearchPaper = createTab({
      id: 1,
      windowId: 1,
      index: 0,
      title: 'Research paper',
      url: 'https://a.example/',
      domain: 'a.example',
    })
    const tabGroceryList = createTab({
      id: 2,
      windowId: 1,
      index: 1,
      title: 'Grocery list',
      url: 'https://b.example/',
      domain: 'b.example',
    })
    const tabResearchNotes = createTab({
      id: 3,
      windowId: 2,
      index: 0,
      title: 'Research notes',
      url: 'https://c.example/',
      domain: 'c.example',
    })
    const tabWeather = createTab({
      id: 4,
      windowId: 2,
      index: 1,
      title: 'Weather forecast',
      url: 'https://d.example/',
      domain: 'd.example',
    })
    const snapshot = createSnapshot({
      tabs: [tabResearchPaper, tabGroceryList, tabResearchNotes, tabWeather],
      currentWindowId: 1,
    })
    const clipboard: ClipboardGateway & { writeText: ReturnType<typeof vi.fn> } = {
      writeText: vi.fn().mockResolvedValue(undefined),
    }

    render(
      <App
        repository={createSettingsSaveRepository()}
        gateway={createStubBrowserGateway({ getSnapshot: vi.fn().mockResolvedValue(snapshot) })}
        clipboard={clipboard}
      />,
    )

    expect(await screen.findByText('4 tabs · 2 windows')).toBeVisible()

    await user.click(await screen.findByRole('tab', { name: 'All windows' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search tabs' }), 'research')

    expect(screen.getByText('Research paper')).toBeVisible()
    expect(screen.getByText('Research notes')).toBeVisible()
    expect(screen.queryByText('Grocery list')).not.toBeInTheDocument()
    expect(screen.queryByText('Weather forecast')).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Select all visible tabs' }))
    await user.click(await screen.findByRole('button', { name: 'Copy Markdown' }))

    expect(clipboard.writeText).toHaveBeenCalledExactlyOnceWith(
      formatTabsForClipboard([tabResearchPaper, tabResearchNotes], 'markdown'),
    )
    expect(await screen.findByText('Copied 2 tabs')).toBeVisible()
  })

  it('exports the current selection as a safe CSV via the injected download gateway, neutralizing a formula-like title', async () => {
    useFixedExportDate()
    const user = userEvent.setup()
    const formulaTab = createTab({
      id: 5,
      windowId: 1,
      index: 0,
      title: '=SUM(A1)',
      url: 'https://e.example/',
      domain: 'e.example',
    })
    const normalTab = createTab({
      id: 6,
      windowId: 1,
      index: 1,
      title: 'Normal tab',
      url: 'https://f.example/',
      domain: 'f.example',
    })
    const snapshot = createSnapshot({ tabs: [formulaTab, normalTab], currentWindowId: 1 })
    const download: DownloadGateway & { download: ReturnType<typeof vi.fn> } = {
      download: vi.fn<DownloadGateway['download']>(),
    }

    render(
      <App
        repository={createSettingsSaveRepository()}
        gateway={createStubBrowserGateway({ getSnapshot: vi.fn().mockResolvedValue(snapshot) })}
        download={download}
      />,
    )

    await user.click(await screen.findByRole('checkbox', { name: 'Select all visible tabs' }))
    await user.click(await screen.findByRole('button', { name: 'Export' }))
    await screen.findByRole('dialog', { name: 'Export tabs' })
    await user.click(screen.getByRole('button', { name: 'Export' }))

    const expectedContents = serializeCsv(
      buildExportRows([formulaTab, normalTab], []),
      EXPORT_FIELDS,
    )
    expect(download.download).toHaveBeenCalledExactlyOnceWith({
      filename: 'tab-toolkit-2026-08-02.csv',
      mimeType: 'text/csv;charset=utf-8',
      contents: expectedContents,
    })
    // The formula-like title must be neutralized (leading apostrophe) AND
    // quoted -- this is what makes the exported CSV "safe" to open in a
    // spreadsheet app without triggering formula execution.
    const request = download.download.mock.calls[0]?.[0] as DownloadRequest
    expect(request.contents).toContain('"\'=SUM(A1)"')
    expect(await screen.findByText('Exported 2 tabs')).toBeVisible()
  })

  it('pins a selection where one tab has disappeared mid-operation, reporting the exact partial BulkResult and refreshing away the vanished tab', async () => {
    const user = userEvent.setup()
    const keepAlive = createTab({
      id: 7,
      windowId: 1,
      index: 0,
      title: 'Keep alive',
      url: 'https://g.example/',
      domain: 'g.example',
    })
    const vanishing = createTab({
      id: 8,
      windowId: 1,
      index: 1,
      title: 'Vanishing tab',
      url: 'https://h.example/',
      domain: 'h.example',
    })
    const initialSnapshot = createSnapshot({ tabs: [keepAlive, vanishing], currentWindowId: 1 })
    const afterPinSnapshot = createSnapshot({
      tabs: [{ ...keepAlive, pinned: true }],
      currentWindowId: 1,
    })
    const getSnapshot = vi
      .fn()
      .mockResolvedValueOnce(initialSnapshot)
      .mockResolvedValueOnce(afterPinSnapshot)
    // Simulates Chrome's own "no tab with that id" rejection for a tab that
    // closed in the real browser between selection and this bulk call --
    // exactly the race the plan calls out, driven at the gateway boundary
    // rather than by hand-building a BulkResult.
    const setPinned = vi.fn<BrowserGateway['setPinned']>().mockImplementation(async (ids) => {
      const succeeded: number[] = []
      const failed: { id: number; message: string }[] = []

      for (const id of ids) {
        if (id === vanishing.id) {
          failed.push({ id, message: 'No tab with id: 8.' })
        } else {
          succeeded.push(id)
        }
      }

      return { succeeded, failed }
    })

    render(
      <App
        repository={createSettingsSaveRepository()}
        gateway={createStubBrowserGateway({ getSnapshot, setPinned })}
      />,
    )

    expect(await screen.findByText('2 tabs · 1 window')).toBeVisible()
    await user.click(screen.getByRole('checkbox', { name: 'Select all visible tabs' }))
    await user.click(screen.getByRole('button', { name: 'Manage' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Pin' }))

    expect(setPinned).toHaveBeenCalledExactlyOnceWith([keepAlive.id, vanishing.id], true)
    expect(await screen.findByText('Pinned 1 tab; 1 tab was no longer available.')).toBeVisible()
    // The refresh after the bulk action re-fetched the snapshot -- the
    // vanished tab is gone from the live inventory, not just from the toast.
    expect(await screen.findByText('1 tab · 1 window')).toBeVisible()
    expect(screen.queryByText('Vanishing tab')).not.toBeInTheDocument()
  })

  it('closes a selection, then restores it with the platform undo-close keyboard shortcut, round-tripping through the real CloseRepository', async () => {
    const user = userEvent.setup()
    const docs = createTab({
      id: 10,
      windowId: 1,
      index: 0,
      title: 'Docs',
      url: 'https://a.example/',
      domain: 'a.example',
    })
    const blog = createTab({
      id: 11,
      windowId: 1,
      index: 1,
      title: 'Blog',
      url: 'https://b.example/',
      domain: 'b.example',
    })
    const initialSnapshot = createSnapshot({ tabs: [docs, blog], currentWindowId: 1 })
    const closedSnapshot = createSnapshot({ tabs: [], currentWindowId: 1 })
    const restoredSnapshot = createSnapshot({
      tabs: [
        { ...docs, id: 20 },
        { ...blog, id: 21 },
      ],
      currentWindowId: 1,
    })
    const getSnapshot = vi
      .fn()
      .mockResolvedValueOnce(initialSnapshot)
      .mockResolvedValueOnce(closedSnapshot)
      .mockResolvedValueOnce(restoredSnapshot)
    const removeTabs = vi
      .fn<BrowserGateway['removeTabs']>()
      .mockResolvedValue({ succeeded: [10, 11], failed: [] })
    const createTabCall = vi
      .fn<BrowserGateway['createTab']>()
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(21)
    // The REAL close-repository factory (not a hand-mocked stub) backed by an
    // in-memory storage area, so this test proves the actual
    // save/load/clear round trip, and -- critically -- that AppShell's
    // undo-close shortcut and SelectionDock/ManageTabsMenu's close action
    // share this SAME repository instance end to end.
    const closeStorage = createInMemoryStorageArea()
    const closeRepository = createCloseRepository(closeStorage)

    render(
      <App
        repository={createSettingsSaveRepository()}
        gateway={createStubBrowserGateway({
          getSnapshot,
          removeTabs,
          windowExists: vi.fn().mockResolvedValue(true),
          createTab: createTabCall,
        })}
        closeRepository={closeRepository}
      />,
    )

    expect(await screen.findByText('2 tabs · 1 window')).toBeVisible()
    await user.click(screen.getByRole('checkbox', { name: 'Select all visible tabs' }))
    await user.click(screen.getByRole('button', { name: 'Manage' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Close' }))

    expect(removeTabs).toHaveBeenCalledExactlyOnceWith([10, 11])
    expect(await screen.findByText('Closed 2 tabs.')).toBeVisible()
    expect(await screen.findByText('0 tabs · 0 windows')).toBeVisible()
    // The real repository actually persisted a recovery snapshot.
    await waitFor(async () => {
      const stored = await closeStorage.get('lastClosedTabs')
      expect(stored.lastClosedTabs).toBeDefined()
    })

    // Platform keyboard shortcut: Ctrl+Z (non-mac; App's default test
    // gateway resolves 'non-mac') for undo-close, registered at the
    // AppShell level -- not a button click.
    fireKeydown({ key: 'z', ctrlKey: true })

    expect(await screen.findByText('2 tabs · 1 window')).toBeVisible()
    expect(createTabCall).toHaveBeenNthCalledWith(1, { windowId: 1, url: docs.url, index: 0 })
    expect(createTabCall).toHaveBeenNthCalledWith(2, { windowId: 1, url: blog.url, index: 1 })
    expect(await screen.findByText('Restored 2 tabs.')).toBeVisible()
    expect(screen.getByText('Docs')).toBeVisible()
    expect(screen.getByText('Blog')).toBeVisible()
    // The repository cleared its recovery snapshot after the restore.
    await waitFor(async () => {
      const stored = await closeStorage.get('lastClosedTabs')
      expect(stored.lastClosedTabs).toBeUndefined()
    })
  })

  it('saves the current window as a new workspace with the exact tab descriptors', async () => {
    const user = userEvent.setup()
    const tabOne = createTab({
      id: 1,
      windowId: 1,
      index: 0,
      title: 'Tab one',
      url: 'https://a.example/',
      domain: 'a.example',
    })
    const tabTwo = createTab({
      id: 2,
      windowId: 1,
      index: 1,
      title: 'Tab two',
      url: 'https://b.example/',
      domain: 'b.example',
    })
    const snapshot = createSnapshot({ tabs: [tabOne, tabTwo], currentWindowId: 1 })
    const put = vi.fn().mockResolvedValue(undefined)
    const workspaceRepository = createWorkspaceRepositoryFake({ put })

    render(
      <App
        repository={createSettingsSaveRepository()}
        gateway={createStubBrowserGateway({ getSnapshot: vi.fn().mockResolvedValue(snapshot) })}
        workspaceRepository={workspaceRepository}
      />,
    )

    await user.click(await screen.findByRole('button', { name: 'Workspaces' }))
    // The empty-workspaces state renders its own duplicate "Save current
    // window" button alongside the header's -- the header's is always
    // present, so open it via that one specifically.
    const [openSaveDialog] = await screen.findAllByRole('button', { name: 'Save current window' })
    await user.click(openSaveDialog)
    await screen.findByRole('dialog', { name: 'Save current window' })
    await user.type(screen.getByLabelText('Name'), 'Reading list')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    const [saved] = put.mock.calls[0] as [Workspace]
    const { descriptors } = tabsToDescriptors([tabOne, tabTwo], [])

    expect(saved.name).toBe('Reading list')
    expect(saved.tabs).toEqual(descriptors)
    expect(await screen.findByText('Saved 2 tabs')).toBeVisible()
  })

  it('imports a mix of valid and invalid URLs, opening the valid ones and saving them to a new workspace via the SAME workspace repository used for Save', async () => {
    // This is the key wiring assertion: WorkspacesView must forward the
    // caller-injected repository into ImportDialog rather than building its
    // own internal chrome-backed instance -- otherwise a fake repository
    // injected at the App level would never observe an import's save.
    const user = userEvent.setup()
    const put = vi.fn().mockResolvedValue(undefined)
    const workspaceRepository = createWorkspaceRepositoryFake({ put })
    const createWindow = vi
      .fn<BrowserGateway['createWindow']>()
      .mockResolvedValue({ windowId: 50, tabId: 100 })
    const createTabCall = vi.fn<BrowserGateway['createTab']>().mockResolvedValue(101)

    render(
      <App
        repository={createSettingsSaveRepository()}
        gateway={createStubBrowserGateway({ createWindow, createTab: createTabCall })}
        workspaceRepository={workspaceRepository}
      />,
    )

    await user.click(await screen.findByRole('button', { name: 'Workspaces' }))
    await user.click(await screen.findByRole('button', { name: 'Import URLs' }))
    await screen.findByRole('dialog', { name: 'Import URLs' })
    await user.click(screen.getByLabelText('URLs'))
    await user.paste('https://valid1.example\nnot a url\nhttps://valid2.example')
    await user.type(screen.getByLabelText(/Save as workspace/), 'Imported set')
    await user.click(screen.getByRole('button', { name: 'Import' }))

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    const [saved] = put.mock.calls[0] as [Workspace]
    expect(saved.name).toBe('Imported set')
    expect(saved.tabs).toEqual([
      { url: 'https://valid1.example/', title: 'https://valid1.example/', pinned: false },
      { url: 'https://valid2.example/', title: 'https://valid2.example/', pinned: false },
    ])
    expect(createWindow).toHaveBeenCalledExactlyOnceWith('https://valid1.example/')
    expect(createTabCall).toHaveBeenCalledExactlyOnceWith({
      windowId: 50,
      url: 'https://valid2.example/',
      index: 1,
    })
    expect(
      await screen.findByText(
        'Opened 2 tabs; saved 2 URLs to a new workspace; 1 invalid line was skipped',
      ),
    ).toBeVisible()
  })

  it('opens a saved workspace into a new window, recreating its tabs in order and reapplying pinned state', async () => {
    const user = userEvent.setup()
    const savedWorkspace: Workspace = {
      id: 'ws-9',
      name: 'Reading list',
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-01T10:00:00.000Z',
      tabs: [
        { url: 'https://x.example/', title: 'X', pinned: false },
        { url: 'https://y.example/', title: 'Y', pinned: true },
      ],
    }
    const workspaceRepository = createWorkspaceRepositoryFake({
      list: vi.fn().mockResolvedValue({ workspaces: [savedWorkspace], skippedCount: 0 }),
    })
    const createWindow = vi
      .fn<BrowserGateway['createWindow']>()
      .mockResolvedValue({ windowId: 70, tabId: 200 })
    const createTabCall = vi.fn<BrowserGateway['createTab']>().mockResolvedValue(201)
    const setPinned = vi
      .fn<BrowserGateway['setPinned']>()
      .mockResolvedValue({ succeeded: [201], failed: [] })

    render(
      <App
        repository={createSettingsSaveRepository()}
        gateway={createStubBrowserGateway({ createWindow, createTab: createTabCall, setPinned })}
        workspaceRepository={workspaceRepository}
      />,
    )

    await user.click(await screen.findByRole('button', { name: 'Workspaces' }))
    await screen.findByText('Reading list')
    await user.click(screen.getByRole('button', { name: 'Open workspace: Reading list' }))

    expect(createWindow).toHaveBeenCalledExactlyOnceWith('https://x.example/')
    expect(createTabCall).toHaveBeenCalledExactlyOnceWith({
      windowId: 70,
      url: 'https://y.example/',
      index: 1,
    })
    expect(setPinned).toHaveBeenCalledExactlyOnceWith([201], true)
    expect(await screen.findByText('Opened 2 tabs from “Reading list”')).toBeVisible()
  })
})

function createStubMediaQueryList(): MediaQueryList {
  return {
    matches: false,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn().mockReturnValue(true),
  }
}

function useFixedExportDate(): void {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-02T12:00:00'))
}

function createSettingsSaveRepository() {
  return createSettingsRepository(createSettingsStorage())
}

function createWorkspaceRepositoryFake(
  overrides: Partial<WorkspaceRepository> = {},
): WorkspaceRepository {
  return {
    list: vi.fn().mockResolvedValue({ workspaces: [] as Workspace[], skippedCount: 0 }),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    replaceAll: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function fireKeydown(overrides: {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
}): void {
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: overrides.key,
        metaKey: overrides.metaKey ?? false,
        ctrlKey: overrides.ctrlKey ?? false,
        altKey: overrides.altKey ?? false,
        shiftKey: overrides.shiftKey ?? false,
        cancelable: true,
        bubbles: true,
      }),
    )
  })
}
