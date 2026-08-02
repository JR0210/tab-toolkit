import { describe, expect, it } from 'vitest'
import type { TabGroupRecord, TabRecord } from '../../domain/browser'
import { tabsToDescriptors } from './workspace-mapper'

describe('tabsToDescriptors', () => {
  it('never includes Chrome tab/window/group ids in the output', () => {
    const tabs = [createTab({ id: 1, windowId: 9, index: 0, groupId: 5 })]
    const groups = [createGroup({ id: 5, windowId: 9, title: 'Research', color: 'blue' })]

    const { descriptors } = tabsToDescriptors(tabs, groups)

    expect(descriptors).toEqual([
      {
        url: 'https://example.com/1',
        title: 'Tab 1',
        pinned: false,
        group: { title: 'Research', color: 'blue' },
      },
    ])
    for (const descriptor of descriptors) {
      expect(descriptor).not.toHaveProperty('id')
      expect(descriptor).not.toHaveProperty('windowId')
      expect(descriptor).not.toHaveProperty('groupId')
    }
  })

  it('preserves the pinned state of each tab', () => {
    const tabs = [
      createTab({ id: 1, index: 0, pinned: true }),
      createTab({ id: 2, index: 1, pinned: false }),
    ]

    const { descriptors } = tabsToDescriptors(tabs, [])

    expect(descriptors.map((descriptor) => descriptor.pinned)).toEqual([true, false])
  })

  it('orders descriptors ascending by Chrome index regardless of input order', () => {
    const tabs = [
      createTab({ id: 3, index: 2, title: 'Third' }),
      createTab({ id: 1, index: 0, title: 'First' }),
      createTab({ id: 2, index: 1, title: 'Second' }),
    ]

    const { descriptors } = tabsToDescriptors(tabs, [])

    expect(descriptors.map((descriptor) => descriptor.title)).toEqual(['First', 'Second', 'Third'])
  })

  it('resolves a groupId to a matching group descriptor', () => {
    const tabs = [createTab({ id: 1, index: 0, groupId: 5 })]
    const groups = [createGroup({ id: 5, title: 'Research', color: 'green' })]

    const { descriptors } = tabsToDescriptors(tabs, groups)

    expect(descriptors[0].group).toEqual({ title: 'Research', color: 'green' })
  })

  it('omits the group field entirely for an ungrouped tab (groupId null)', () => {
    const tabs = [createTab({ id: 1, index: 0, groupId: null })]

    const { descriptors } = tabsToDescriptors(tabs, [])

    expect('group' in descriptors[0]).toBe(false)
  })

  it('omits the group field when groupId has no matching group', () => {
    const tabs = [createTab({ id: 1, index: 0, groupId: 99 })]

    const { descriptors } = tabsToDescriptors(tabs, [])

    expect('group' in descriptors[0]).toBe(false)
  })

  it('skips a tab with a missing (empty) url and reports it as skipped', () => {
    const tabs = [createTab({ id: 1, index: 0, url: '' })]

    const { descriptors, skippedCount } = tabsToDescriptors(tabs, [])

    expect(descriptors).toEqual([])
    expect(skippedCount).toBe(1)
  })

  it('skips non-http/https tabs (chrome://, file://, about:) and reports each as skipped', () => {
    const tabs = [
      createTab({ id: 1, index: 0, url: 'chrome://extensions' }),
      createTab({ id: 2, index: 1, url: 'file:///etc/passwd' }),
      createTab({ id: 3, index: 2, url: 'about:blank' }),
      createTab({ id: 4, index: 3, url: 'https://example.com/keep' }),
    ]

    const { descriptors, skippedCount } = tabsToDescriptors(tabs, [])

    expect(descriptors).toHaveLength(1)
    expect(descriptors[0].url).toBe('https://example.com/keep')
    expect(skippedCount).toBe(3)
  })
})

function createTab(overrides: Partial<TabRecord> = {}): TabRecord {
  return {
    id: 1,
    windowId: 1,
    index: 0,
    title: 'Tab 1',
    url: 'https://example.com/1',
    domain: 'example.com',
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

function createGroup(overrides: Partial<TabGroupRecord> = {}): TabGroupRecord {
  return {
    id: 1,
    windowId: 1,
    title: 'Group',
    color: 'grey',
    ...overrides,
  }
}
