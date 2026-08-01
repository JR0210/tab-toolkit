import type { TabRecord } from '../../domain/browser'

export interface WindowTabs {
  windowId: number
  tabs: TabRecord[]
}

export function groupTabsByWindow(tabs: readonly TabRecord[]): WindowTabs[] {
  const tabsByWindow = new Map<number, TabRecord[]>()

  for (const tab of tabs) {
    const windowTabs = tabsByWindow.get(tab.windowId)

    if (windowTabs) {
      windowTabs.push(tab)
    } else {
      tabsByWindow.set(tab.windowId, [tab])
    }
  }

  return [...tabsByWindow.entries()]
    .sort(([leftWindowId], [rightWindowId]) => leftWindowId - rightWindowId)
    .map(([windowId, windowTabs]) => ({
      windowId,
      tabs: windowTabs.sort((left, right) => left.index - right.index),
    }))
}
