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
import type { CloseRepository } from '../tabs/close-repository'
import { TabsContext } from '../tabs/tabs-context'
import type { TabsContextValue } from '../tabs/tabs-context'
import { DuplicatesDialog } from './DuplicatesDialog'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DuplicatesDialog', () => {
  it('pre-selects the default keeper for each duplicate set', async () => {
    const tabs = [
      tab({ id: 1, url: 'https://example.com/a', pinned: false, active: false, index: 2 }),
      tab({ id: 2, url: 'https://example.com/a', pinned: true, active: false, index: 5 }),
    ]

    renderDialog({ tabs })

    // id 2 is pinned, so it's the default keeper -- its radio is checked.
    const keepTab2 = await screen.findByRole('radio', { name: /Tab 2/ })
    const keepTab1 = screen.getByRole('radio', { name: /Tab 1/ })
    expect(keepTab2).toBeChecked()
    expect(keepTab1).not.toBeChecked()
  })

  it('overriding the keeper changes which tab is proposed for closing', async () => {
    const user = userEvent.setup()
    const removeTabs = vi.fn().mockResolvedValue({ succeeded: [1], failed: [] })
    const gateway = createStubBrowserGateway({ removeTabs })
    const tabs = [
      tab({ id: 1, url: 'https://example.com/a', pinned: false, active: false, index: 0 }),
      tab({ id: 2, url: 'https://example.com/a', pinned: false, active: false, index: 1 }),
    ]

    renderDialog({ tabs, gateway })

    // Default keeper is id 1 (lowest index); override to keep id 2 instead.
    await user.click(screen.getByRole('radio', { name: /Tab 2/ }))
    await user.click(screen.getByRole('button', { name: /close 1 duplicate tab/i }))

    expect(removeTabs).toHaveBeenCalledExactlyOnceWith([1])
  })

  it('confirming calls closeTabs with exactly the non-keeper tabs across all sets', async () => {
    const user = userEvent.setup()
    const removeTabs = vi.fn().mockResolvedValue({ succeeded: [2, 4], failed: [] })
    const gateway = createStubBrowserGateway({ removeTabs })
    const tabs = [
      tab({ id: 1, url: 'https://a.example', pinned: true, index: 0 }),
      tab({ id: 2, url: 'https://a.example', pinned: false, index: 1 }),
      tab({ id: 3, url: 'https://b.example', pinned: true, index: 2 }),
      tab({ id: 4, url: 'https://b.example', pinned: false, index: 3 }),
    ]

    renderDialog({ tabs, gateway })

    expect(await screen.findByRole('button', { name: /close 2 duplicate tabs/i })).toBeVisible()
    await user.click(screen.getByRole('button', { name: /close 2 duplicate tabs/i }))

    expect(removeTabs).toHaveBeenCalledExactlyOnceWith([2, 4])
  })

  it('keeps the dialog open and shows an error toast when closeTabs rejects', async () => {
    const user = userEvent.setup()
    const save = vi.fn().mockRejectedValue(new Error('storage unavailable'))
    const gateway = createStubBrowserGateway()
    const onOpenChange = vi.fn()
    const refresh = vi.fn().mockResolvedValue(undefined)
    const tabs = [
      tab({ id: 1, url: 'https://example.com/a', index: 0 }),
      tab({ id: 2, url: 'https://example.com/a', index: 1 }),
    ]

    renderDialog({
      tabs,
      gateway,
      onOpenChange,
      refresh,
      repository: createRepository({ save }),
    })

    await user.click(await screen.findByRole('button', { name: /close 1 duplicate tab/i }))

    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(await screen.findByText(/could not/i)).toBeInTheDocument()
    // closeTabs can reject even after tabs were actually removed (e.g. the
    // undo-snapshot save failing post-removal), so the live snapshot must
    // still be refreshed even on this failure path.
    expect(refresh).toHaveBeenCalled()
  })
})

function renderDialog({
  tabs,
  gateway = createStubBrowserGateway(),
  onOpenChange = vi.fn(),
  refresh = vi.fn().mockResolvedValue(undefined),
  repository = createRepository(),
  groups = [],
}: {
  tabs: TabRecord[]
  gateway?: BrowserGateway
  onOpenChange?: (open: boolean) => void
  refresh?: () => Promise<void>
  repository?: CloseRepository
  groups?: TabGroupRecord[]
}) {
  const snapshot: TabSnapshot = { tabs, groups, currentWindowId: 1, capturedAt: 1 }

  return render(
    <BrowserProvider gateway={gateway}>
      <TabsContext value={createTabsContext(snapshot, refresh)}>
        <SettingsContext value={createSettingsContext()}>
          <DuplicatesDialog open onOpenChange={onOpenChange} tabs={tabs} repository={repository} />
          <Toaster />
        </SettingsContext>
      </TabsContext>
    </BrowserProvider>,
  )
}

function createRepository(overrides: Partial<CloseRepository> = {}): CloseRepository {
  return {
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
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
