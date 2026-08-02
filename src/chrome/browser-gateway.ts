import type { BulkResult, TabSnapshot } from '../domain/browser'
import { runBulk } from '../features/tabs/bulk-result'
import { mapChromeTab, mapChromeTabGroup } from './tab-mapper'

export interface ChromeBrowserApi {
  windows: {
    getAll(options: chrome.windows.QueryOptions): Promise<chrome.windows.Window[]>
    getCurrent(): Promise<chrome.windows.Window>
    update(windowId: number, updateInfo: chrome.windows.UpdateInfo): Promise<chrome.windows.Window>
  }
  tabs: {
    update(
      tabId: number,
      updateInfo: chrome.tabs.UpdateProperties,
    ): Promise<chrome.tabs.Tab | undefined>
    reload(tabId: number, reloadProperties?: chrome.tabs.ReloadProperties): Promise<void>
    discard(tabId: number): Promise<chrome.tabs.Tab | undefined>
    remove(tabIds: number | number[]): Promise<void>
  }
  tabGroups: {
    query(queryInfo: chrome.tabGroups.QueryInfo): Promise<chrome.tabGroups.TabGroup[]>
  }
}

export interface BrowserGateway {
  getSnapshot(): Promise<TabSnapshot>
  activateTab(tabId: number, windowId: number): Promise<void>
  setPinned(ids: readonly number[], pinned: boolean): Promise<BulkResult>
  setMuted(ids: readonly number[], muted: boolean): Promise<BulkResult>
  reloadTabs(ids: readonly number[]): Promise<BulkResult>
  discardTabs(ids: readonly number[]): Promise<BulkResult>
  removeTabs(ids: readonly number[]): Promise<BulkResult>
}

export function createChromeBrowserGateway(chrome: ChromeBrowserApi): BrowserGateway {
  return {
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
  }
}

function hasNumericTabIdentifiers(
  tab: chrome.tabs.Tab,
): tab is chrome.tabs.Tab & { id: number; windowId: number } {
  return typeof tab.id === 'number' && typeof tab.windowId === 'number'
}
