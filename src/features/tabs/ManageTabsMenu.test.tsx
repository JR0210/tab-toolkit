import { useEffect } from 'react'
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
import { ManageTabsMenu } from './ManageTabsMenu'
import { TabInteractionProvider } from './tab-interaction-provider'
import type { TabInteractionsContextValue } from './tab-interaction-provider'
import { TabsContext } from './tabs-context'
import type { TabsContextValue } from './tabs-context'
import { useTabInteractions } from './use-tab-interactions'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ManageTabsMenu', () => {
  it('excludes active and already-discarded tabs from the Discard call', async () => {
    // Select an active tab, a discarded tab, and a normal tab. Only the
    // normal tab's id should reach the gateway's discard call.
    const user = userEvent.setup()
    const discardTabs = vi.fn().mockResolvedValue({ succeeded: [3], failed: [] })
    const tabs = [
      createTab({ id: 1, active: true }),
      createTab({ id: 2, discarded: true }),
      createTab({ id: 3 }),
    ]
    renderMenu({ tabs, gateway: createStubBrowserGateway({ discardTabs }) })

    await user.click(await screen.findByRole('button', { name: 'Manage' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Discard' }))

    expect(discardTabs).toHaveBeenCalledExactlyOnceWith([3])
  })

  it('shows the exact summarizeBulk wording for a mixed pin result', async () => {
    const user = userEvent.setup()
    const result = { succeeded: [1], failed: [{ id: 2, message: 'gone' }] }
    const setPinned = vi.fn().mockResolvedValue(result)
    const tabs = [createTab({ id: 1 }), createTab({ id: 2 })]
    renderMenu({ tabs, gateway: createStubBrowserGateway({ setPinned }) })

    await user.click(await screen.findByRole('button', { name: 'Manage' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Pin' }))

    expect(await screen.findByText(summarizeBulk(result, 'Pinned'))).toBeVisible()
    expect(summarizeBulk(result, 'Pinned')).toBe('Pinned 1 tab; 1 tab was no longer available.')
  })

  it('records, removes, clears only the successfully removed ids from selection, refreshes, and offers Undo', async () => {
    const user = userEvent.setup()
    const save = vi.fn().mockResolvedValue(undefined)
    const removeTabs = vi
      .fn()
      .mockResolvedValue({ succeeded: [1], failed: [{ id: 2, message: 'gone' }] })
    const refresh = vi.fn().mockResolvedValue(undefined)
    const tabs = [createTab({ id: 1 }), createTab({ id: 2 })]
    const interactionsRef: { current: TabInteractionsContextValue | null } = { current: null }

    renderMenu({
      tabs,
      gateway: createStubBrowserGateway({ removeTabs }),
      repository: createRepository({ save }),
      refresh,
      captureInteractions: (value) => {
        interactionsRef.current = value
      },
      preselect: [1, 2],
    })

    await user.click(await screen.findByRole('button', { name: 'Manage' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Close' }))

    expect(save).toHaveBeenCalled()
    expect(removeTabs).toHaveBeenCalledExactlyOnceWith([1, 2])
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    await waitFor(() => expect(interactionsRef.current?.selectedIds.has(1)).toBe(false))
    expect(interactionsRef.current?.selectedIds.has(2)).toBe(true)
    expect(await screen.findByText('Undo')).toBeVisible()
  })

  it('runs undo only once when Undo is clicked twice', async () => {
    const user = userEvent.setup()
    const removeTabs = vi.fn().mockResolvedValue({ succeeded: [1], failed: [] })
    const snapshot: CloseSnapshot = {
      closedAt: 1,
      tabs: [
        { url: 'https://example.com', title: 'Example', pinned: false, windowId: 1, index: 0 },
      ],
    }
    const load = vi.fn().mockResolvedValue(snapshot)
    const clear = vi.fn().mockResolvedValue(undefined)
    const createTabMock = vi.fn().mockResolvedValue(77)
    const gateway = createStubBrowserGateway({
      removeTabs,
      windowExists: vi.fn().mockResolvedValue(true),
      createTab: createTabMock,
    })
    const tabs = [createTab({ id: 1 })]
    renderMenu({ tabs, gateway, repository: createRepository({ load, clear }) })

    await user.click(await screen.findByRole('button', { name: 'Manage' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Close' }))

    const undoButton = await screen.findByText('Undo')
    await user.click(undoButton)
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))
    await user.click(undoButton)

    await waitFor(() => expect(createTabMock).toHaveBeenCalledTimes(1))
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('keeps the menu usable after a failed action instead of unmounting it', async () => {
    const user = userEvent.setup()
    const setMuted = vi.fn().mockRejectedValue(new Error('boom'))
    const tabs = [createTab({ id: 1 })]
    renderMenu({ tabs, gateway: createStubBrowserGateway({ setMuted }) })

    await user.click(await screen.findByRole('button', { name: 'Manage' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Mute' }))

    await user.click(await screen.findByRole('button', { name: 'Manage' }))
    expect(await screen.findByRole('menuitem', { name: 'Mute' })).toBeVisible()
  })
})

function renderMenu({
  tabs,
  gateway = createStubBrowserGateway(),
  repository = createRepository(),
  refresh = vi.fn().mockResolvedValue(undefined),
  captureInteractions,
  preselect = [],
}: {
  tabs: TabRecord[]
  gateway?: BrowserGateway
  repository?: CloseRepository
  refresh?: TabsContextValue['refresh']
  captureInteractions?: (value: TabInteractionsContextValue) => void
  preselect?: number[]
}) {
  const snapshot = createSnapshot(tabs)

  return render(
    <BrowserProvider gateway={gateway}>
      <TabsContext value={createTabsContext(snapshot, refresh)}>
        <SettingsContext value={createSettingsContext()}>
          <TabInteractionProvider>
            {captureInteractions ? <InteractionsSpy onValue={captureInteractions} /> : null}
            <SelectPreset ids={preselect} />
            <ManageTabsMenu tabs={tabs} repository={repository} />
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

function InteractionsSpy({
  onValue,
}: {
  onValue: (value: ReturnType<typeof useTabInteractions>) => void
}) {
  const interactions = useTabInteractions()
  onValue(interactions)
  return null
}

function SelectPreset({ ids }: { ids: number[] }) {
  const { setManySelected } = useTabInteractions()

  useEffect(() => {
    setManySelected(ids, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
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
