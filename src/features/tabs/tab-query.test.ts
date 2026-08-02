import { describe, expect, it } from 'vitest'
import type { TabRecord, TabSnapshot } from '../../domain/browser'
import {
  EMPTY_FILTERS,
  countActiveFilters,
  queryTabs,
  type Filters,
  type TabQuery,
} from './tab-query'

const snapshot: TabSnapshot = {
  tabs: [
    createTab({
      id: 1,
      windowId: 1,
      index: 2,
      title: 'Zebra notes',
      url: 'https://alpha.example/notes',
      domain: 'alpha.example',
      audible: true,
      groupId: 10,
    }),
    createTab({
      id: 2,
      windowId: 1,
      index: 1,
      title: 'Bravo duplicate',
      url: 'https://duplicate.example/path',
      domain: 'duplicate.example',
      pinned: true,
      groupId: 10,
    }),
    createTab({
      id: 4,
      windowId: 1,
      index: 4,
      title: 'Alpha duplicate',
      url: 'https://duplicate.example/path',
      domain: 'duplicate.example',
      pinned: true,
      audible: true,
      muted: true,
      groupId: 11,
    }),
    createTab({
      id: 5,
      windowId: 1,
      index: 3,
      title: 'Same title',
      url: 'https://same.example/first',
      domain: 'same.example',
    }),
    createTab({
      id: 6,
      windowId: 1,
      index: 5,
      title: 'Same title',
      url: 'https://same.example/second',
      domain: 'same.example',
    }),
    createTab({
      id: 3,
      windowId: 2,
      index: 1,
      title: 'Window two duplicate',
      url: 'https://duplicate.example/path',
      domain: 'duplicate.example',
      groupId: 12,
    }),
    createTab({
      id: 7,
      windowId: 2,
      index: 2,
      title: 'Gamma guide',
      url: 'https://guide.example/read',
      domain: 'guide.example',
    }),
  ],
  groups: [
    { id: 10, windowId: 1, title: 'Work', color: 'blue' },
    { id: 11, windowId: 1, title: 'Personal', color: 'green' },
    { id: 12, windowId: 2, title: 'Archive', color: 'grey' },
  ],
  currentWindowId: 1,
  capturedAt: 1,
}

const defaultQuery: TabQuery = {
  scope: 'current',
  search: '',
  sort: 'position',
  filters: EMPTY_FILTERS,
}

describe('queryTabs', () => {
  it.each([
    ['current', defaultQuery, [2, 1, 5, 4, 6]],
    ['all', { ...defaultQuery, scope: 'all' }, [2, 1, 5, 4, 6, 3, 7]],
  ] as const)('returns tabs in the %s scope', (_name, query, ids) => {
    // Catches applying filters before scope, which can leak another window's tabs.
    expect(queryTabs(snapshot, query).visibleTabs.map((tab) => tab.id)).toEqual(ids)
  })

  it.each([
    ['title', 'zEbRa', [1]],
    ['URL', 'GUIDE.EXAMPLE/READ', [7]],
    ['domain', 'ALPHA.EXAMPLE', [1]],
  ] as const)('matches %s search case-insensitively', (_field, search, ids) => {
    // Catches case-sensitive matching or omitting one of title, URL, and domain.
    expect(
      queryTabs(snapshot, { ...defaultQuery, scope: 'all', search }).visibleTabs.map(
        (tab) => tab.id,
      ),
    ).toEqual(ids)
  })

  it.each([
    ['window', { windowIds: [2] }, [3, 7]],
    ['domain', { domains: ['same.example'] }, [5, 6]],
    ['group', { groupIds: [11] }, [4]],
    ['pinned', { pinned: true }, [2, 4]],
    ['audible', { audible: true }, [1, 4]],
    ['muted', { muted: true }, [4]],
  ] as const)('applies the %s filter', (_name, partialFilters, ids) => {
    // Catches a filter branch being ignored or using OR instead of the active constraint.
    const filters: Filters = { ...EMPTY_FILTERS, ...partialFilters }

    expect(
      queryTabs(snapshot, { ...defaultQuery, scope: 'all', filters }).visibleTabs.map(
        (tab) => tab.id,
      ),
    ).toEqual(ids)
  })

  it('keeps exact-URL duplicates that occur inside the active scope only', () => {
    // Catches duplicate counts computed before scoping or based on a non-exact URL match.
    expect(
      queryTabs(snapshot, {
        ...defaultQuery,
        filters: { ...EMPTY_FILTERS, duplicates: true },
      }).visibleTabs.map((tab) => tab.id),
    ).toEqual([2, 4])
  })

  it('sorts each window by title stably', () => {
    // Catches global sorting and unstable ties that lose Chrome index order.
    const result = queryTabs(snapshot, { ...defaultQuery, scope: 'all', sort: 'title' })

    expect(
      result.sections.map((section) => [section.windowId, section.tabs.map((tab) => tab.id)]),
    ).toEqual([
      [1, [4, 2, 5, 6, 1]],
      [2, [7, 3]],
    ])
  })

  it('sorts each window by domain stably', () => {
    // Catches sorting by host globally or changing the established order for equal domains.
    const result = queryTabs(snapshot, { ...defaultQuery, scope: 'all', sort: 'domain' })

    expect(
      result.sections.map((section) => [section.windowId, section.tabs.map((tab) => tab.id)]),
    ).toEqual([
      [1, [1, 2, 4, 5, 6]],
      [2, [3, 7]],
    ])
  })

  it('derives ordered IDs, sections, and active filter count from one result', () => {
    // Catches consumers needing to re-derive query metadata or filters being miscounted.
    const result = queryTabs(snapshot, {
      ...defaultQuery,
      filters: { ...EMPTY_FILTERS, windowIds: [1, 2], pinned: true, duplicates: true },
    })

    expect(result.visibleIds).toEqual([2, 4])
    expect(result.sections).toEqual([{ windowId: 1, tabs: [snapshot.tabs[1], snapshot.tabs[2]] }])
    expect(result.activeFilterCount).toBe(3)
  })
})

describe('countActiveFilters', () => {
  it('counts each active filter category once', () => {
    // Catches badge counts that grow with the number of selected option values.
    expect(
      countActiveFilters({
        ...EMPTY_FILTERS,
        windowIds: [1, 2],
        domains: ['alpha.example', 'same.example'],
        groupIds: [10],
        pinned: true,
        duplicates: true,
      }),
    ).toBe(5)
  })
})

function createTab(
  overrides: Partial<TabRecord> & Pick<TabRecord, 'id' | 'windowId' | 'index'>,
): TabRecord {
  return {
    id: overrides.id,
    windowId: overrides.windowId,
    index: overrides.index,
    title: overrides.title ?? `Tab ${overrides.id}`,
    url: overrides.url ?? `https://tab-${overrides.id}.example`,
    domain: overrides.domain ?? `tab-${overrides.id}.example`,
    faviconUrl: null,
    pinned: overrides.pinned ?? false,
    muted: overrides.muted ?? false,
    audible: overrides.audible ?? false,
    active: false,
    discarded: false,
    groupId: overrides.groupId ?? null,
  }
}
