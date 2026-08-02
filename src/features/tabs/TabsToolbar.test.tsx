import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import type { BrowserGateway } from '../../chrome/browser-gateway'
import type { TabGroupRecord, TabRecord, TabSnapshot } from '../../domain/browser'
import { createSettingsRepository } from '../../shared/settings/settings-repository'
import type { SettingsStorageArea } from '../../shared/settings/settings-repository'
import { createStubBrowserGateway } from '../../test/browser-gateway-mock'

afterEach(() => {
  document.documentElement.classList.remove('dark')
  vi.unstubAllGlobals()
})

describe('Tabs toolbar', () => {
  it('keeps selected tabs selected when search and filters change the visible set', async () => {
    // Catches select-all replacing the selection, search clearing selection,
    // and a mixed checkbox derived from total rather than visible selection.
    const user = userEvent.setup()
    renderApp(createDiscoverySnapshot())

    await screen.findByText('5 tabs · 2 windows')
    const currentScope = screen.getByRole('tab', { name: 'Current window' })
    const allScope = screen.getByRole('tab', { name: 'All windows' })
    expect(currentScope).toHaveAttribute('aria-selected', 'true')
    expect(allScope).toHaveAttribute('aria-selected', 'false')

    await user.type(screen.getByRole('searchbox', { name: 'Search tabs' }), 'docs.example')

    await user.click(screen.getByRole('button', { name: 'Filter tabs' }))
    await user.click(await screen.findByRole('checkbox', { name: 'Pinned' }))
    expect(screen.getByRole('button', { name: /Filter tabs/ })).toHaveAccessibleName(
      'Filter tabs, 1 active',
    )

    await user.click(screen.getByRole('checkbox', { name: 'Select all visible tabs' }))
    expect(screen.getByText('1 of 1 selected')).toBeVisible()
    expect(screen.getByRole('checkbox', { name: /Select Pinned docs/ })).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Clear search' }))

    const selectVisible = screen.getByRole('checkbox', { name: 'Select all visible tabs' })
    expect(selectVisible).toBePartiallyChecked()
    expect(screen.getByText('1 of 2 selected')).toBeVisible()
    expect(screen.getByRole('checkbox', { name: /Select Pinned docs/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Select Pinned news/ })).not.toBeChecked()
  })

  it('reports retained selections independently from visible checkbox state', async () => {
    // Catches the toolbar hiding or understating total selection whenever
    // scope/search makes selected tabs partially or entirely invisible.
    const user = userEvent.setup()
    renderApp(createDiscoverySnapshot())
    await screen.findByText('5 tabs · 2 windows')

    await user.click(screen.getByRole('tab', { name: 'All windows' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search tabs' }), 'remote.example')
    await user.click(screen.getByRole('checkbox', { name: 'Select all visible tabs' }))
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    await user.click(screen.getByRole('tab', { name: 'Current window' }))

    const selectVisible = screen.getByRole('checkbox', { name: 'Select all visible tabs' })
    expect(screen.getByText('1 selected · 0 of 4 visible')).toBeVisible()
    expect(selectVisible).not.toBeChecked()
    expect(selectVisible).not.toBePartiallyChecked()

    await user.click(
      screen.getByRole('checkbox', { name: 'Select Pinned docs (tab 12, window 1)' }),
    )
    expect(screen.getByText('2 selected · 1 of 4 visible')).toBeVisible()
    expect(selectVisible).toBePartiallyChecked()

    await user.type(screen.getByRole('searchbox', { name: 'Search tabs' }), 'no-matching-tab')
    expect(screen.getByText('2 selected · 0 of 0 visible')).toBeVisible()
    expect(selectVisible).toBeDisabled()
    expect(selectVisible).not.toBeChecked()
    expect(selectVisible).not.toBePartiallyChecked()
  })

  it('clears filters and broadens scope from the no-results state', async () => {
    // Catches no-results actions that clear the wrong query field or fail to
    // use the provider's filter and scope setters.
    const user = userEvent.setup()
    renderApp(createDiscoverySnapshot())
    await screen.findByText('5 tabs · 2 windows')

    await user.type(screen.getByRole('searchbox', { name: 'Search tabs' }), 'Local issue')
    await user.click(screen.getByRole('button', { name: 'Filter tabs' }))
    await user.click(await screen.findByRole('checkbox', { name: 'Pinned' }))

    expect(await screen.findByRole('heading', { name: 'No tabs match' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(await screen.findByRole('heading', { name: 'Local issue' })).toBeVisible()

    const search = screen.getByRole('searchbox', { name: 'Search tabs' })
    await user.clear(search)
    await user.type(search, 'remote.example')
    expect(await screen.findByRole('heading', { name: 'No tabs match' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Search all windows' }))

    expect(await screen.findByRole('heading', { name: 'Inbox' })).toBeVisible()
    expect(screen.getByRole('tab', { name: 'All windows' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('provides unique checkbox names and exposes window collapse state', async () => {
    // Catches title-only row labels, unlabeled filter checkboxes, and window
    // toggles whose expanded state is unavailable to assistive technology.
    const user = userEvent.setup()
    renderApp(createDiscoverySnapshot())
    await screen.findByText('5 tabs · 2 windows')

    const windowToggle = screen.getByRole('button', { name: /Window 1 · 4 tabs/ })
    expect(windowToggle).toHaveAttribute('aria-expanded', 'true')
    await user.click(windowToggle)
    expect(windowToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('heading', { name: 'Window 1 · 4 tabs' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Pinned docs' })).not.toBeInTheDocument()
    await user.click(windowToggle)

    await user.click(screen.getByRole('tab', { name: 'All windows' }))
    await user.click(screen.getByRole('button', { name: 'Filter tabs' }))
    await screen.findByRole('checkbox', { name: 'Window 2' })

    const checkboxNames = screen
      .getAllByRole('checkbox')
      .map(
        (checkbox) =>
          checkbox.getAttribute('aria-label') ??
          checkbox.closest('label')?.textContent?.trim() ??
          '',
      )
    expect(checkboxNames.every((name) => name.length > 0)).toBe(true)
    expect(new Set(checkboxNames).size).toBe(checkboxNames.length)
    expect(screen.getByRole('checkbox', { name: 'Select Inbox (tab 14, window 1)' })).toBeVisible()
    expect(screen.getByRole('checkbox', { name: 'Select Inbox (tab 24, window 2)' })).toBeVisible()
  })

  it('operates and dismisses the filter popover and sort menu from the keyboard', async () => {
    // Catches replacing Base UI overlays with click-only controls or breaking
    // their focus movement, Escape dismissal, and focus restoration.
    const user = userEvent.setup()
    renderApp(createDiscoverySnapshot())
    await screen.findByText('5 tabs · 2 windows')

    const filterTrigger = screen.getByRole('button', { name: 'Filter tabs' })
    filterTrigger.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('dialog', { name: 'Filters' })).toBeVisible()
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Filters' })).not.toBeInTheDocument(),
    )
    expect(filterTrigger).toHaveFocus()

    const sortTrigger = screen.getByRole('button', { name: 'Sort tabs' })
    sortTrigger.focus()
    await user.keyboard('{ArrowDown}')
    const tabOrder = await screen.findByRole('menuitemradio', { name: 'Tab order' })
    expect(tabOrder).toHaveFocus()
    await user.keyboard('{ArrowDown}{Enter}')

    expect(screen.getByRole('button', { name: 'Sort tabs' })).toHaveTextContent('Title (A–Z)')
    expect(
      within(screen.getByRole('region', { name: 'Window 1 · 4 tabs' }))
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Inbox', 'Local issue', 'Pinned docs', 'Pinned news'])
  })

  it('focuses the search input with the focus-search keyboard shortcut', async () => {
    renderApp(createDiscoverySnapshot())
    await screen.findByText('5 tabs · 2 windows')

    fireKeydown({ key: 'k', ctrlKey: true })

    expect(screen.getByRole('searchbox', { name: 'Search tabs' })).toHaveFocus()
  })

  it('selects every visible tab (not a toggle) with the select-visible keyboard shortcut', async () => {
    const user = userEvent.setup()
    renderApp(createDiscoverySnapshot())
    await screen.findByText('5 tabs · 2 windows')

    await user.click(screen.getByRole('checkbox', { name: 'Select Inbox (tab 14, window 1)' }))
    expect(screen.getByText('1 of 4 selected')).toBeVisible()

    fireKeydown({ key: 'a', ctrlKey: true })
    expect(screen.getByText('4 of 4 selected')).toBeVisible()

    // A second press must stay a select-all, never toggle back to none.
    fireKeydown({ key: 'a', ctrlKey: true })
    expect(screen.getByText('4 of 4 selected')).toBeVisible()
  })

  it('clears the selection first and the search on a later Escape press', async () => {
    const user = userEvent.setup()
    renderApp(createDiscoverySnapshot())
    await screen.findByText('5 tabs · 2 windows')

    // "Inbox" narrows window 1 to a single visible tab.
    await user.type(screen.getByRole('searchbox', { name: 'Search tabs' }), 'Inbox')
    await user.click(screen.getByRole('checkbox', { name: 'Select Inbox (tab 14, window 1)' }))
    expect(screen.getByText('1 of 1 selected')).toBeVisible()

    fireKeydown({ key: 'Escape' })
    expect(screen.getByRole('searchbox', { name: 'Search tabs' })).toHaveValue('Inbox')
    expect(screen.getByText('1 tab')).toBeVisible()

    fireKeydown({ key: 'Escape' })
    expect(screen.getByRole('searchbox', { name: 'Search tabs' })).toHaveValue('')
  })

  it('uses singular "tab" for exactly one visible tab and plural otherwise', async () => {
    const user = userEvent.setup()
    renderApp(createDiscoverySnapshot())
    await screen.findByText('5 tabs · 2 windows')

    // Default scope is the current window (4 of the fixture's 5 tabs).
    expect(screen.getByText('4 tabs')).toBeVisible()

    await user.type(screen.getByRole('searchbox', { name: 'Search tabs' }), 'Inbox')
    expect(screen.getByText('1 tab')).toBeVisible()
    expect(screen.queryByText('1 tabs')).not.toBeInTheDocument()
  })
})

function fireKeydown(overrides: {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
}) {
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

function renderApp(snapshot: TabSnapshot) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(createMediaQueryList()))

  return render(
    <App
      repository={createSettingsRepository(createSettingsStorage())}
      gateway={createGateway(snapshot)}
    />,
  )
}

function createGateway(snapshot: TabSnapshot): BrowserGateway {
  return createStubBrowserGateway({
    async getSnapshot() {
      return snapshot
    },
  })
}

function createDiscoverySnapshot(): TabSnapshot {
  const groups: TabGroupRecord[] = [
    { id: 101, windowId: 1, title: 'Research', color: 'yellow' },
    { id: 202, windowId: 2, title: 'Remote', color: 'blue' },
  ]
  const tabs: TabRecord[] = [
    createTab({
      id: 14,
      windowId: 1,
      index: 0,
      title: 'Inbox',
      url: 'https://mail.local/inbox',
      domain: 'mail.local',
    }),
    createTab({
      id: 12,
      windowId: 1,
      index: 1,
      title: 'Pinned docs',
      url: 'https://docs.example/guide',
      domain: 'docs.example',
      pinned: true,
      groupId: 101,
    }),
    createTab({
      id: 13,
      windowId: 1,
      index: 2,
      title: 'Pinned news',
      url: 'https://news.example/today',
      domain: 'news.example',
      pinned: true,
    }),
    createTab({
      id: 24,
      windowId: 2,
      index: 0,
      title: 'Inbox',
      url: 'https://remote.example/inbox',
      domain: 'remote.example',
      groupId: 202,
    }),
    createTab({
      id: 15,
      windowId: 1,
      index: 3,
      title: 'Local issue',
      url: 'https://issues.local/15',
      domain: 'issues.local',
    }),
  ]

  return { tabs, groups, currentWindowId: 1, capturedAt: 1 }
}

function createTab({
  id,
  windowId,
  ...overrides
}: Partial<TabRecord> & Pick<TabRecord, 'id' | 'windowId'>): TabRecord {
  return {
    id,
    windowId,
    index: 0,
    title: 'Untitled tab',
    url: '',
    domain: '',
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

function createSettingsStorage(): SettingsStorageArea {
  return {
    async get() {
      return {
        settings: { theme: 'light', scope: 'current', copyFormat: 'markdown' },
      }
    },
    async set() {},
    async remove() {},
  }
}

function createMediaQueryList(): MediaQueryList {
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
