import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TabRecord, TabSnapshot } from '../../domain/browser'
import { SettingsProvider } from '../../shared/settings/settings-provider'
import type { SettingsRepository } from '../../shared/settings/settings-repository'
import type { Settings } from '../../shared/settings/settings'
import { SettingsContext } from '../../shared/settings/settings-context'
import type { SettingsContextValue } from '../../shared/settings/settings-context'
import { TabsContext } from './tabs-context'
import type { TabsContextValue } from './tabs-context'
import { TabInteractionProvider } from './tab-interaction-provider'
import { useTabInteractions } from './use-tab-interactions'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TabInteractionProvider', () => {
  it('adopts the persisted all scope after settings hydrate', async () => {
    // Catches reading the default settings scope only during the provider's first render.
    const settingsLoad = createDeferred<Settings>()
    renderHydratedInteractions(createSnapshot([createTab(2, 1), createTab(3, 2)]), settingsLoad.promise)

    expect(screen.getByTestId('scope')).toHaveTextContent('current')

    await act(async () => {
      settingsLoad.resolve({ theme: 'light', scope: 'all', copyFormat: 'markdown' })
    })

    await waitFor(() => expect(screen.getByTestId('scope')).toHaveTextContent('all'))
  })

  it('keeps an explicit scope choice when settings hydrate afterwards', async () => {
    // Catches persisted settings overwriting a scope the user selected while hydration was pending.
    const settingsLoad = createDeferred<Settings>()
    const user = userEvent.setup()
    renderHydratedInteractions(createSnapshot([createTab(2, 1), createTab(3, 2)]), settingsLoad.promise)

    await user.click(screen.getByRole('button', { name: 'Show current window' }))
    await act(async () => {
      settingsLoad.resolve({ theme: 'light', scope: 'all', copyFormat: 'markdown' })
    })

    await waitFor(() => expect(screen.getByTestId('scope')).toHaveTextContent('current'))
  })

  it('prunes selections for tabs removed from the live snapshot', async () => {
    // Catches selection state retaining an ID after Chrome no longer returns that tab.
    const user = userEvent.setup()
    const { rerender } = renderInteractions(createSnapshot([createTab(2, 1), createTab(3, 2)]))

    await user.click(screen.getByRole('button', { name: 'Toggle 2' }))
    await user.click(screen.getByRole('button', { name: 'Toggle 3' }))
    expect(screen.getByTestId('selected-ids')).toHaveTextContent('2,3')

    rerender(<InteractionHarness snapshot={createSnapshot([createTab(3, 2)])} />)

    expect(screen.getByTestId('selected-ids')).toHaveTextContent('3')
  })

  it('keeps hidden selections until cleared while selecting all visible tabs', async () => {
    // Catches scope changes or select-all overwriting a selected tab that is merely hidden.
    const user = userEvent.setup()
    renderInteractions(createSnapshot([createTab(2, 1), createTab(3, 2)]))

    expect(screen.getByTestId('scope')).toHaveTextContent('current')
    await user.click(screen.getByRole('button', { name: 'Toggle 3' }))
    await user.click(screen.getByRole('button', { name: 'Select all visible' }))
    expect(screen.getByTestId('selected-ids')).toHaveTextContent('2,3')

    await user.click(screen.getByRole('button', { name: 'Show all windows' }))
    expect(screen.getByTestId('selected-ids')).toHaveTextContent('2,3')
    expect(screen.getByTestId('selected-tabs')).toHaveTextContent('2,3')

    await user.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(screen.getByTestId('selected-ids')).toBeEmptyDOMElement()
  })

  it('keeps a selected visible tab in bulk selections after search hides it', async () => {
    // Catches selectedTabs being filtered through the visible query result.
    const user = userEvent.setup()
    renderInteractions(createSnapshot([createTab(2, 1), createTab(3, 2)]))

    await user.click(screen.getByRole('button', { name: 'Toggle 2' }))
    await user.click(screen.getByRole('button', { name: 'Hide all tabs' }))

    expect(screen.getByTestId('selected-ids')).toHaveTextContent('2')
    expect(screen.getByTestId('selected-tabs')).toHaveTextContent('2')
  })

  it('tracks collapsed windows independently of the tab query', async () => {
    // Catches window collapse state being derived from the latest query instead of user action.
    const user = userEvent.setup()
    renderInteractions(createSnapshot([createTab(2, 1), createTab(3, 2)]))

    await user.click(screen.getByRole('button', { name: 'Toggle window 2' }))
    expect(screen.getByTestId('collapsed-window-ids')).toHaveTextContent('2')

    await user.click(screen.getByRole('button', { name: 'Toggle window 2' }))
    expect(screen.getByTestId('collapsed-window-ids')).toBeEmptyDOMElement()
  })
})

function InteractionHarness({ snapshot }: { snapshot: TabSnapshot }) {
  return (
    <TabsContext value={createTabsContext(snapshot)}>
      <SettingsContext value={createSettingsContext()}>
        <TabInteractionProvider>
          <InteractionProbe />
        </TabInteractionProvider>
      </SettingsContext>
    </TabsContext>
  )
}

function InteractionProbe() {
  const {
    query,
    setScope,
    setSearch,
    selectedIds,
    selectedTabs,
    toggleSelected,
    setManySelected,
    clearSelection,
    collapsedWindowIds,
    toggleWindowCollapsed,
    visibleIds,
  } = useTabInteractions()

  return (
    <>
      <output data-testid="selected-ids">{[...selectedIds].sort((left, right) => left - right).join(',')}</output>
      <output data-testid="selected-tabs">{selectedTabs.map((tab) => tab.id).join(',')}</output>
      <output data-testid="collapsed-window-ids">{[...collapsedWindowIds].join(',')}</output>
      <output data-testid="scope">{query.scope}</output>
      <button type="button" onClick={() => toggleSelected(2)}>
        Toggle 2
      </button>
      <button type="button" onClick={() => toggleSelected(3)}>
        Toggle 3
      </button>
      <button type="button" onClick={() => setManySelected(visibleIds, true)}>
        Select all visible
      </button>
      <button type="button" onClick={() => setScope('all')}>
        Show all windows
      </button>
      <button type="button" onClick={() => setScope('current')}>
        Show current window
      </button>
      <button type="button" onClick={() => setSearch('not-a-tab-title')}>
        Hide all tabs
      </button>
      <button type="button" onClick={clearSelection}>
        Clear selection
      </button>
      <button type="button" onClick={() => toggleWindowCollapsed(2)}>
        Toggle window 2
      </button>
    </>
  )
}

function renderInteractions(snapshot: TabSnapshot) {
  return render(<InteractionHarness snapshot={snapshot} />)
}

function renderHydratedInteractions(snapshot: TabSnapshot, settings: Promise<Settings>) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(createMediaQueryList()))

  return render(
    <TabsContext value={createTabsContext(snapshot)}>
      <SettingsProvider repository={createSettingsRepository(settings)}>
        <TabInteractionProvider>
          <InteractionProbe />
        </TabInteractionProvider>
      </SettingsProvider>
    </TabsContext>,
  )
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

function createSettingsContext(): SettingsContextValue {
  return {
    settings: { theme: 'light', scope: 'current', copyFormat: 'markdown' },
    resolvedTheme: 'light',
    persistenceError: null,
    async updateSettings() {},
  }
}

function createSettingsRepository(settings: Promise<Settings>): SettingsRepository {
  return {
    load: () => settings,
    async save() {},
    async reset() {},
  }
}

function createSnapshot(tabs: TabRecord[]): TabSnapshot {
  return { tabs, groups: [], currentWindowId: 1, capturedAt: 1 }
}

function createTab(id: number, windowId: number): TabRecord {
  return {
    id,
    windowId,
    index: 0,
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

function createDeferred<Value>() {
  let resolve: (value: Value) => void = () => {
    throw new Error('Deferred promise is not initialized')
  }
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}
