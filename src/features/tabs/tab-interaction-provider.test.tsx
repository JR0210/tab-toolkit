import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { TabRecord, TabSnapshot } from '../../domain/browser'
import { SettingsContext } from '../../shared/settings/settings-context'
import type { SettingsContextValue } from '../../shared/settings/settings-context'
import { TabsContext } from './tabs-context'
import type { TabsContextValue } from './tabs-context'
import { TabInteractionProvider } from './tab-interaction-provider'
import { useTabInteractions } from './use-tab-interactions'

describe('TabInteractionProvider', () => {
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
