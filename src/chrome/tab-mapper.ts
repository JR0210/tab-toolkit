import type { TabGroupRecord, TabRecord } from '../domain/browser'

export function mapChromeTab(tab: Partial<chrome.tabs.Tab>): TabRecord {
  const url = tab.url ?? ''

  return {
    id: tab.id ?? 0,
    windowId: tab.windowId ?? 0,
    index: tab.index ?? 0,
    title: tab.title ?? 'Untitled tab',
    url,
    domain: getTabDomain(url),
    faviconUrl: tab.favIconUrl || null,
    pinned: tab.pinned ?? false,
    muted: tab.mutedInfo?.muted ?? false,
    audible: tab.audible ?? false,
    active: tab.active ?? false,
    discarded: tab.discarded ?? false,
    groupId: typeof tab.groupId === 'number' && tab.groupId >= 0 ? tab.groupId : null,
  }
}

export function mapChromeTabGroup(group: chrome.tabGroups.TabGroup): TabGroupRecord {
  return {
    id: group.id,
    windowId: group.windowId,
    title: group.title ?? '',
    color: group.color,
  }
}

function getTabDomain(url: string): string {
  if (!url) {
    return ''
  }

  try {
    const parsedUrl = new URL(url)

    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      return parsedUrl.hostname
    }

    if (parsedUrl.origin !== 'null') {
      return parsedUrl.origin
    }

    return parsedUrl.host ? `${parsedUrl.protocol}//${parsedUrl.host}` : ''
  } catch {
    return ''
  }
}
