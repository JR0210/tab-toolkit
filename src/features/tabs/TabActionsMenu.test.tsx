import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserProvider } from '../../chrome/browser-context'
import type { BrowserGateway } from '../../chrome/browser-gateway'
import type { TabRecord, TabSnapshot } from '../../domain/browser'
import { SettingsContext } from '../../shared/settings/settings-context'
import type { SettingsContextValue } from '../../shared/settings/settings-context'
import { Toaster } from '../../shared/ui/toaster'
import { createStubBrowserGateway } from '../../test/browser-gateway-mock'
import { summarizeBulk } from './bulk-result'
import type { CloseRepository, CloseSnapshot } from './close-repository'
import { TabActionsMenu } from './TabActionsMenu'
import { TabInteractionProvider } from './tab-interaction-provider'
import { TabsContext } from './tabs-context'
import type { TabsContextValue } from './tabs-context'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TabActionsMenu', () => {
  it('pins the tab and shows a success toast after refreshing', async () => {
    const user = userEvent.setup()
    const setPinned = vi.fn().mockResolvedValue({ succeeded: [2], failed: [] })
    const refresh = vi.fn().mockResolvedValue(undefined)
    renderMenu({
      tab: createTab({ id: 2, pinned: false }),
      gateway: createStubBrowserGateway({ setPinned }),
      refresh,
    })

    await user.click(await screen.findByRole('button', { name: /Actions for/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Pin' }))

    expect(setPinned).toHaveBeenCalledExactlyOnceWith([2], true)
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(await screen.findByText('Pinned 1 tab.')).toBeVisible()
  })

  it('offers Unpin instead of Pin for an already-pinned tab', async () => {
    const user = userEvent.setup()
    const setPinned = vi.fn().mockResolvedValue({ succeeded: [2], failed: [] })
    renderMenu({
      tab: createTab({ id: 2, pinned: true }),
      gateway: createStubBrowserGateway({ setPinned }),
    })

    await user.click(await screen.findByRole('button', { name: /Actions for/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Unpin' }))

    expect(setPinned).toHaveBeenCalledExactlyOnceWith([2], false)
  })

  it('reloads the tab', async () => {
    const user = userEvent.setup()
    const reloadTabs = vi.fn().mockResolvedValue({ succeeded: [2], failed: [] })
    renderMenu({ tab: createTab({ id: 2 }), gateway: createStubBrowserGateway({ reloadTabs }) })

    await user.click(await screen.findByRole('button', { name: /Actions for/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Reload' }))

    expect(reloadTabs).toHaveBeenCalledExactlyOnceWith([2])
  })

  it('hides the Discard action for the active tab', async () => {
    const user = userEvent.setup()
    renderMenu({ tab: createTab({ id: 2, active: true }) })

    await user.click(await screen.findByRole('button', { name: /Actions for/ }))

    expect(screen.queryByRole('menuitem', { name: 'Discard' })).not.toBeInTheDocument()
  })

  it('hides the Discard action for an already-discarded tab', async () => {
    const user = userEvent.setup()
    renderMenu({ tab: createTab({ id: 2, discarded: true }) })

    await user.click(await screen.findByRole('button', { name: /Actions for/ }))

    expect(screen.queryByRole('menuitem', { name: 'Discard' })).not.toBeInTheDocument()
  })

  it('discards an eligible tab', async () => {
    const user = userEvent.setup()
    const discardTabs = vi.fn().mockResolvedValue({ succeeded: [2], failed: [] })
    renderMenu({ tab: createTab({ id: 2 }), gateway: createStubBrowserGateway({ discardTabs }) })

    await user.click(await screen.findByRole('button', { name: /Actions for/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Discard' }))

    expect(discardTabs).toHaveBeenCalledExactlyOnceWith([2])
  })

  it('shows an error toast using the shared summary when an action fails', async () => {
    const user = userEvent.setup()
    const result = { succeeded: [], failed: [{ id: 2, message: 'gone' }] }
    const setMuted = vi.fn().mockResolvedValue(result)
    renderMenu({ tab: createTab({ id: 2 }), gateway: createStubBrowserGateway({ setMuted }) })

    await user.click(await screen.findByRole('button', { name: /Actions for/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Mute' }))

    expect(await screen.findByText(summarizeBulk(result, 'Muted'))).toBeVisible()
  })

  it('closes the tab through the lifecycle service, refreshes, and offers Undo', async () => {
    const user = userEvent.setup()
    const save = vi.fn().mockResolvedValue(undefined)
    const removeTabs = vi.fn().mockResolvedValue({ succeeded: [2], failed: [] })
    const refresh = vi.fn().mockResolvedValue(undefined)
    const repository = createRepository({ save })
    renderMenu({
      tab: createTab({ id: 2 }),
      gateway: createStubBrowserGateway({ removeTabs }),
      repository,
      refresh,
    })

    await user.click(await screen.findByRole('button', { name: /Actions for/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Close' }))

    expect(save).toHaveBeenCalled()
    expect(removeTabs).toHaveBeenCalledExactlyOnceWith([2])
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(await screen.findByText('Undo')).toBeVisible()
  })

  it('runs undo only once even if the Undo action is triggered twice', async () => {
    const user = userEvent.setup()
    const removeTabs = vi.fn().mockResolvedValue({ succeeded: [2], failed: [] })
    const snapshot: CloseSnapshot = {
      closedAt: 1,
      tabs: [
        { url: 'https://example.com', title: 'Example', pinned: false, windowId: 1, index: 0 },
      ],
    }
    const load = vi.fn().mockResolvedValue(snapshot)
    const clear = vi.fn().mockResolvedValue(undefined)
    const createTabMock = vi.fn().mockResolvedValue(55)
    const gateway = createStubBrowserGateway({
      removeTabs,
      windowExists: vi.fn().mockResolvedValue(true),
      createTab: createTabMock,
    })
    const repository = createRepository({ load, clear })
    renderMenu({ tab: createTab({ id: 2 }), gateway, repository })

    await user.click(await screen.findByRole('button', { name: /Actions for/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Close' }))

    const undoButton = await screen.findByText('Undo')
    await user.click(undoButton)
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))
    await user.click(undoButton)

    await waitFor(() => expect(createTabMock).toHaveBeenCalledTimes(1))
    expect(load).toHaveBeenCalledTimes(1)
  })
})

function renderMenu({
  tab,
  gateway = createStubBrowserGateway(),
  repository = createRepository(),
  refresh = vi.fn().mockResolvedValue(undefined),
}: {
  tab: TabRecord
  gateway?: BrowserGateway
  repository?: CloseRepository
  refresh?: TabsContextValue['refresh']
}) {
  const snapshot = createSnapshot([tab])

  return render(
    <BrowserProvider gateway={gateway}>
      <TabsContext value={createTabsContext(snapshot, refresh)}>
        <SettingsContext value={createSettingsContext()}>
          <TabInteractionProvider>
            <TabActionsMenu tab={tab} repository={repository} />
          </TabInteractionProvider>
          <Toaster />
        </SettingsContext>
      </TabsContext>
    </BrowserProvider>,
  )
}

function createSettingsContext(): SettingsContextValue {
  return {
    settings: { theme: 'light', scope: 'current', copyFormat: 'markdown' },
    resolvedTheme: 'light',
    persistenceError: null,
    async updateSettings() {},
  }
}

function createRepository(overrides: Partial<CloseRepository> = {}): CloseRepository {
  return {
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function createTabsContext(
  snapshot: TabSnapshot,
  refresh: TabsContextValue['refresh'],
): TabsContextValue {
  return {
    snapshot,
    status: 'ready',
    error: null,
    refresh,
    async activateTab() {},
  }
}

function createSnapshot(tabs: TabRecord[]): TabSnapshot {
  return { tabs, groups: [], currentWindowId: 1, capturedAt: 1 }
}

function createTab(overrides: Partial<TabRecord> & { id: number }): TabRecord {
  return {
    windowId: 1,
    index: 0,
    title: `Tab ${overrides.id}`,
    url: `https://tab-${overrides.id}.example`,
    domain: `tab-${overrides.id}.example`,
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
