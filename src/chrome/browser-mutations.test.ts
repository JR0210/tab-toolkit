import { describe, expect, it } from 'vitest'
import { createChromeBrowserApiMock } from '../test/chrome-mocks'
import { createChromeBrowserGateway } from './browser-gateway'

describe('createChromeBrowserGateway tab mutations', () => {
  it('pins tabs individually and reports which ones failed', async () => {
    const { api, updateTab } = createChromeBrowserApiMock()
    updateTab.mockImplementation((tabId) => {
      if (tabId === 2) {
        return Promise.reject(new Error('No tab with id: 2'))
      }
      return Promise.resolve(undefined)
    })
    const gateway = createChromeBrowserGateway(api)

    const result = await gateway.setPinned([1, 2, 3], true)

    expect(updateTab).toHaveBeenNthCalledWith(1, 1, { pinned: true })
    expect(updateTab).toHaveBeenNthCalledWith(2, 2, { pinned: true })
    expect(updateTab).toHaveBeenNthCalledWith(3, 3, { pinned: true })
    expect(result).toEqual({ succeeded: [1, 3], failed: [{ id: 2, message: 'No tab with id: 2' }] })
  })

  it('unpins tabs by passing pinned: false', async () => {
    const { api, updateTab } = createChromeBrowserApiMock()
    const gateway = createChromeBrowserGateway(api)

    await gateway.setPinned([9], false)

    expect(updateTab).toHaveBeenCalledExactlyOnceWith(9, { pinned: false })
  })

  it('mutes and unmutes tabs', async () => {
    const { api, updateTab } = createChromeBrowserApiMock()
    const gateway = createChromeBrowserGateway(api)

    await gateway.setMuted([4], true)

    expect(updateTab).toHaveBeenCalledExactlyOnceWith(4, { muted: true })
  })

  it('reloads tabs and reports failures', async () => {
    const { api, reloadTab } = createChromeBrowserApiMock()
    reloadTab.mockImplementation((tabId) => {
      if (tabId === 7) {
        return Promise.reject(new Error('No tab with id: 7'))
      }
      return Promise.resolve(undefined)
    })
    const gateway = createChromeBrowserGateway(api)

    const result = await gateway.reloadTabs([6, 7])

    expect(reloadTab).toHaveBeenCalledWith(6)
    expect(reloadTab).toHaveBeenCalledWith(7)
    expect(result).toEqual({ succeeded: [6], failed: [{ id: 7, message: 'No tab with id: 7' }] })
  })

  it('discards tabs and reports failures', async () => {
    const { api, discardTab } = createChromeBrowserApiMock()
    discardTab.mockImplementation((tabId) => {
      if (tabId === 8) {
        return Promise.reject(new Error('Cannot discard active tab'))
      }
      return Promise.resolve(undefined)
    })
    const gateway = createChromeBrowserGateway(api)

    const result = await gateway.discardTabs([5, 8])

    expect(discardTab).toHaveBeenCalledWith(5)
    expect(discardTab).toHaveBeenCalledWith(8)
    expect(result).toEqual({
      succeeded: [5],
      failed: [{ id: 8, message: 'Cannot discard active tab' }],
    })
  })

  it('removes tabs with a single batched call when it succeeds', async () => {
    const { api, removeTabs } = createChromeBrowserApiMock()
    const gateway = createChromeBrowserGateway(api)

    const result = await gateway.removeTabs([1, 2, 3])

    expect(removeTabs).toHaveBeenCalledExactlyOnceWith([1, 2, 3])
    expect(result).toEqual({ succeeded: [1, 2, 3], failed: [] })
  })

  it('retries removal per tab when the batched call rejects, to isolate the bad id', async () => {
    const { api, removeTabs } = createChromeBrowserApiMock()
    let batchAttempted = false
    removeTabs.mockImplementation((tabIds) => {
      if (Array.isArray(tabIds)) {
        batchAttempted = true
        return Promise.reject(new Error('No tab with id: 2'))
      }
      if (tabIds === 2) {
        return Promise.reject(new Error('No tab with id: 2'))
      }
      return Promise.resolve(undefined)
    })
    const gateway = createChromeBrowserGateway(api)

    const result = await gateway.removeTabs([1, 2, 3])

    expect(batchAttempted).toBe(true)
    expect(removeTabs).toHaveBeenCalledWith([1, 2, 3])
    expect(removeTabs).toHaveBeenCalledWith(1)
    expect(removeTabs).toHaveBeenCalledWith(2)
    expect(removeTabs).toHaveBeenCalledWith(3)
    expect(result).toEqual({ succeeded: [1, 3], failed: [{ id: 2, message: 'No tab with id: 2' }] })
  })

  it('returns an empty result without calling Chrome when given no ids to remove', async () => {
    const { api, removeTabs } = createChromeBrowserApiMock()
    const gateway = createChromeBrowserGateway(api)

    const result = await gateway.removeTabs([])

    expect(removeTabs).not.toHaveBeenCalled()
    expect(result).toEqual({ succeeded: [], failed: [] })
  })
})
