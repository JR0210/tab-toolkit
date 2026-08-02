import { describe, expect, it } from 'vitest'
import {
  createChromeBrowserApiMock,
  createChromeTab,
  createChromeWindow,
} from '../test/chrome-mocks'
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

describe('createChromeBrowserGateway window and tab creation', () => {
  it('reports a window exists when Chrome resolves it', async () => {
    const { api, getWindow } = createChromeBrowserApiMock()
    const gateway = createChromeBrowserGateway(api)

    await expect(gateway.windowExists(4)).resolves.toBe(true)
    expect(getWindow).toHaveBeenCalledExactlyOnceWith(4)
  })

  it('reports a window does not exist when Chrome rejects the lookup', async () => {
    const { api, getWindow } = createChromeBrowserApiMock()
    getWindow.mockRejectedValue(new Error('No window with id: 4'))
    const gateway = createChromeBrowserGateway(api)

    await expect(gateway.windowExists(4)).resolves.toBe(false)
  })

  it('creates a new window from a URL and returns its window and tab ids', async () => {
    const { api, createWindow } = createChromeBrowserApiMock()
    createWindow.mockResolvedValue(
      createChromeWindow({ id: 55, tabs: [createChromeTab({ id: 66, windowId: 55 })] }),
    )
    const gateway = createChromeBrowserGateway(api)

    const result = await gateway.createWindow('https://example.com')

    expect(createWindow).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ url: 'https://example.com' }),
    )
    expect(result).toEqual({ windowId: 55, tabId: 66 })
  })

  it('falls back to a populated windows.get() when windows.create() does not return the new tab', async () => {
    // windows.create()'s CreateData has no `populate` option, so its result
    // can legitimately omit `tabs` even though the window was created fine.
    const { api, createWindow, getWindow } = createChromeBrowserApiMock()
    createWindow.mockResolvedValue(createChromeWindow({ id: 55, tabs: undefined }))
    getWindow.mockResolvedValue(
      createChromeWindow({ id: 55, tabs: [createChromeTab({ id: 66, windowId: 55 })] }),
    )
    const gateway = createChromeBrowserGateway(api)

    const result = await gateway.createWindow('https://example.com')

    expect(getWindow).toHaveBeenCalledExactlyOnceWith(55, { populate: true })
    expect(result).toEqual({ windowId: 55, tabId: 66 })
  })

  it('rejects when Chrome cannot create the window or its first tab', async () => {
    const { api, createWindow, getWindow } = createChromeBrowserApiMock()
    createWindow.mockResolvedValue(undefined)
    getWindow.mockResolvedValue(createChromeWindow({ tabs: undefined }))
    const gateway = createChromeBrowserGateway(api)

    await expect(gateway.createWindow('https://example.com')).rejects.toThrow()
  })

  it('rejects when the create fallback also cannot find the new tab', async () => {
    const { api, createWindow, getWindow } = createChromeBrowserApiMock()
    createWindow.mockResolvedValue(createChromeWindow({ id: 55, tabs: undefined }))
    getWindow.mockResolvedValue(createChromeWindow({ id: 55, tabs: undefined }))
    const gateway = createChromeBrowserGateway(api)

    await expect(gateway.createWindow('https://example.com')).rejects.toThrow()
  })

  it('creates a tab at a given window and index and returns its id', async () => {
    const { api, createTab } = createChromeBrowserApiMock()
    createTab.mockResolvedValue(createChromeTab({ id: 77, windowId: 9 }))
    const gateway = createChromeBrowserGateway(api)

    const tabId = await gateway.createTab({ windowId: 9, url: 'https://example.com/a', index: 2 })

    expect(createTab).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ windowId: 9, url: 'https://example.com/a', index: 2 }),
    )
    expect(tabId).toBe(77)
  })

  it('groups created tabs and applies the saved title and color', async () => {
    const { api, groupTabs, updateTabGroup } = createChromeBrowserApiMock()
    groupTabs.mockResolvedValue(12)
    const gateway = createChromeBrowserGateway(api)

    await gateway.groupCreatedTabs([1, 2], 9, { title: 'Research', color: 'yellow' })

    expect(groupTabs).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ tabIds: [1, 2], createProperties: { windowId: 9 } }),
    )
    expect(updateTabGroup).toHaveBeenCalledExactlyOnceWith(12, {
      title: 'Research',
      color: 'yellow',
    })
  })

  it('creates a window carrying an existing tab', async () => {
    const { api, createWindow } = createChromeBrowserApiMock()
    createWindow.mockResolvedValue(createChromeWindow({ id: 41 }))
    const gateway = createChromeBrowserGateway(api)

    const result = await gateway.createWindowWithTab(7)

    expect(createWindow).toHaveBeenCalledExactlyOnceWith({
      tabId: 7,
      type: 'normal',
      focused: true,
    })
    expect(result).toEqual({ windowId: 41, tabId: 7 })
  })

  it('rejects createWindowWithTab when Chrome does not return a window id', async () => {
    const { api, createWindow } = createChromeBrowserApiMock()
    createWindow.mockResolvedValue(undefined)
    const gateway = createChromeBrowserGateway(api)

    await expect(gateway.createWindowWithTab(7)).rejects.toThrow()
  })

  it('moves tabs with a single batched call when it succeeds', async () => {
    const { api, moveTabs } = createChromeBrowserApiMock()
    const gateway = createChromeBrowserGateway(api)

    const result = await gateway.moveTabs([1, 2], 9, -1)

    expect(moveTabs).toHaveBeenCalledExactlyOnceWith([1, 2], { windowId: 9, index: -1 })
    expect(result).toEqual({ succeeded: [1, 2], failed: [] })
  })

  it('retries moveTabs per tab when the batched call rejects', async () => {
    const { api, moveTabs } = createChromeBrowserApiMock()
    moveTabs.mockImplementation((tabIds) => {
      if (tabIds.length > 1) {
        return Promise.reject(new Error('batch failed'))
      }
      if (tabIds[0] === 2) {
        return Promise.reject(new Error('No tab with id: 2'))
      }
      return Promise.resolve([])
    })
    const gateway = createChromeBrowserGateway(api)

    const result = await gateway.moveTabs([1, 2], 9, -1)

    expect(result).toEqual({ succeeded: [1], failed: [{ id: 2, message: 'No tab with id: 2' }] })
  })

  it('moves a single tab', async () => {
    const { api, moveTabs } = createChromeBrowserApiMock()
    const gateway = createChromeBrowserGateway(api)

    await gateway.moveTab(3, 9, 2)

    expect(moveTabs).toHaveBeenCalledExactlyOnceWith([3], { windowId: 9, index: 2 })
  })

  it('groups tabs into a new group when no groupId is given', async () => {
    const { api, groupTabs } = createChromeBrowserApiMock()
    groupTabs.mockResolvedValue(5)
    const gateway = createChromeBrowserGateway(api)

    const groupId = await gateway.groupTabs([1, 2], 9)

    expect(groupTabs).toHaveBeenCalledExactlyOnceWith({
      tabIds: [1, 2],
      groupId: undefined,
      createProperties: { windowId: 9 },
    })
    expect(groupId).toBe(5)
  })

  it('adds tabs to an existing group when a groupId is given', async () => {
    const { api, groupTabs } = createChromeBrowserApiMock()
    groupTabs.mockResolvedValue(5)
    const gateway = createChromeBrowserGateway(api)

    await gateway.groupTabs([1, 2], 9, 5)

    expect(groupTabs).toHaveBeenCalledExactlyOnceWith({
      tabIds: [1, 2],
      groupId: 5,
      createProperties: undefined,
    })
  })

  it('updates a group title and color', async () => {
    const { api, updateTabGroup } = createChromeBrowserApiMock()
    const gateway = createChromeBrowserGateway(api)

    await gateway.updateGroup(5, { title: 'Research', color: 'cyan' })

    expect(updateTabGroup).toHaveBeenCalledExactlyOnceWith(5, { title: 'Research', color: 'cyan' })
  })

  it('ungroups tabs', async () => {
    const { api, ungroupTabs } = createChromeBrowserApiMock()
    const gateway = createChromeBrowserGateway(api)

    await gateway.ungroupTabs([1, 2])

    expect(ungroupTabs).toHaveBeenCalledExactlyOnceWith([1, 2])
  })

  it('does nothing when ungrouping an empty list', async () => {
    const { api, ungroupTabs } = createChromeBrowserApiMock()
    const gateway = createChromeBrowserGateway(api)

    await gateway.ungroupTabs([])

    expect(ungroupTabs).not.toHaveBeenCalled()
  })
})
