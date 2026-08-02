import type { TabDescriptor, TabGroupRecord, TabRecord } from '../../domain/browser'

export interface TabsToDescriptorsResult {
  descriptors: TabDescriptor[]
  skippedCount: number
}

/**
 * Converts live Chrome tabs into stable, restart-safe TabDescriptors.
 * Chrome tab/window/group ids never appear in the output -- they're
 * session-specific and meaningless after a restart. Tabs are emitted in
 * Chrome index order (the same "Chrome order" convention used by
 * tab-query.ts's sortWindowTabs), regardless of the input array's order.
 * A tab with a missing/empty url, or a url that isn't http(s), is excluded
 * and counted in `skippedCount` -- mirrors restore-descriptors.ts's
 * isRestorableUrl check.
 */
export function tabsToDescriptors(
  tabs: readonly TabRecord[],
  groups: readonly TabGroupRecord[],
): TabsToDescriptorsResult {
  const groupsById = new Map(groups.map((group) => [group.id, group]))
  const orderedTabs = [...tabs].sort((left, right) => left.index - right.index)

  const descriptors: TabDescriptor[] = []
  let skippedCount = 0

  for (const tab of orderedTabs) {
    if (!isSafeUrl(tab.url)) {
      skippedCount += 1
      continue
    }

    const group = tab.groupId === null ? undefined : groupsById.get(tab.groupId)

    descriptors.push({
      url: tab.url,
      title: tab.title,
      pinned: tab.pinned,
      ...(group ? { group: { title: group.title, color: group.color } } : {}),
    })
  }

  return { descriptors, skippedCount }
}

function isSafeUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}
