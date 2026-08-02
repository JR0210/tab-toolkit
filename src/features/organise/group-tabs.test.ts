import { describe, expect, it, vi } from 'vitest'
import type { TabRecord } from '../../domain/browser'
import { createStubBrowserGateway } from '../../test/browser-gateway-mock'
import { addToChosenGroup, colorForDomain, groupByDomain } from './group-tabs'

describe('colorForDomain', () => {
  it('always returns the same color for the same domain', () => {
    expect(colorForDomain('example.com')).toBe(colorForDomain('example.com'))
    expect(colorForDomain('another.test')).toBe(colorForDomain('another.test'))
  })

  it('never returns grey', () => {
    const domains = ['a.com', 'bb.com', 'ccc.com', 'dddd.com', 'eeeee.com', 'zzzzzz.example.org']
    for (const domain of domains) {
      expect(colorForDomain(domain)).not.toBe('grey')
    }
  })
})

describe('groupByDomain', () => {
  it('makes one independent group call per (window, domain) partition with a truncated, hashed title/color', async () => {
    const groupTabs = vi.fn().mockResolvedValue(100)
    let nextGroupId = 100
    groupTabs.mockImplementation(async () => nextGroupId++)
    const updateGroup = vi.fn().mockResolvedValue(undefined)
    const gateway = createStubBrowserGateway({ groupTabs, updateGroup })

    const tabs = [
      tab({ id: 1, windowId: 1, domain: 'alpha.example' }),
      tab({ id: 2, windowId: 1, domain: 'alpha.example' }),
      tab({ id: 3, windowId: 1, domain: 'beta.example' }),
      tab({ id: 4, windowId: 1, domain: 'beta.example' }),
      tab({ id: 5, windowId: 2, domain: 'alpha.example' }),
      tab({ id: 6, windowId: 2, domain: 'alpha.example' }),
      tab({ id: 7, windowId: 2, domain: 'beta.example' }),
      tab({ id: 8, windowId: 2, domain: 'beta.example' }),
    ]

    const result = await groupByDomain(tabs, gateway)

    expect(groupTabs).toHaveBeenCalledTimes(4)
    expect(groupTabs).toHaveBeenCalledWith([1, 2], 1)
    expect(groupTabs).toHaveBeenCalledWith([3, 4], 1)
    expect(groupTabs).toHaveBeenCalledWith([5, 6], 2)
    expect(groupTabs).toHaveBeenCalledWith([7, 8], 2)

    expect(updateGroup).toHaveBeenCalledTimes(4)
    expect(updateGroup).toHaveBeenCalledWith(expect.any(Number), {
      title: 'alpha.example',
      color: colorForDomain('alpha.example'),
    })
    expect(updateGroup).toHaveBeenCalledWith(expect.any(Number), {
      title: 'beta.example',
      color: colorForDomain('beta.example'),
    })

    expect(result.succeeded.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(result.failed).toEqual([])
  })

  it('groups a same-domain pair of exactly 2 tabs (boundary)', async () => {
    const groupTabs = vi.fn().mockResolvedValue(1)
    const updateGroup = vi.fn().mockResolvedValue(undefined)
    const gateway = createStubBrowserGateway({ groupTabs, updateGroup })
    const tabs = [
      tab({ id: 1, windowId: 1, domain: 'alpha.example' }),
      tab({ id: 2, windowId: 1, domain: 'alpha.example' }),
    ]

    const result = await groupByDomain(tabs, gateway)

    expect(groupTabs).toHaveBeenCalledExactlyOnceWith([1, 2], 1)
    expect(result.succeeded.sort((a, b) => a - b)).toEqual([1, 2])
  })

  it('skips a lone tab for a domain without calling the gateway, reporting it as neither succeeded nor failed', async () => {
    const groupTabs = vi.fn().mockResolvedValue(1)
    const gateway = createStubBrowserGateway({ groupTabs })
    const tabs = [tab({ id: 1, windowId: 1, domain: 'alpha.example' })]

    const result = await groupByDomain(tabs, gateway)

    expect(groupTabs).not.toHaveBeenCalled()
    expect(result.succeeded).toEqual([])
    expect(result.failed).toEqual([])
  })

  it('truncates domain titles to 80 characters', async () => {
    const longDomain = `${'a'.repeat(90)}.example`
    const groupTabs = vi.fn().mockResolvedValue(1)
    const updateGroup = vi.fn().mockResolvedValue(undefined)
    const gateway = createStubBrowserGateway({ groupTabs, updateGroup })
    const tabs = [
      tab({ id: 1, windowId: 1, domain: longDomain }),
      tab({ id: 2, windowId: 1, domain: longDomain }),
    ]

    await groupByDomain(tabs, gateway)

    expect(updateGroup).toHaveBeenCalledExactlyOnceWith(1, {
      title: longDomain.slice(0, 80),
      color: colorForDomain(longDomain),
    })
  })

  it('reports a partition as failed when the gateway throws, without affecting other partitions', async () => {
    const groupTabs = vi.fn().mockImplementation(async (tabIds: readonly number[]) => {
      if (tabIds.includes(1)) {
        throw new Error('boom')
      }
      return 42
    })
    const updateGroup = vi.fn().mockResolvedValue(undefined)
    const gateway = createStubBrowserGateway({ groupTabs, updateGroup })
    const tabs = [
      tab({ id: 1, windowId: 1, domain: 'alpha.example' }),
      tab({ id: 2, windowId: 1, domain: 'alpha.example' }),
      tab({ id: 3, windowId: 1, domain: 'beta.example' }),
      tab({ id: 4, windowId: 1, domain: 'beta.example' }),
    ]

    const result = await groupByDomain(tabs, gateway)

    expect(result.failed).toEqual([
      { id: 1, message: 'boom' },
      { id: 2, message: 'boom' },
    ])
    expect(result.succeeded.sort((a, b) => a - b)).toEqual([3, 4])
  })
})

describe('addToChosenGroup', () => {
  it('adds tabs to an existing group by id', async () => {
    const groupTabs = vi.fn().mockResolvedValue(9)
    const gateway = createStubBrowserGateway({ groupTabs })
    const tabs = [tab({ id: 1, windowId: 1 }), tab({ id: 2, windowId: 1 })]

    const result = await addToChosenGroup(tabs, { groupId: 9, windowId: 1 }, gateway)

    expect(groupTabs).toHaveBeenCalledExactlyOnceWith([1, 2], 1, 9)
    expect(result.succeeded.sort((a, b) => a - b)).toEqual([1, 2])
  })

  it('never mixes a tab from another window into an existing group id, excluding it from the result entirely', async () => {
    const groupTabs = vi.fn().mockResolvedValue(9)
    const gateway = createStubBrowserGateway({ groupTabs })
    const tabs = [
      tab({ id: 1, windowId: 1 }),
      tab({ id: 2, windowId: 1 }),
      tab({ id: 3, windowId: 2 }),
    ]

    const result = await addToChosenGroup(tabs, { groupId: 9, windowId: 1 }, gateway)

    expect(groupTabs).toHaveBeenCalledExactlyOnceWith([1, 2], 1, 9)
    expect(groupTabs).not.toHaveBeenCalledWith(expect.arrayContaining([3]), expect.anything(), 9)
    expect(result.succeeded.sort((a, b) => a - b)).toEqual([1, 2])
    expect(result.failed).toEqual([])
  })

  it('creates one new group per distinct window when no groupId is given', async () => {
    let nextId = 50
    const groupTabs = vi.fn().mockImplementation(async () => nextId++)
    const updateGroup = vi.fn().mockResolvedValue(undefined)
    const gateway = createStubBrowserGateway({ groupTabs, updateGroup })
    const tabs = [
      tab({ id: 1, windowId: 1 }),
      tab({ id: 2, windowId: 1 }),
      tab({ id: 3, windowId: 2 }),
    ]

    const result = await addToChosenGroup(
      tabs,
      { newGroupTitle: 'Reading', color: 'purple' },
      gateway,
    )

    expect(groupTabs).toHaveBeenCalledTimes(2)
    expect(groupTabs).toHaveBeenCalledWith([1, 2], 1)
    expect(groupTabs).toHaveBeenCalledWith([3], 2)
    expect(updateGroup).toHaveBeenCalledWith(50, { title: 'Reading', color: 'purple' })
    expect(updateGroup).toHaveBeenCalledWith(51, { title: 'Reading', color: 'purple' })
    expect(result.succeeded.sort((a, b) => a - b)).toEqual([1, 2, 3])
  })
})

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
