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
  const getPlatformInfo = vi
    .fn<ChromeBrowserApi['runtime']['getPlatformInfo']>()
    .mockResolvedValue({ os: 'win', arch: 'x86-64', nacl_arch: 'x86-64' })
  const getManifest = vi.fn<ChromeBrowserApi['runtime']['getManifest']>().mockReturnValue({
    manifest_version: 3,
    name: 'Tab Toolkit',
    version: '0.1.0',
  } as chrome.runtime.Manifest)
  const getAll = vi.fn<ChromeBrowserApi['windows']['getAll']>().mockResolvedValue([])
  const getCurrent = vi
    .fn<ChromeBrowserApi['windows']['getCurrent']>()
    .mockResolvedValue(createChromeWindow())
  const updateWindow = vi
    .fn<ChromeBrowserApi['windows']['update']>()
    .mockResolvedValue(createChromeWindow())
  const updateTab = vi.fn<ChromeBrowserApi['tabs']['update']>().mockResolvedValue(createChromeTab())
  const reloadTab = vi.fn<ChromeBrowserApi['tabs']['reload']>().mockResolvedValue(undefined)
  const discardTab = vi
    .fn<ChromeBrowserApi['tabs']['discard']>()
    .mockResolvedValue(createChromeTab())
  const removeTabs = vi.fn<ChromeBrowserApi['tabs']['remove']>().mockResolvedValue(undefined)
  const createTab = vi.fn<ChromeBrowserApi['tabs']['create']>().mockResolvedValue(createChromeTab())
  const groupTabs = vi.fn<ChromeBrowserApi['tabs']['group']>().mockResolvedValue(1)
  const moveTabs = vi.fn<ChromeBrowserApi['tabs']['move']>().mockResolvedValue([])
  const ungroupTabs = vi.fn<ChromeBrowserApi['tabs']['ungroup']>().mockResolvedValue(undefined)
  const getWindow = vi
    .fn<ChromeBrowserApi['windows']['get']>()
    .mockResolvedValue(createChromeWindow())
  const createWindow = vi
    .fn<ChromeBrowserApi['windows']['create']>()
    .mockResolvedValue(createChromeWindow({ tabs: [createChromeTab()] }))
  const queryTabGroups = vi.fn<ChromeBrowserApi['tabGroups']['query']>().mockResolvedValue([])
  const updateTabGroup = vi
    .fn<ChromeBrowserApi['tabGroups']['update']>()
    .mockResolvedValue(createChromeTabGroup())

  return {
    api: {
      runtime: {
        getPlatformInfo,
        getManifest,
      },
      windows: {
        getAll,
        getCurrent,
        update: updateWindow,
        get: getWindow,
        create: createWindow,
      },
      tabs: {
        update: updateTab,
        reload: reloadTab,
        discard: discardTab,
        remove: removeTabs,
        create: createTab,
        group: groupTabs,
        move: moveTabs,
        ungroup: ungroupTabs,
      },
      tabGroups: {
        query: queryTabGroups,
        update: updateTabGroup,
      },
    },
    getPlatformInfo,
    getManifest,
    getAll,
    getCurrent,
    updateWindow,
    updateTab,
    reloadTab,
    discardTab,
    removeTabs,
    createTab,
    groupTabs,
    moveTabs,
    ungroupTabs,
    getWindow,
    createWindow,
    queryTabGroups,
    updateTabGroup,
  }
}
