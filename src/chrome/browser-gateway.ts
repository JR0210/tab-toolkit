import type { TabSnapshot } from '../domain/browser'
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
  }
  tabGroups: {
    query(queryInfo: chrome.tabGroups.QueryInfo): Promise<chrome.tabGroups.TabGroup[]>
  }
}

export interface BrowserGateway {
  getSnapshot(): Promise<TabSnapshot>
  activateTab(tabId: number, windowId: number): Promise<void>
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
  }
}

function hasNumericTabIdentifiers(
  tab: chrome.tabs.Tab,
): tab is chrome.tabs.Tab & { id: number; windowId: number } {
  return typeof tab.id === 'number' && typeof tab.windowId === 'number'
}
