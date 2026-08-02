import type { BrowserGateway } from '../../chrome/browser-gateway'
import type { BulkResult, OperationFailure, TabGroupColor } from '../../domain/browser'
import type { CloseSnapshot } from './close-repository'

type DescriptorEntry = CloseSnapshot['tabs'][number]

interface QueuedEntry {
  originalIndex: number
  descriptor: DescriptorEntry
}

interface RestoredTab {
  originalIndex: number
  descriptor: DescriptorEntry
  tabId: number
  windowId: number
}

/**
 * Recreates the tabs from a CloseSnapshot. `failed` entries are identified by
 * their original index within `snapshot.tabs` — there is no other stable id
 * for a descriptor that was never (re)created. `succeeded` entries are the
 * real ids of the newly created tabs.
 */
export async function restoreDescriptors(
  snapshot: CloseSnapshot,
  gateway: BrowserGateway,
): Promise<BulkResult> {
  const failed: OperationFailure[] = []
  const restored: RestoredTab[] = []

  const entriesByWindow = new Map<number, QueuedEntry[]>()

  snapshot.tabs.forEach((descriptor, originalIndex) => {
    if (!isRestorableUrl(descriptor.url)) {
      failed.push({
        id: originalIndex,
        message: descriptor.url
          ? `Cannot restore "${descriptor.url}": not a web address`
          : 'Cannot restore a tab with no saved URL',
      })
      return
    }

    const entries = entriesByWindow.get(descriptor.windowId) ?? []
    entries.push({ originalIndex, descriptor })
    entriesByWindow.set(descriptor.windowId, entries)
  })

  for (const [originalWindowId, entries] of entriesByWindow) {
    entries.sort((left, right) => left.descriptor.index - right.descriptor.index)

    const exists = await gateway.windowExists(originalWindowId)
    let targetWindowId = originalWindowId
    let remaining = entries

    if (!exists) {
      const [first, ...rest] = entries

      try {
        const created = await gateway.createWindow(first.descriptor.url)
        targetWindowId = created.windowId
        restored.push({
          originalIndex: first.originalIndex,
          descriptor: first.descriptor,
          tabId: created.tabId,
          windowId: targetWindowId,
        })
        remaining = rest
      } catch (error) {
        for (const entry of entries) {
          failed.push({ id: entry.originalIndex, message: describeError(error) })
        }
        continue
      }
    }

    for (const entry of remaining) {
      try {
        const tabId = await gateway.createTab({
          windowId: targetWindowId,
          url: entry.descriptor.url,
          index: entry.descriptor.index,
        })
        restored.push({
          originalIndex: entry.originalIndex,
          descriptor: entry.descriptor,
          tabId,
          windowId: targetWindowId,
        })
      } catch (error) {
        failed.push({ id: entry.originalIndex, message: describeError(error) })
      }
    }
  }

  for (const tab of restored) {
    if (!tab.descriptor.pinned) {
      continue
    }

    try {
      await gateway.setPinned([tab.tabId], true)
    } catch {
      // The tab itself still exists and counts as restored; losing its
      // pinned state isn't worth reporting as a failure.
    }
  }

  await restoreGroups(restored, gateway)

  return { succeeded: restored.map((tab) => tab.tabId), failed }
}

async function restoreGroups(restored: RestoredTab[], gateway: BrowserGateway): Promise<void> {
  const buckets = new Map<
    string,
    { windowId: number; title: string; color: TabGroupColor; tabIds: number[] }
  >()

  for (const tab of restored) {
    const group = tab.descriptor.group

    if (!group) {
      continue
    }

    const key = `${tab.windowId}::${group.title}::${group.color}`
    const bucket = buckets.get(key) ?? {
      windowId: tab.windowId,
      title: group.title,
      color: group.color,
      tabIds: [],
    }
    bucket.tabIds.push(tab.tabId)
    buckets.set(key, bucket)
  }

  for (const bucket of buckets.values()) {
    try {
      await gateway.groupCreatedTabs(bucket.tabIds, bucket.windowId, {
        title: bucket.title,
        color: bucket.color,
      })
    } catch {
      // The tabs still exist and count as restored even if regrouping fails.
    }
  }
}

function isRestorableUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
