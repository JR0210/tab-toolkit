import { describe, expect, it, vi } from 'vitest'
import { createStubBrowserGateway } from '../../test/browser-gateway-mock'
import { restoreDescriptors } from './restore-descriptors'
import type { CloseSnapshot } from './close-repository'

describe('restoreDescriptors', () => {
  it('restores tabs into the original window at ascending saved indices when it still exists', async () => {
    const windowExists = vi.fn().mockResolvedValue(true)
    const createTab = vi.fn().mockResolvedValueOnce(101).mockResolvedValueOnce(102)
    const gateway = createStubBrowserGateway({ windowExists, createTab })
    const snapshot = createSnapshot([
      descriptor({ url: 'https://b.example', windowId: 5, index: 3 }),
      descriptor({ url: 'https://a.example', windowId: 5, index: 1 }),
    ])

    const result = await restoreDescriptors(snapshot, gateway)

    expect(windowExists).toHaveBeenCalledExactlyOnceWith(5)
    expect(createTab).toHaveBeenNthCalledWith(1, {
      windowId: 5,
      url: 'https://a.example',
      index: 1,
    })
    expect(createTab).toHaveBeenNthCalledWith(2, {
      windowId: 5,
      url: 'https://b.example',
      index: 3,
    })
    expect(result).toEqual({ succeeded: [101, 102], failed: [] })
  })

  it('creates one new window from the first safe URL when the original window is gone, then creates the rest into it', async () => {
    const windowExists = vi.fn().mockResolvedValue(false)
    const createWindow = vi.fn().mockResolvedValue({ windowId: 9, tabId: 201 })
    const createTab = vi.fn().mockResolvedValue(202)
    const gateway = createStubBrowserGateway({ windowExists, createWindow, createTab })
    const snapshot = createSnapshot([
      descriptor({ url: 'https://first.example', windowId: 5, index: 0 }),
      descriptor({ url: 'https://second.example', windowId: 5, index: 1 }),
    ])

    const result = await restoreDescriptors(snapshot, gateway)

    expect(createWindow).toHaveBeenCalledExactlyOnceWith('https://first.example')
    expect(createTab).toHaveBeenCalledExactlyOnceWith({
      windowId: 9,
      url: 'https://second.example',
      index: 1,
    })
    expect(result).toEqual({ succeeded: [201, 202], failed: [] })
  })

  it('rejects empty or non-web URLs as failures without attempting to recreate them', async () => {
    const createTab = vi.fn().mockResolvedValue(999)
    const gateway = createStubBrowserGateway({
      windowExists: vi.fn().mockResolvedValue(true),
      createTab,
    })
    const snapshot = createSnapshot([
      descriptor({ url: '', windowId: 5, index: 0 }),
      descriptor({ url: 'chrome://settings', windowId: 5, index: 1 }),
      descriptor({ url: 'https://ok.example', windowId: 5, index: 2 }),
    ])

    const result = await restoreDescriptors(snapshot, gateway)

    expect(createTab).toHaveBeenCalledExactlyOnceWith({
      windowId: 5,
      url: 'https://ok.example',
      index: 2,
    })
    expect(result.succeeded).toEqual([999])
    expect(result.failed).toHaveLength(2)
    expect(result.failed.map((failure) => failure.id)).toEqual([0, 1])
  })

  it('restores pinned state after the tab exists', async () => {
    const setPinned = vi.fn().mockResolvedValue({ succeeded: [301], failed: [] })
    const gateway = createStubBrowserGateway({
      windowExists: vi.fn().mockResolvedValue(true),
      createTab: vi.fn().mockResolvedValue(301),
      setPinned,
    })
    const snapshot = createSnapshot([
      descriptor({ url: 'https://pinned.example', windowId: 5, index: 0, pinned: true }),
    ])

    await restoreDescriptors(snapshot, gateway)

    expect(setPinned).toHaveBeenCalledExactlyOnceWith([301], true)
  })

  it('does not restore pinned state for tabs that were not pinned', async () => {
    const setPinned = vi.fn().mockResolvedValue({ succeeded: [], failed: [] })
    const gateway = createStubBrowserGateway({
      windowExists: vi.fn().mockResolvedValue(true),
      createTab: vi.fn().mockResolvedValue(301),
      setPinned,
    })
    const snapshot = createSnapshot([
      descriptor({ url: 'https://unpinned.example', windowId: 5, index: 0, pinned: false }),
    ])

    await restoreDescriptors(snapshot, gateway)

    expect(setPinned).not.toHaveBeenCalled()
  })

  it('restores group metadata for distinct groups only after all their tabs exist', async () => {
    const groupCreatedTabs = vi.fn().mockResolvedValue(undefined)
    const createTab = vi
      .fn()
      .mockResolvedValueOnce(401)
      .mockResolvedValueOnce(402)
      .mockResolvedValueOnce(403)
    const gateway = createStubBrowserGateway({
      windowExists: vi.fn().mockResolvedValue(true),
      createTab,
      groupCreatedTabs,
    })
    const snapshot = createSnapshot([
      descriptor({
        url: 'https://one.example',
        windowId: 5,
        index: 0,
        group: { title: 'Research', color: 'yellow' },
      }),
      descriptor({ url: 'https://ungrouped.example', windowId: 5, index: 1 }),
      descriptor({
        url: 'https://two.example',
        windowId: 5,
        index: 2,
        group: { title: 'Research', color: 'yellow' },
      }),
    ])

    const result = await restoreDescriptors(snapshot, gateway)

    expect(groupCreatedTabs).toHaveBeenCalledExactlyOnceWith([401, 403], 5, {
      title: 'Research',
      color: 'yellow',
    })
    expect(result.succeeded).toEqual([401, 402, 403])
  })

  it('reports a failure for a tab that could not be recreated without aborting the rest', async () => {
    const createTab = vi
      .fn()
      .mockResolvedValueOnce(501)
      .mockRejectedValueOnce(new Error('Chrome refused'))
    const gateway = createStubBrowserGateway({
      windowExists: vi.fn().mockResolvedValue(true),
      createTab,
    })
    const snapshot = createSnapshot([
      descriptor({ url: 'https://ok.example', windowId: 5, index: 0 }),
      descriptor({ url: 'https://bad.example', windowId: 5, index: 1 }),
    ])

    const result = await restoreDescriptors(snapshot, gateway)

    expect(result.succeeded).toEqual([501])
    expect(result.failed).toEqual([{ id: 1, message: 'Chrome refused' }])
  })
})

function createSnapshot(tabs: CloseSnapshot['tabs']): CloseSnapshot {
  return { closedAt: 1000, tabs }
}

function descriptor(
  overrides: Partial<CloseSnapshot['tabs'][number]> &
    Pick<CloseSnapshot['tabs'][number], 'url' | 'windowId' | 'index'>,
): CloseSnapshot['tabs'][number] {
  return {
    title: 'Untitled tab',
    pinned: false,
    ...overrides,
  }
}
