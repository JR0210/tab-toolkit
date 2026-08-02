import { describe, expect, it, vi } from 'vitest'
import { createStubBrowserGateway } from '../../test/browser-gateway-mock'
import type { TabGroupRecord, TabRecord } from '../../domain/browser'
import { closeTabs, undoClose } from './tab-lifecycle-service'
import type { CloseRepository, CloseSnapshot } from './close-repository'

describe('closeTabs', () => {
  it('saves a recovery snapshot before removing the tabs, then removes them', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const removeTabs = vi.fn().mockResolvedValue({ succeeded: [1, 2], failed: [] })
    const gateway = createStubBrowserGateway({ removeTabs })
    const repository = createRepository({ save })
    const tabs = [createTab({ id: 1 }), createTab({ id: 2, windowId: 3, index: 1 })]

    const result = await closeTabs(tabs, new Map(), gateway, repository)

    expect(save).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        tabs: [
          expect.objectContaining({ url: tabs[0].url, windowId: 1, index: 0 }),
          expect.objectContaining({ url: tabs[1].url, windowId: 3, index: 1 }),
        ],
      }),
    )
    expect(removeTabs).toHaveBeenCalledExactlyOnceWith([1, 2])
    expect(result).toEqual({ succeeded: [1, 2], failed: [] })
  })

  it('never removes tabs when the recovery snapshot fails to save', async () => {
    // Guards the promise that a close advertised as undoable actually has
    // recovery data: if we can't record it, we must not remove the tabs.
    const save = vi.fn().mockRejectedValue(new Error('storage unavailable'))
    const removeTabs = vi.fn().mockResolvedValue({ succeeded: [1], failed: [] })
    const gateway = createStubBrowserGateway({ removeTabs })
    const repository = createRepository({ save })
    const tabs = [createTab({ id: 1 })]

    await expect(closeTabs(tabs, new Map(), gateway, repository)).rejects.toThrow(
      'storage unavailable',
    )

    expect(removeTabs).not.toHaveBeenCalled()
  })

  it('resolves each tab group from the provided groupsById map', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const gateway = createStubBrowserGateway({
      removeTabs: vi.fn().mockResolvedValue({ succeeded: [1], failed: [] }),
    })
    const repository = createRepository({ save })
    const groupsById = new Map<number, TabGroupRecord>([
      [9, { id: 9, windowId: 1, title: 'Research', color: 'yellow' }],
    ])
    const tabs = [createTab({ id: 1, groupId: 9 })]

    await closeTabs(tabs, groupsById, gateway, repository)

    expect(save).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        tabs: [expect.objectContaining({ group: { title: 'Research', color: 'yellow' } })],
      }),
    )
  })
})

describe('undoClose', () => {
  it('returns an empty result when there is nothing to restore', async () => {
    const gateway = createStubBrowserGateway()
    const repository = createRepository({ load: vi.fn().mockResolvedValue(null) })

    const result = await undoClose(gateway, repository)

    expect(result).toEqual({ succeeded: [], failed: [] })
  })

  it('restores the saved snapshot and clears it only after the restore attempt completes', async () => {
    const clear = vi.fn().mockResolvedValue(undefined)
    const snapshot = createSnapshot()
    const load = vi.fn().mockResolvedValue(snapshot)
    const createTab = vi.fn().mockResolvedValue(55)
    const gateway = createStubBrowserGateway({
      windowExists: vi.fn().mockResolvedValue(true),
      createTab,
    })
    const repository = createRepository({ load, clear })

    const result = await undoClose(gateway, repository)

    expect(createTab).toHaveBeenCalled()
    expect(clear).toHaveBeenCalledTimes(1)
    expect(result.succeeded).toEqual([55])
  })

  it('still clears the snapshot even when the restore only partially succeeds', async () => {
    const clear = vi.fn().mockResolvedValue(undefined)
    const snapshot = createSnapshot()
    const load = vi.fn().mockResolvedValue(snapshot)
    const createTab = vi.fn().mockRejectedValue(new Error('Chrome refused'))
    const gateway = createStubBrowserGateway({
      windowExists: vi.fn().mockResolvedValue(true),
      createTab,
    })
    const repository = createRepository({ load, clear })

    const result = await undoClose(gateway, repository)

    expect(clear).toHaveBeenCalledTimes(1)
    expect(result.failed).toHaveLength(1)
  })
})

function createRepository(overrides: Partial<CloseRepository> = {}): CloseRepository {
  return {
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function createSnapshot(): CloseSnapshot {
  return {
    closedAt: 1000,
    tabs: [{ url: 'https://example.com', title: 'Example', pinned: false, windowId: 1, index: 0 }],
  }
}

function createTab(overrides: Partial<TabRecord> & { id: number }): TabRecord {
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
