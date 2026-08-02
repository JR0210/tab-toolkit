import { useEffect } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TabRecord, TabSnapshot } from '../../domain/browser'
import type { ClipboardGateway } from '../../platform/clipboard-gateway'
import { SettingsContext } from '../../shared/settings/settings-context'
import type { Settings } from '../../shared/settings/settings'
import type { SettingsContextValue } from '../../shared/settings/settings-context'
import { Toaster } from '../../shared/ui/toaster'
import { TabInteractionProvider } from '../tabs/tab-interaction-provider'
import { TabsContext } from '../tabs/tabs-context'
import type { TabsContextValue } from '../tabs/tabs-context'
import { useTabInteractions } from '../tabs/use-tab-interactions'
import { SelectionDock } from './SelectionDock'
import { copyTabsToClipboard } from './copy-actions'
import { formatTabsForClipboard } from './copy-format'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SelectionDock', () => {
  it('renders nothing when no tabs are selected', () => {
    renderDock({ preselectedIds: [] })

    expect(screen.queryByRole('toolbar', { name: 'Selected tabs' })).not.toBeInTheDocument()
  })

  it('copies the selected tabs using the current copy format', async () => {
    const user = userEvent.setup()
    const clipboard = createClipboardGateway()
    renderDock({ preselectedIds: [2, 3], copyFormat: 'urls', clipboard })

    await user.click(await screen.findByRole('button', { name: /^Copy/ }))

    expect(clipboard.writeText).toHaveBeenCalledExactlyOnceWith(
      formatTabsForClipboard([createTab(2, 1), createTab(3, 1, 1)], 'urls'),
    )
  })

  it('shows a success toast only after the clipboard write resolves', async () => {
    const user = userEvent.setup()
    const pending = createDeferred<void>()
    const clipboard: ClipboardGateway = { writeText: vi.fn().mockReturnValue(pending.promise) }
    renderDock({ preselectedIds: [2], copyFormat: 'urls', clipboard })

    await user.click(await screen.findByRole('button', { name: /^Copy/ }))

    expect(screen.queryByText(/Copied/)).not.toBeInTheDocument()

    await act(async () => {
      pending.resolve()
    })

    expect(await screen.findByText(/Copied/)).toBeInTheDocument()
  })

  it('shows a distinct error toast when the clipboard write rejects', async () => {
    const user = userEvent.setup()
    const clipboard: ClipboardGateway = {
      writeText: vi.fn().mockRejectedValue(new Error('denied')),
    }
    renderDock({ preselectedIds: [2], copyFormat: 'urls', clipboard })

    await user.click(await screen.findByRole('button', { name: /^Copy/ }))

    const errorToast = await screen.findByText(/could not copy/i)
    expect(errorToast.textContent?.toLowerCase()).not.toContain('copied')
    expect(screen.queryByText(/^Copied/)).not.toBeInTheDocument()
  })

  it('updates the saved copy format and copies using the newly chosen format in the same click', async () => {
    const user = userEvent.setup()
    const clipboard = createClipboardGateway()
    const updateSettings = vi.fn().mockResolvedValue(undefined)
    renderDock({ preselectedIds: [2, 3], copyFormat: 'urls', clipboard, updateSettings })

    await user.click(await screen.findByRole('button', { name: 'Choose copy format' }))
    await user.click(await screen.findByRole('menuitem', { name: 'CSV' }))

    expect(updateSettings).toHaveBeenCalledExactlyOnceWith({ copyFormat: 'csv' })
    expect(clipboard.writeText).toHaveBeenCalledExactlyOnceWith(
      formatTabsForClipboard([createTab(2, 1), createTab(3, 1, 1)], 'csv'),
    )
  })

  it('clears the selection when Clear is clicked', async () => {
    const user = userEvent.setup()
    renderDock({ preselectedIds: [2], copyFormat: 'urls' })

    await screen.findByRole('toolbar', { name: 'Selected tabs' })
    await user.click(screen.getByRole('button', { name: 'Clear' }))

    await waitFor(() =>
      expect(screen.queryByRole('toolbar', { name: 'Selected tabs' })).not.toBeInTheDocument(),
    )
  })

  it('copies only the explicitly given tabs, ignoring the currently selected set in context', async () => {
    // Catches a row-level copy action that silently reads selectedTabs from context
    // instead of the explicit tab list it was called with.
    const clipboard = createClipboardGateway()
    renderDock({ preselectedIds: [2, 3], copyFormat: 'urls', clipboard })
    await screen.findByRole('toolbar', { name: 'Selected tabs' })

    const explicitTab = createTab(8, 5)
    await copyTabsToClipboard([explicitTab], 'title-url', clipboard)

    expect(clipboard.writeText).toHaveBeenCalledExactlyOnceWith(
      formatTabsForClipboard([explicitTab], 'title-url'),
    )
  })
})

function renderDock({
  preselectedIds,
  copyFormat = 'markdown',
  clipboard,
  updateSettings = vi.fn().mockResolvedValue(undefined),
}: {
  preselectedIds: number[]
  copyFormat?: Settings['copyFormat']
  clipboard?: ClipboardGateway
  updateSettings?: SettingsContextValue['updateSettings']
}) {
  const tabs = [createTab(2, 1), createTab(3, 1, 1)]
  const snapshot = createSnapshot(tabs)

  return render(
    <TabsContext value={createTabsContext(snapshot)}>
      <SettingsContext value={createSettingsContext(copyFormat, updateSettings)}>
        <TabInteractionProvider>
          <SelectPreset ids={preselectedIds} />
          <SelectionDock clipboard={clipboard} />
        </TabInteractionProvider>
        <Toaster />
      </SettingsContext>
    </TabsContext>,
  )
}

function SelectPreset({ ids }: { ids: number[] }) {
  const { setManySelected } = useTabInteractions()

  useEffect(() => {
    setManySelected(ids, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

function createClipboardGateway(): ClipboardGateway & { writeText: ReturnType<typeof vi.fn> } {
  return { writeText: vi.fn().mockResolvedValue(undefined) }
}

function createTabsContext(snapshot: TabSnapshot): TabsContextValue {
  return {
    snapshot,
    status: 'ready',
    error: null,
    async refresh() {},
    async activateTab() {},
  }
}

function createSettingsContext(
  copyFormat: Settings['copyFormat'],
  updateSettings: SettingsContextValue['updateSettings'],
): SettingsContextValue {
  return {
    settings: { theme: 'light', scope: 'current', copyFormat },
    resolvedTheme: 'light',
    persistenceError: null,
    updateSettings,
  }
}

function createSnapshot(tabs: TabRecord[]): TabSnapshot {
  return { tabs, groups: [], currentWindowId: 1, capturedAt: 1 }
}

function createTab(id: number, windowId: number, index = 0): TabRecord {
  return {
    id,
    windowId,
    index,
    title: `Tab ${id}`,
    url: `https://tab-${id}.example`,
    domain: `tab-${id}.example`,
    faviconUrl: null,
    pinned: false,
    muted: false,
    audible: false,
    active: false,
    discarded: false,
    groupId: null,
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
