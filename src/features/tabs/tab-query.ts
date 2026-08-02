import type { TabRecord, TabSnapshot } from '../../domain/browser'
import type { Scope } from '../../shared/settings/settings'

export type SortKey = 'position' | 'title' | 'domain'

export interface Filters {
  windowIds: readonly number[]
  domains: readonly string[]
  groupIds: readonly number[]
  pinned: boolean
  audible: boolean
  muted: boolean
  duplicates: boolean
}

export interface TabQuery {
  scope: Scope
  search: string
  sort: SortKey
  filters: Filters
}

export interface WindowSectionRecord {
  windowId: number
  tabs: TabRecord[]
}

export const EMPTY_FILTERS: Readonly<Filters> = Object.freeze({
  windowIds: Object.freeze([]),
  domains: Object.freeze([]),
  groupIds: Object.freeze([]),
  pinned: false,
  audible: false,
  muted: false,
  duplicates: false,
})

export function countActiveFilters(filters: Filters): number {
  return [
    filters.windowIds.length > 0,
    filters.domains.length > 0,
    filters.groupIds.length > 0,
    filters.pinned,
    filters.audible,
    filters.muted,
    filters.duplicates,
  ].filter(Boolean).length
}

export function queryTabs(snapshot: TabSnapshot, query: TabQuery) {
  const scopedTabs = snapshot.tabs.filter((tab) =>
    isInScope(tab, snapshot.currentWindowId, query.scope),
  )
  const scopedUrlCounts = countUrls(scopedTabs)
  const visibleTabs = scopedTabs.filter((tab) => matchesQuery(tab, query, scopedUrlCounts))
  const sections = groupAndSortTabs(visibleTabs, query.sort)
  const orderedTabs = sections.flatMap((section) => section.tabs)

  return {
    sections,
    visibleTabs: orderedTabs,
    visibleIds: orderedTabs.map((tab) => tab.id),
    activeFilterCount: countActiveFilters(query.filters),
  }
}

function isInScope(tab: TabRecord, currentWindowId: number | null, scope: Scope): boolean {
  return scope === 'all' || tab.windowId === currentWindowId
}

function countUrls(tabs: readonly TabRecord[]): Map<string, number> {
  const counts = new Map<string, number>()

  for (const tab of tabs) {
    counts.set(tab.url, (counts.get(tab.url) ?? 0) + 1)
  }

  return counts
}

function matchesQuery(
  tab: TabRecord,
  query: TabQuery,
  scopedUrlCounts: ReadonlyMap<string, number>,
): boolean {
  const { filters } = query

  return (
    matchesSearch(tab, query.search) &&
    matchesValues(filters.windowIds, tab.windowId) &&
    matchesValues(filters.domains, tab.domain) &&
    matchesValues(filters.groupIds, tab.groupId) &&
    (!filters.pinned || tab.pinned) &&
    (!filters.audible || tab.audible) &&
    (!filters.muted || tab.muted) &&
    (!filters.duplicates || (scopedUrlCounts.get(tab.url) ?? 0) > 1)
  )
}

function matchesSearch(tab: TabRecord, search: string): boolean {
  const normalizedSearch = search.trim().toLowerCase()

  return (
    normalizedSearch === '' ||
    tab.title.toLowerCase().includes(normalizedSearch) ||
    tab.url.toLowerCase().includes(normalizedSearch) ||
    tab.domain.toLowerCase().includes(normalizedSearch)
  )
}

function matchesValues<T>(selectedValues: readonly T[], value: T): boolean {
  return selectedValues.length === 0 || selectedValues.includes(value)
}

function groupAndSortTabs(tabs: readonly TabRecord[], sort: SortKey): WindowSectionRecord[] {
  const tabsByWindow = new Map<number, TabRecord[]>()

  for (const tab of tabs) {
    const windowTabs = tabsByWindow.get(tab.windowId)

    if (windowTabs) {
      windowTabs.push(tab)
    } else {
      tabsByWindow.set(tab.windowId, [tab])
    }
  }

  return [...tabsByWindow.entries()]
    .sort(([leftWindowId], [rightWindowId]) => leftWindowId - rightWindowId)
    .map(([windowId, windowTabs]) => ({ windowId, tabs: sortWindowTabs(windowTabs, sort) }))
}

function sortWindowTabs(tabs: readonly TabRecord[], sort: SortKey): TabRecord[] {
  const inChromeOrder = [...tabs].sort((left, right) => left.index - right.index)

  if (sort === 'position') {
    return inChromeOrder
  }

  return inChromeOrder.sort((left, right) =>
    valueForSort(left, sort).localeCompare(valueForSort(right, sort)),
  )
}

function valueForSort(tab: TabRecord, sort: Exclude<SortKey, 'position'>): string {
  return (sort === 'title' ? tab.title : tab.domain).toLowerCase()
}
