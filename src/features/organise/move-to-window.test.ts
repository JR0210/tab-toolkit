import { describe, expect, it, vi } from 'vitest'
import type { TabRecord } from '../../domain/browser'
import { createStubBrowserGateway } from '../../test/browser-gateway-mock'
import { moveSelectionToNewWindow } from './move-to-window'

describe('moveSelectionToNewWindow', () => {
  it('creates a new window carrying the first selected tab, then moves the rest to its end in order', async () => {
    const createWindowWithTab = vi.fn().mockResolvedValue({ windowId: 99, tabId: 8 })
    const moveTabs = vi.fn().mockResolvedValue({ succeeded: [3, 11], failed: [] })
    const gateway = createStubBrowserGateway({ createWindowWithTab, moveTabs })
    const tabs = [tab({ id: 8 }), tab({ id: 3 }), tab({ id: 11 })]

    const result = await moveSelectionToNewWindow(tabs, gateway)

    expect(createWindowWithTab).toHaveBeenCalledExactlyOnceWith(8)
    expect(moveTabs).toHaveBeenCalledExactlyOnceWith([3, 11], 99, -1)
    expect(result).toEqual({ succeeded: [8, 3, 11], failed: [] })
  })

  it('only creates the window and never calls moveTabs when the selection has a single tab', async () => {
    const createWindowWithTab = vi.fn().mockResolvedValue({ windowId: 99, tabId: 8 })
    const moveTabs = vi.fn().mockResolvedValue({ succeeded: [], failed: [] })
    const gateway = createStubBrowserGateway({ createWindowWithTab, moveTabs })
    const tabs = [tab({ id: 8 })]

    const result = await moveSelectionToNewWindow(tabs, gateway)

    expect(createWindowWithTab).toHaveBeenCalledExactlyOnceWith(8)
    expect(moveTabs).not.toHaveBeenCalled()
    expect(result).toEqual({ succeeded: [8], failed: [] })
  })

  it('reports every selected tab as failed and never attempts moveTabs when window creation itself throws', async () => {
    const createWindowWithTab = vi.fn().mockRejectedValue(new Error('Chrome refused'))
    const moveTabs = vi.fn().mockResolvedValue({ succeeded: [], failed: [] })
    const gateway = createStubBrowserGateway({ createWindowWithTab, moveTabs })
    const tabs = [tab({ id: 8 }), tab({ id: 3 }), tab({ id: 11 })]

    const result = await moveSelectionToNewWindow(tabs, gateway)

    expect(moveTabs).not.toHaveBeenCalled()
    expect(result.succeeded).toEqual([])
    expect(result.failed.map((failure) => failure.id).sort((a, b) => a - b)).toEqual([3, 8, 11])
  })

  it('merges moveTabs partial failures into the combined result', async () => {
    const createWindowWithTab = vi.fn().mockResolvedValue({ windowId: 99, tabId: 8 })
    const moveTabs = vi
      .fn()
      .mockResolvedValue({ succeeded: [3], failed: [{ id: 11, message: 'gone' }] })
    const gateway = createStubBrowserGateway({ createWindowWithTab, moveTabs })
    const tabs = [tab({ id: 8 }), tab({ id: 3 }), tab({ id: 11 })]

    const result = await moveSelectionToNewWindow(tabs, gateway)

    expect(result).toEqual({ succeeded: [8, 3], failed: [{ id: 11, message: 'gone' }] })
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
