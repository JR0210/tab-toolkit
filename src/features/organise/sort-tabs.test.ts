import { describe, expect, it, vi } from 'vitest'
import type { TabRecord } from '../../domain/browser'
import { createStubBrowserGateway } from '../../test/browser-gateway-mock'
import { arrangeSelection, planTabMoves } from './sort-tabs'

describe('planTabMoves', () => {
  it('never produces a move that crosses a window or pinned-state boundary', () => {
    const tabs = [
      tab({ id: 1, windowId: 1, pinned: true, index: 0, title: 'Zebra' }),
      tab({ id: 2, windowId: 1, pinned: true, index: 1, title: 'Alpha' }),
      tab({ id: 3, windowId: 1, pinned: false, index: 2, title: 'Delta' }),
      tab({ id: 4, windowId: 1, pinned: false, index: 3, title: 'Bravo' }),
      tab({ id: 5, windowId: 2, pinned: false, index: 0, title: 'Charlie' }),
      tab({ id: 6, windowId: 2, pinned: false, index: 1, title: 'Alpha' }),
    ]

    const moves = planTabMoves(tabs, 'title')
    const tabsById = new Map(tabs.map((t) => [t.id, t]))

    for (const move of moves) {
      const original = tabsById.get(move.tabId)!
      expect(move.windowId).toBe(original.windowId)
    }

    // The pinned window-1 pair (ids 1,2) may only be assigned indices from
    // {0,1} -- never index 2 or 3, which belong to the unpinned bucket.
    const pinnedMoves = moves.filter((m) => m.tabId === 1 || m.tabId === 2)
    for (const move of pinnedMoves) {
      expect([0, 1]).toContain(move.index)
    }

    const unpinnedWindow1Moves = moves.filter((m) => m.tabId === 3 || m.tabId === 4)
    for (const move of unpinnedWindow1Moves) {
      expect([2, 3]).toContain(move.index)
    }
  })

  it('sorts using locale-aware case-insensitive comparison', () => {
    const tabs = [
      tab({ id: 1, index: 0, title: 'Banana' }),
      tab({ id: 2, index: 1, title: 'apple' }),
      tab({ id: 3, index: 2, title: 'café' }),
      tab({ id: 4, index: 3, title: 'cafe' }),
    ]

    const moves = planTabMoves(tabs, 'title')
    const finalOrderIds = applyMoves(tabs, moves).map((t) => t.id)

    // apple(2) < Banana(1) < {cafe(4), café(3)} in locale-aware base order.
    expect(finalOrderIds.slice(0, 2)).toEqual([2, 1])
    expect(new Set(finalOrderIds.slice(2))).toEqual(new Set([3, 4]))
  })

  it('breaks ties by original selection index, not alphabetically, when titles are equal', () => {
    const tabs = [
      tab({ id: 10, index: 0, title: 'Same' }),
      tab({ id: 5, index: 1, title: 'Same' }),
      tab({ id: 20, index: 2, title: 'Same' }),
    ]

    const moves = planTabMoves(tabs, 'title')
    const finalOrderIds = applyMoves(tabs, moves).map((t) => t.id)

    // All titles equal -> original relative order (10, 5, 20) is preserved.
    expect(finalOrderIds).toEqual([10, 5, 20])
  })

  it('calculates target indices from the real window position, not a selection-relative position', () => {
    // Only 2 of these 3 tabs are selected (id 2 is excluded), but their real
    // window indices are 0, 1, and 2 respectively -- the plan must use the
    // REAL indices (0 and 2), never re-numbering the selection as 0 and 1.
    const tabs = [tab({ id: 1, index: 0, title: 'Zeta' }), tab({ id: 3, index: 2, title: 'Alpha' })]

    const moves = planTabMoves(tabs, 'title')

    expect(moves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tabId: 3, index: 0 }),
        expect.objectContaining({ tabId: 1, index: 2 }),
      ]),
    )
  })

  it('sorts by domain when given the domain sort', () => {
    const tabs = [
      tab({ id: 1, index: 0, title: 'One', domain: 'zeta.example' }),
      tab({ id: 2, index: 1, title: 'Two', domain: 'alpha.example' }),
    ]

    const moves = planTabMoves(tabs, 'domain')

    expect(moves).toEqual([
      { tabId: 2, windowId: 1, index: 0 },
      { tabId: 1, windowId: 1, index: 1 },
    ])
  })

  it('produces no moves when the selection is already sorted', () => {
    const tabs = [tab({ id: 1, index: 0, title: 'Alpha' }), tab({ id: 2, index: 1, title: 'Beta' })]

    expect(planTabMoves(tabs, 'title')).toEqual([])
  })

  it('orders moves within a partition by ascending target index', () => {
    const tabs = [
      tab({ id: 1, index: 0, title: 'Zeta' }),
      tab({ id: 2, index: 1, title: 'Mid' }),
      tab({ id: 3, index: 2, title: 'Alpha' }),
    ]

    const moves = planTabMoves(tabs, 'title')
    const indices = moves.map((m) => m.index)

    expect(indices).toEqual([...indices].sort((a, b) => a - b))
  })
})

describe('arrangeSelection', () => {
  it('executes moves sequentially via gateway.moveTab in ascending target-index order', async () => {
    const calls: Array<[number, number, number]> = []
    const moveTab = vi.fn().mockImplementation(async (tabId, windowId, index) => {
      calls.push([tabId, windowId, index])
    })
    const gateway = createStubBrowserGateway({ moveTab })
    const tabs = [
      tab({ id: 1, index: 0, title: 'Zeta' }),
      tab({ id: 2, index: 1, title: 'Mid' }),
      tab({ id: 3, index: 2, title: 'Alpha' }),
    ]

    const result = await arrangeSelection(tabs, 'title', gateway)

    // Alpha(3) -> index 0, Mid(2) is already at index 1 (no move needed),
    // Zeta(1) -> index 2 -- moves must fire in ascending target-index order.
    expect(calls).toEqual([
      [3, 1, 0],
      [1, 1, 2],
    ])
    expect(result.succeeded.sort((a, b) => a - b)).toEqual([1, 3])
    expect(result.failed).toEqual([])
  })

  it('records a failure, stops that partition, and refetches the snapshot before continuing to the next partition', async () => {
    const moveTab = vi.fn().mockImplementation(async (tabId: number) => {
      if (tabId === 2) {
        throw new Error('Tab moved by user')
      }
    })
    const getSnapshot = vi.fn().mockResolvedValue({
      tabs: [
        tab({ id: 5, windowId: 2, index: 0, title: 'Zulu' }),
        tab({ id: 6, windowId: 2, index: 1, title: 'Alpha' }),
      ],
      groups: [],
      currentWindowId: null,
      capturedAt: 1,
    })
    const gateway = createStubBrowserGateway({ moveTab, getSnapshot })
    const tabs = [
      tab({ id: 1, windowId: 1, index: 0, title: 'Zeta' }),
      tab({ id: 2, windowId: 1, index: 1, title: 'Alpha' }),
      tab({ id: 5, windowId: 2, index: 0, title: 'Zulu' }),
      tab({ id: 6, windowId: 2, index: 1, title: 'Alpha' }),
    ]

    const result = await arrangeSelection(tabs, 'title', gateway)

    expect(getSnapshot).toHaveBeenCalled()
    expect(result.failed).toEqual([{ id: 2, message: 'Tab moved by user' }])
    // Window 2's partition should still have been attempted after the
    // window-1 failure triggered a refresh.
    expect(moveTab).toHaveBeenCalledWith(6, 2, 0)
  })
})

function applyMoves(
  original: readonly TabRecord[],
  moves: ReadonlyArray<{ tabId: number; index: number }>,
): TabRecord[] {
  // Simple simulation: start with the original order (by index), then apply
  // each move by index-shift semantics equivalent to chrome.tabs.move.
  const order = [...original].sort((a, b) => a.index - b.index)

  for (const move of moves) {
    const fromIndex = order.findIndex((t) => t.id === move.tabId)
    const [item] = order.splice(fromIndex, 1)
    order.splice(move.index, 0, item)
  }

  return order
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
