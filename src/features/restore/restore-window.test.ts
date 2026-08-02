import { describe, expect, it, vi } from 'vitest'
import { createStubBrowserGateway } from '../../test/browser-gateway-mock'
import { restoreIntoNewWindow } from './restore-window'
import type { TabDescriptor } from '../../domain/browser'

describe('restoreIntoNewWindow', () => {
  it('creates a new window from the first descriptor and the rest as inactive tabs in order', async () => {
    const createWindow = vi.fn().mockResolvedValue({ windowId: 9, tabId: 201 })
    const createTab = vi.fn().mockResolvedValueOnce(202).mockResolvedValueOnce(203)
    const gateway = createStubBrowserGateway({ createWindow, createTab })
    const descriptors = [
      descriptor({ url: 'https://first.example' }),
      descriptor({ url: 'https://second.example' }),
      descriptor({ url: 'https://third.example' }),
    ]

    const result = await restoreIntoNewWindow(descriptors, gateway)

    expect(createWindow).toHaveBeenCalledExactlyOnceWith('https://first.example')
    expect(createTab).toHaveBeenNthCalledWith(1, {
      windowId: 9,
      url: 'https://second.example',
      index: 1,
    })
    expect(createTab).toHaveBeenNthCalledWith(2, {
      windowId: 9,
      url: 'https://third.example',
      index: 2,
    })
    expect(result.windowId).toBe(9)
    expect(result.created).toEqual([
      { descriptorIndex: 0, tabId: 201 },
      { descriptorIndex: 1, tabId: 202 },
      { descriptorIndex: 2, tabId: 203 },
    ])
    expect(result.failed).toEqual([])
  })

  it('applies pinned state only after every tab has been created', async () => {
    const calls: string[] = []
    const createWindow = vi.fn().mockImplementation(async () => {
      calls.push('createWindow')
      return { windowId: 9, tabId: 301 }
    })
    const createTab = vi.fn().mockImplementation(async () => {
      calls.push('createTab')
      return 302
    })
    const setPinned = vi.fn().mockImplementation(async (ids: number[]) => {
      calls.push(`setPinned:${ids.join(',')}`)
      return { succeeded: ids, failed: [] }
    })
    const gateway = createStubBrowserGateway({ createWindow, createTab, setPinned })
    const descriptors = [
      descriptor({ url: 'https://first.example', pinned: true }),
      descriptor({ url: 'https://second.example', pinned: true }),
    ]

    await restoreIntoNewWindow(descriptors, gateway)

    expect(calls).toEqual(['createWindow', 'createTab', 'setPinned:301', 'setPinned:302'])
  })

  it('does not apply pinned state for descriptors that were not pinned', async () => {
    const setPinned = vi.fn().mockResolvedValue({ succeeded: [], failed: [] })
    const gateway = createStubBrowserGateway({
      createWindow: vi.fn().mockResolvedValue({ windowId: 9, tabId: 301 }),
      setPinned,
    })
    const descriptors = [descriptor({ url: 'https://first.example', pinned: false })]

    await restoreIntoNewWindow(descriptors, gateway)

    expect(setPinned).not.toHaveBeenCalled()
  })

  it('partitions groups by the exact {title, color} pair, applied after all tabs are created', async () => {
    const groupCreatedTabs = vi.fn().mockResolvedValue(undefined)
    const createWindow = vi.fn().mockResolvedValue({ windowId: 9, tabId: 401 })
    const createTab = vi.fn().mockResolvedValueOnce(402).mockResolvedValueOnce(403)
    const gateway = createStubBrowserGateway({ createWindow, createTab, groupCreatedTabs })
    const descriptors = [
      descriptor({ url: 'https://one.example', group: { title: 'Research', color: 'yellow' } }),
      descriptor({ url: 'https://ungrouped.example' }),
      descriptor({ url: 'https://two.example', group: { title: 'Research', color: 'yellow' } }),
    ]

    const result = await restoreIntoNewWindow(descriptors, gateway)

    expect(groupCreatedTabs).toHaveBeenCalledExactlyOnceWith([401, 403], 9, {
      title: 'Research',
      color: 'yellow',
    })
    expect(result.created.map((tab) => tab.tabId)).toEqual([401, 402, 403])
  })

  it('starts a separate group when the title or color differs', async () => {
    const groupCreatedTabs = vi.fn().mockResolvedValue(undefined)
    const createWindow = vi.fn().mockResolvedValue({ windowId: 9, tabId: 501 })
    const createTab = vi.fn().mockResolvedValueOnce(502)
    const gateway = createStubBrowserGateway({ createWindow, createTab, groupCreatedTabs })
    const descriptors = [
      descriptor({ url: 'https://one.example', group: { title: 'Research', color: 'yellow' } }),
      descriptor({ url: 'https://two.example', group: { title: 'Research', color: 'blue' } }),
    ]

    await restoreIntoNewWindow(descriptors, gateway)

    expect(groupCreatedTabs).toHaveBeenCalledTimes(2)
    expect(groupCreatedTabs).toHaveBeenNthCalledWith(1, [501], 9, {
      title: 'Research',
      color: 'yellow',
    })
    expect(groupCreatedTabs).toHaveBeenNthCalledWith(2, [502], 9, {
      title: 'Research',
      color: 'blue',
    })
  })

  it('tolerates one failed descriptor creation without aborting the rest, keeping original descriptor indices', async () => {
    const createWindow = vi.fn().mockResolvedValue({ windowId: 9, tabId: 601 })
    const createTab = vi
      .fn()
      .mockResolvedValueOnce(602) // descriptor index 1
      .mockRejectedValueOnce(new Error('Chrome refused')) // descriptor index 2
      .mockResolvedValueOnce(604) // descriptor index 3
      .mockResolvedValueOnce(605) // descriptor index 4
    const setPinned = vi.fn().mockResolvedValue({ succeeded: [], failed: [] })
    const gateway = createStubBrowserGateway({ createWindow, createTab, setPinned })
    const descriptors = [
      descriptor({ url: 'https://zero.example' }),
      descriptor({ url: 'https://one.example' }),
      descriptor({ url: 'https://two.example' }),
      descriptor({ url: 'https://three.example', pinned: true }),
      descriptor({ url: 'https://four.example' }),
    ]

    const result = await restoreIntoNewWindow(descriptors, gateway)

    expect(createTab).toHaveBeenCalledTimes(4)
    expect(result.created).toEqual([
      { descriptorIndex: 0, tabId: 601 },
      { descriptorIndex: 1, tabId: 602 },
      { descriptorIndex: 3, tabId: 604 },
      { descriptorIndex: 4, tabId: 605 },
    ])
    expect(result.failed).toEqual([{ descriptorIndex: 2, message: 'Chrome refused' }])
    // Pin command only issued for the tab that was actually created (index 3 -> tabId 604).
    expect(setPinned).toHaveBeenCalledExactlyOnceWith([604], true)
  })

  it('fails every descriptor without attempting any of them when the first (window-creating) descriptor fails', async () => {
    const createWindow = vi.fn().mockRejectedValue(new Error('No window for you'))
    const createTab = vi.fn()
    const gateway = createStubBrowserGateway({ createWindow, createTab })
    const descriptors = [
      descriptor({ url: 'https://zero.example' }),
      descriptor({ url: 'https://one.example' }),
      descriptor({ url: 'https://two.example' }),
    ]

    const result = await restoreIntoNewWindow(descriptors, gateway)

    expect(createTab).not.toHaveBeenCalled()
    expect(result.windowId).toBeUndefined()
    expect(result.created).toEqual([])
    expect(result.failed).toEqual([
      { descriptorIndex: 0, message: 'No window for you' },
      { descriptorIndex: 1, message: 'No window for you' },
      { descriptorIndex: 2, message: 'No window for you' },
    ])
  })
})

function descriptor(overrides: Partial<TabDescriptor> & Pick<TabDescriptor, 'url'>): TabDescriptor {
  return {
    title: 'Untitled tab',
    pinned: false,
    ...overrides,
  }
}
