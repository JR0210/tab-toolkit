import { vi } from 'vitest'
import type { ChromeBrowserApi } from '../chrome/browser-gateway'

export function createChromeTab(overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab {
  return {
    id: 1,
    index: 0,
    pinned: false,
    highlighted: false,
    windowId: 1,
    active: false,
    frozen: false,
    incognito: false,
    selected: false,
    discarded: false,
    autoDiscardable: true,
    groupId: -1,
    lastAccessed: 0,
    ...overrides,
  }
}

export function createChromeWindow(
  overrides: Partial<chrome.windows.Window> = {},
): chrome.windows.Window {
  return {
    id: 1,
    focused: true,
    alwaysOnTop: false,
    incognito: false,
    tabs: [],
    ...overrides,
  }
}

export function createChromeTabGroup(
  overrides: Partial<chrome.tabGroups.TabGroup> = {},
): chrome.tabGroups.TabGroup {
  return {
    id: 1,
    windowId: 1,
    collapsed: false,
    color: 'blue',
    shared: false,
    ...overrides,
  }
}

export function createChromeBrowserApiMock() {
  const getAll = vi.fn<ChromeBrowserApi['windows']['getAll']>().mockResolvedValue([])
  const getCurrent = vi
    .fn<ChromeBrowserApi['windows']['getCurrent']>()
    .mockResolvedValue(createChromeWindow())
  const updateWindow = vi
    .fn<ChromeBrowserApi['windows']['update']>()
    .mockResolvedValue(createChromeWindow())
  const updateTab = vi.fn<ChromeBrowserApi['tabs']['update']>().mockResolvedValue(createChromeTab())
  const queryTabGroups = vi.fn<ChromeBrowserApi['tabGroups']['query']>().mockResolvedValue([])

  return {
    api: {
      windows: {
        getAll,
        getCurrent,
        update: updateWindow,
      },
      tabs: {
        update: updateTab,
      },
      tabGroups: {
        query: queryTabGroups,
      },
    },
    getAll,
    getCurrent,
    updateWindow,
    updateTab,
    queryTabGroups,
  }
}
