import { describe, expect, it } from 'vitest'
import type { TabRecord } from '../../domain/browser'
import { groupTabsByWindow } from './tab-inventory'

describe('groupTabsByWindow', () => {
  it('groups windows numerically and tabs by their Chrome index without mutating input', () => {
    // Catches string-based window ordering, in-place snapshot mutation, and
    // lost Chrome tab order.
    const tabs = [
      createTab({ id: 3, windowId: 12, index: 5 }),
      createTab({ id: 2, windowId: 2, index: 7 }),
      createTab({ id: 1, windowId: 12, index: 1 }),
    ]

    expect(groupTabsByWindow(tabs)).toEqual([
      { windowId: 2, tabs: [tabs[1]] },
      { windowId: 12, tabs: [tabs[2], tabs[0]] },
    ])
    expect(tabs.map((tab) => tab.id)).toEqual([3, 2, 1])
  })
})

function createTab({
  id,
  windowId,
  index,
}: Pick<TabRecord, 'id' | 'windowId' | 'index'>): TabRecord {
  return {
    id,
    windowId,
    index,
    title: `Tab ${id}`,
    url: '',
    domain: '',
    faviconUrl: null,
    pinned: false,
    muted: false,
    audible: false,
    active: false,
    discarded: false,
    groupId: null,
  }
}
