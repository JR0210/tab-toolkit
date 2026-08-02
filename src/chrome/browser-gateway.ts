import type { BulkResult, TabGroupColor, TabSnapshot } from '../domain/browser'
import { runBulk } from '../features/tabs/bulk-result'
import type { PlatformFamily } from '../platform/platform'
import { toPlatformFamily } from '../platform/platform'
import { mapChromeTab, mapChromeTabGroup } from './tab-mapper'

export interface ChromeBrowserApi {
  runtime: {
    getPlatformInfo(): Promise<chrome.runtime.PlatformInfo>
  }
  windows: {
    getAll(options: chrome.windows.QueryOptions): Promise<chrome.windows.Window[]>
    getCurrent(): Promise<chrome.windows.Window>
    update(windowId: number, updateInfo: chrome.windows.UpdateInfo): Promise<chrome.windows.Window>
    get(
      windowId: number,
      queryOptions?: chrome.windows.QueryOptions,
    ): Promise<chrome.windows.Window>
    create(createData: chrome.windows.CreateData): Promise<chrome.windows.Window | undefined>
  }
  tabs: {
    update(
      tabId: number,
      updateInfo: chrome.tabs.UpdateProperties,
    ): Promise<chrome.tabs.Tab | undefined>
    reload(tabId: number, reloadProperties?: chrome.tabs.ReloadProperties): Promise<void>
    discard(tabId: number): Promise<chrome.tabs.Tab | undefined>
    remove(tabIds: number | number[]): Promise<void>
    create(createProperties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab>
    group(options: chrome.tabs.GroupOptions): Promise<number>
    move(tabIds: number[], moveProperties: chrome.tabs.MoveProperties): Promise<chrome.tabs.Tab[]>
    ungroup(tabIds: number | [number, ...number[]]): Promise<void>
  }
  tabGroups: {
    query(queryInfo: chrome.tabGroups.QueryInfo): Promise<chrome.tabGroups.TabGroup[]>
    update(
      groupId: number,
      updateProperties: chrome.tabGroups.UpdateProperties,
    ): Promise<chrome.tabGroups.TabGroup | undefined>
  }
}

export interface BrowserGateway {
  getPlatformInfo(): Promise<PlatformFamily>
  getSnapshot(): Promise<TabSnapshot>
  activateTab(tabId: number, windowId: number): Promise<void>
  setPinned(ids: readonly number[], pinned: boolean): Promise<BulkResult>
  setMuted(ids: readonly number[], muted: boolean): Promise<BulkResult>
  reloadTabs(ids: readonly number[]): Promise<BulkResult>
  discardTabs(ids: readonly number[]): Promise<BulkResult>
  removeTabs(ids: readonly number[]): Promise<BulkResult>
  windowExists(windowId: number): Promise<boolean>
  createWindow(url: string): Promise<{ windowId: number; tabId: number }>
  createTab(options: { windowId: number; url: string; index: number }): Promise<number>
  groupCreatedTabs(
    tabIds: readonly number[],
    windowId: number,
    group: { title: string; color: TabGroupColor },
  ): Promise<void>
  createWindowWithTab(tabId: number): Promise<{ windowId: number; tabId: number }>
  moveTabs(tabIds: readonly number[], windowId: number, index: number): Promise<BulkResult>
  moveTab(tabId: number, windowId: number, index: number): Promise<void>
  groupTabs(tabIds: readonly number[], windowId: number, groupId?: number): Promise<number>
  updateGroup(groupId: number, update: { title: string; color: TabGroupColor }): Promise<void>
  ungroupTabs(tabIds: readonly number[]): Promise<void>
}

export function createChromeBrowserGateway(chrome: ChromeBrowserApi): BrowserGateway {
  return {
    async getPlatformInfo() {
      try {
        const info = await chrome.runtime.getPlatformInfo()
        return toPlatformFamily(info)
      } catch {
        // Never let a rejected/unsupported getPlatformInfo() call default to
        // 'mac' -- an unknown platform should always render the non-mac
        // (Ctrl/Delete) labels, not accidentally show Command.
        return 'non-mac'
      }
    },
    async getSnapshot() {
      const [windows, currentWindow, groups] = await Promise.all([
        chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }),
        chrome.windows.getCurrent(),
        chrome.tabGroups.query({}),
      ])

      return {
        tabs: windows
          .flatMap((window) => window.tabs ?? [])
          .filter(hasNumericTabIdentifiers)
          .map(mapChromeTab),
        groups: groups.map(mapChromeTabGroup),
        currentWindowId: typeof currentWindow.id === 'number' ? currentWindow.id : null,
        capturedAt: Date.now(),
      }
    },
    async activateTab(tabId, windowId) {
      await chrome.tabs.update(tabId, { active: true })
      await chrome.windows.update(windowId, { focused: true })
    },
    setPinned(ids, pinned) {
      return runBulk(ids, async (id) => {
        await chrome.tabs.update(id, { pinned })
      })
    },
    setMuted(ids, muted) {
      return runBulk(ids, async (id) => {
        await chrome.tabs.update(id, { muted })
      })
    },
    reloadTabs(ids) {
      return runBulk(ids, async (id) => {
        await chrome.tabs.reload(id)
      })
    },
    discardTabs(ids) {
      return runBulk(ids, async (id) => {
        await chrome.tabs.discard(id)
      })
    },
    async removeTabs(ids) {
      if (ids.length === 0) {
        return { succeeded: [], failed: [] }
      }

      try {
        await chrome.tabs.remove([...ids])
        return { succeeded: [...ids], failed: [] }
      } catch {
        // A single bad id can reject the whole batch even though most ids
        // were valid, so retry one at a time to isolate the real failures.
        return runBulk(ids, async (id) => {
          await chrome.tabs.remove(id)
        })
      }
    },
    async windowExists(windowId) {
      try {
        await chrome.windows.get(windowId)
        return true
      } catch {
        return false
      }
    },
    async createWindow(url) {
      const window = await chrome.windows.create({ url, focused: false })

      if (!window || typeof window.id !== 'number') {
        throw new Error('Chrome did not create the restored window')
      }

      // windows.create()'s CreateData has no `populate` option (unlike
      // windows.get()/getAll()), so its result doesn't reliably include the
      // tab it just created. Fall back to a populated windows.get() instead
      // of assuming creation failed.
      const tab =
        window.tabs?.[0] ?? (await chrome.windows.get(window.id, { populate: true })).tabs?.[0]

      if (!tab || typeof tab.id !== 'number') {
        throw new Error('Chrome did not create the restored window')
      }

      return { windowId: window.id, tabId: tab.id }
    },
    async createTab({ windowId, url, index }) {
      const tab = await chrome.tabs.create({ windowId, url, index, active: false })

      if (typeof tab.id !== 'number') {
        throw new Error('Chrome did not create the restored tab')
      }

      return tab.id
    },
    async groupCreatedTabs(tabIds, windowId, group) {
      if (tabIds.length === 0) {
        return
      }

      const groupId = await chrome.tabs.group({
        tabIds: [tabIds[0], ...tabIds.slice(1)] as [number, ...number[]],
        createProperties: { windowId },
      })
      await chrome.tabGroups.update(groupId, { title: group.title, color: group.color })
    },
    async createWindowWithTab(tabId) {
      const window = await chrome.windows.create({ tabId, type: 'normal', focused: true })

      if (!window || typeof window.id !== 'number') {
        throw new Error('Chrome did not create the new window')
      }

      return { windowId: window.id, tabId }
    },
    async moveTabs(tabIds, windowId, index) {
      if (tabIds.length === 0) {
        return { succeeded: [], failed: [] }
      }

      try {
        await chrome.tabs.move([...tabIds], { windowId, index })
        return { succeeded: [...tabIds], failed: [] }
      } catch {
        // Mirrors removeTabs: a single bad id can reject the whole batch, so
        // retry one at a time to isolate the real failures. For a specific
        // target index (not -1/"append"), each successful single move must
        // target the next index along -- moving every tab to the SAME fixed
        // index would insert each one ahead of the last, reversing order.
        let nextIndex = index

        return runBulk(tabIds, async (id) => {
          await chrome.tabs.move([id], { windowId, index: nextIndex })

          if (index !== -1) {
            nextIndex += 1
          }
        })
      }
    },
    async moveTab(tabId, windowId, index) {
      await chrome.tabs.move([tabId], { windowId, index })
    },
    async groupTabs(tabIds, windowId, groupId) {
      if (tabIds.length === 0) {
        throw new Error('Cannot group zero tabs')
      }

      const [first, ...rest] = tabIds

      return chrome.tabs.group({
        tabIds: [first, ...rest],
        groupId,
        createProperties: groupId === undefined ? { windowId } : undefined,
      })
    },
    async updateGroup(groupId, update) {
      await chrome.tabGroups.update(groupId, { title: update.title, color: update.color })
    },
    async ungroupTabs(tabIds) {
      if (tabIds.length === 0) {
        return
      }

      await chrome.tabs.ungroup([tabIds[0], ...tabIds.slice(1)] as [number, ...number[]])
    },
  }
}

function hasNumericTabIdentifiers(
  tab: chrome.tabs.Tab,
): tab is chrome.tabs.Tab & { id: number; windowId: number } {
  return typeof tab.id === 'number' && typeof tab.windowId === 'number'
}
