import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserProvider } from '../../chrome/browser-context'
import type { BrowserGateway } from '../../chrome/browser-gateway'
import type { TabGroupRecord, TabRecord, TabSnapshot } from '../../domain/browser'
import { SettingsContext } from '../../shared/settings/settings-context'
import type { SettingsContextValue } from '../../shared/settings/settings-context'
import { Toaster } from '../../shared/ui/toaster'
import { createStubBrowserGateway } from '../../test/browser-gateway-mock'
import { AddToGroupDialog } from './AddToGroupDialog'
import { TabsContext } from '../tabs/tabs-context'
import type { TabsContextValue } from '../tabs/tabs-context'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AddToGroupDialog', () => {
  it('lists only groups belonging to the windows present in the selection', async () => {
    const groups: TabGroupRecord[] = [
      { id: 1, windowId: 1, title: 'Window 1 group', color: 'blue' },
      { id: 2, windowId: 2, title: 'Window 2 group', color: 'red' },
      { id: 3, windowId: 3, title: 'Window 3 group (not selected)', color: 'green' },
    ]
    const tabs = [tab({ id: 10, windowId: 1 }), tab({ id: 11, windowId: 2 })]

    renderDialog({ tabs, groups })

    expect(await screen.findByText('Window 1 group')).toBeVisible()
    expect(screen.getByText('Window 2 group')).toBeVisible()
    expect(screen.queryByText('Window 3 group (not selected)')).not.toBeInTheDocument()
  })

  it('never issues a groupTabs call mixing tabs from a window that does not own the chosen existing group', async () => {
    const user = userEvent.setup()
    const groupTabs = vi.fn().mockResolvedValue(1)
    const gateway = createStubBrowserGateway({ groupTabs })
    const groups: TabGroupRecord[] = [
      { id: 1, windowId: 1, title: 'Window 1 group', color: 'blue' },
    ]
    const tabs = [
      tab({ id: 10, windowId: 1 }),
      tab({ id: 11, windowId: 1 }),
      tab({ id: 12, windowId: 2 }),
    ]

    renderDialog({ tabs, groups, gateway })

    await user.click(await screen.findByRole('radio', { name: /Window 1 group/i }))
    await user.click(screen.getByRole('button', { name: 'Add to group' }))

    expect(groupTabs).toHaveBeenCalledExactlyOnceWith([10, 11], 1, 1)
  })

  it('creates a new group per window when the user chooses to create a new group', async () => {
    const user = userEvent.setup()
    let nextId = 90
    const groupTabs = vi.fn().mockImplementation(async () => nextId++)
    const updateGroup = vi.fn().mockResolvedValue(undefined)
    const gateway = createStubBrowserGateway({ groupTabs, updateGroup })
    const tabs = [tab({ id: 10, windowId: 1 }), tab({ id: 12, windowId: 2 })]

    renderDialog({ tabs, groups: [], gateway })

    await user.click(await screen.findByRole('radio', { name: /create a new group/i }))
    await user.type(screen.getByLabelText(/group name/i), 'Reading list')
    await user.click(screen.getByRole('button', { name: 'Add to group' }))

    expect(groupTabs).toHaveBeenCalledWith([10], 1)
    expect(groupTabs).toHaveBeenCalledWith([12], 2)
    expect(updateGroup).toHaveBeenCalledWith(90, {
      title: 'Reading list',
      color: expect.any(String),
    })
    expect(updateGroup).toHaveBeenCalledWith(91, {
      title: 'Reading list',
      color: expect.any(String),
    })
  })
})

function renderDialog({
  tabs,
  groups,
  gateway = createStubBrowserGateway(),
  onOpenChange = vi.fn(),
  refresh = vi.fn().mockResolvedValue(undefined),
}: {
  tabs: TabRecord[]
  groups: TabGroupRecord[]
  gateway?: BrowserGateway
  onOpenChange?: (open: boolean) => void
  refresh?: () => Promise<void>
}) {
  const snapshot: TabSnapshot = { tabs, groups, currentWindowId: 1, capturedAt: 1 }

  return render(
    <BrowserProvider gateway={gateway}>
      <TabsContext value={createTabsContext(snapshot, refresh)}>
        <SettingsContext value={createSettingsContext()}>
          <AddToGroupDialog open onOpenChange={onOpenChange} tabs={tabs} />
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

function createTabsContext(snapshot: TabSnapshot, refresh: () => Promise<void>): TabsContextValue {
  return {
    snapshot,
    status: 'ready',
    error: null,
    refresh,
    async activateTab() {},
  }
}

function tab(overrides: Partial<TabRecord> & { id: number }): TabRecord {
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
