import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PropsWithChildren } from 'react'
import type { TabRecord } from '../../domain/browser'
import { useSettings } from '../../shared/settings/use-settings'
import { useTabs } from './use-tabs'
import { EMPTY_FILTERS, queryTabs } from './tab-query'
import type { Filters, SortKey, TabQuery, WindowSectionRecord } from './tab-query'

export interface TabInteractionsContextValue {
  query: TabQuery
  setScope: (scope: TabQuery['scope']) => void
  setSearch: (search: string) => void
  setSort: (sort: SortKey) => void
  setFilters: (filters: Filters) => void
  sections: WindowSectionRecord[]
  visibleTabs: TabRecord[]
  visibleIds: number[]
  activeFilterCount: number
  selectedIds: ReadonlySet<number>
  selectedTabs: TabRecord[]
  toggleSelected: (tabId: number) => void
  setManySelected: (tabIds: readonly number[], selected: boolean) => void
  clearSelection: () => void
  collapsedWindowIds: ReadonlySet<number>
  toggleWindowCollapsed: (windowId: number) => void
}

export const TabInteractionsContext = createContext<TabInteractionsContextValue | null>(null)

export function TabInteractionProvider({ children }: PropsWithChildren) {
  const { snapshot } = useTabs()
  const { settings } = useSettings()
  const lastSettingsScope = useRef(settings.scope)
  const hasUserSelectedScope = useRef(false)
  const [query, setQuery] = useState<TabQuery>(() => ({
    scope: settings.scope,
    search: '',
    sort: 'position',
    filters: EMPTY_FILTERS,
  }))
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(() => new Set())
  const [collapsedWindowIds, setCollapsedWindowIds] = useState<ReadonlySet<number>>(() => new Set())

  const queryResult = useMemo(
    () =>
      snapshot
        ? queryTabs(snapshot, query)
        : { sections: [], visibleTabs: [], visibleIds: [], activeFilterCount: 0 },
    [query, snapshot],
  )

  useEffect(() => {
    if (!snapshot) {
      return
    }

    const liveIds = new Set(snapshot.tabs.map((tab) => tab.id))
    setSelectedIds((currentIds) => {
      const nextIds = new Set([...currentIds].filter((tabId) => liveIds.has(tabId)))

      return nextIds.size === currentIds.size ? currentIds : nextIds
    })
  }, [snapshot])

  useEffect(() => {
    if (settings.scope === lastSettingsScope.current) {
      return
    }

    lastSettingsScope.current = settings.scope

    if (!hasUserSelectedScope.current) {
      setQuery((currentQuery) => ({ ...currentQuery, scope: settings.scope }))
    }
  }, [settings.scope])

  const setScope = useCallback((scope: TabQuery['scope']) => {
    hasUserSelectedScope.current = true
    setQuery((currentQuery) => ({ ...currentQuery, scope }))
  }, [])

  const setSearch = useCallback((search: string) => {
    setQuery((currentQuery) => ({ ...currentQuery, search }))
  }, [])

  const setSort = useCallback((sort: SortKey) => {
    setQuery((currentQuery) => ({ ...currentQuery, sort }))
  }, [])

  const setFilters = useCallback((filters: Filters) => {
    setQuery((currentQuery) => ({ ...currentQuery, filters }))
  }, [])

  const toggleSelected = useCallback((tabId: number) => {
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(tabId)) {
        nextIds.delete(tabId)
      } else {
        nextIds.add(tabId)
      }

      return nextIds
    })
  }, [])

  const setManySelected = useCallback((tabIds: readonly number[], selected: boolean) => {
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds)

      for (const tabId of tabIds) {
        if (selected) {
          nextIds.add(tabId)
        } else {
          nextIds.delete(tabId)
        }
      }

      return nextIds
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(() => new Set())
  }, [])

  const toggleWindowCollapsed = useCallback((windowId: number) => {
    setCollapsedWindowIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(windowId)) {
        nextIds.delete(windowId)
      } else {
        nextIds.add(windowId)
      }

      return nextIds
    })
  }, [])

  const selectedTabs = useMemo(
    () =>
      (snapshot?.tabs ?? [])
        .filter((tab) => selectedIds.has(tab.id))
        .sort(
          (left, right) =>
            left.windowId - right.windowId || left.index - right.index || left.id - right.id,
        ),
    [selectedIds, snapshot],
  )

  const value = useMemo<TabInteractionsContextValue>(
    () => ({
      query,
      setScope,
      setSearch,
      setSort,
      setFilters,
      ...queryResult,
      selectedIds,
      selectedTabs,
      toggleSelected,
      setManySelected,
      clearSelection,
      collapsedWindowIds,
      toggleWindowCollapsed,
    }),
    [
      clearSelection,
      collapsedWindowIds,
      query,
      queryResult,
      selectedIds,
      selectedTabs,
      setFilters,
      setManySelected,
      setScope,
      setSearch,
      setSort,
      toggleSelected,
      toggleWindowCollapsed,
    ],
  )

  return <TabInteractionsContext value={value}>{children}</TabInteractionsContext>
}
