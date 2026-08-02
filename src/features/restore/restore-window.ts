import type { BrowserGateway } from '../../chrome/browser-gateway'
import type { TabDescriptor, TabGroupColor } from '../../domain/browser'

/**
 * A descriptor queued to be created as a plain tab (never the tab that
 * carries a new window into existence) into a specific target window, at a
 * specific tab index within that window. `descriptorIndex` is the
 * descriptor's position in whatever caller-defined list it came from -- the
 * only stable id available for a tab that doesn't exist yet.
 */
export interface QueuedDescriptor {
  descriptorIndex: number
  descriptor: TabDescriptor
  index: number
}

/** A descriptor that has become a real tab, ready for pin/group follow-up. */
export interface CreatedTab {
  descriptorIndex: number
  descriptor: TabDescriptor
  tabId: number
  windowId: number
}

export interface RestoreFailure {
  descriptorIndex: number
  message: string
}

/**
 * Result of restoring a set of descriptors into a brand new window.
 * Deliberately shaped differently from `BulkResult` (`descriptorIndex`
 * instead of an already-real tab id) so callers can tell exactly which
 * REQUESTED descriptor succeeded or failed, not just which resulting tab id
 * did -- import/workspace-open need that to report accurate "Opened N tabs"
 * counts and to correlate with a workspace save.
 */
export interface RestoreResult {
  windowId?: number
  created: Array<{ descriptorIndex: number; tabId: number }>
  failed: RestoreFailure[]
}

/**
 * Creates a set of queued descriptors as new tabs into a GIVEN target
 * window, in order, tolerating an individual creation failure without
 * aborting the rest. Shared by `restoreIntoNewWindow` (always a fresh
 * window) and `restoreDescriptors` (original-window-or-fallback-new-window),
 * which each work out `windowId`/`index` differently before handing off to
 * this helper.
 */
export async function createDescriptorsInWindow(
  entries: readonly QueuedDescriptor[],
  windowId: number,
  gateway: BrowserGateway,
): Promise<{ created: CreatedTab[]; failed: RestoreFailure[] }> {
  const created: CreatedTab[] = []
  const failed: RestoreFailure[] = []

  for (const entry of entries) {
    try {
      const tabId = await gateway.createTab({
        windowId,
        url: entry.descriptor.url,
        index: entry.index,
      })
      created.push({
        descriptorIndex: entry.descriptorIndex,
        descriptor: entry.descriptor,
        tabId,
        windowId,
      })
    } catch (error) {
      failed.push({ descriptorIndex: entry.descriptorIndex, message: describeError(error) })
    }
  }

  return { created, failed }
}

/**
 * Applies pinned state, then group metadata, to a set of tabs that already
 * exist. A pin or group failure doesn't demote an otherwise-successfully-
 * created tab back to "failed" -- the tab still exists and still counts as
 * restored, it just may be missing some cosmetic metadata.
 */
export async function applyPinnedAndGroups(
  created: readonly CreatedTab[],
  gateway: BrowserGateway,
): Promise<void> {
  for (const tab of created) {
    if (!tab.descriptor.pinned) {
      continue
    }

    try {
      await gateway.setPinned([tab.tabId], true)
    } catch {
      // The tab itself still exists and counts as created; losing its
      // pinned state isn't worth reporting as a failure.
    }
  }

  const buckets = new Map<
    string,
    { windowId: number; title: string; color: TabGroupColor; tabIds: number[] }
  >()

  for (const tab of created) {
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
      // The tabs still exist and count as created even if regrouping fails.
    }
  }
}

/**
 * Restores an ordered list of descriptors into a BRAND NEW normal window --
 * always, unconditionally. Unlike `restoreDescriptors` (Loop 05's close
 * undo), there is no "original window" concept for freshly imported URLs or
 * a saved workspace being opened, so there's no existence check or fallback
 * branch here: the first descriptor always carries the new window into
 * existence, and the rest are created into it afterward, in order, as
 * inactive tabs. Pinned state and group metadata are only applied once every
 * tab that could be created has been created.
 */
export async function restoreIntoNewWindow(
  descriptors: readonly TabDescriptor[],
  gateway: BrowserGateway,
): Promise<RestoreResult> {
  if (descriptors.length === 0) {
    return { created: [], failed: [] }
  }

  const [first, ...rest] = descriptors

  let windowId: number
  let firstTabId: number

  try {
    const window = await gateway.createWindow(first.url)
    windowId = window.windowId
    firstTabId = window.tabId
  } catch (error) {
    // There's no window to put anything else into, so every requested
    // descriptor fails together rather than attempting any of them.
    const message = describeError(error)
    return {
      created: [],
      failed: descriptors.map((_, index) => ({ descriptorIndex: index, message })),
    }
  }

  const createdTabs: CreatedTab[] = [
    { descriptorIndex: 0, descriptor: first, tabId: firstTabId, windowId },
  ]

  const queued: QueuedDescriptor[] = rest.map((descriptor, offset) => ({
    descriptorIndex: offset + 1,
    descriptor,
    index: offset + 1,
  }))

  const { created, failed } = await createDescriptorsInWindow(queued, windowId, gateway)
  createdTabs.push(...created)

  await applyPinnedAndGroups(createdTabs, gateway)

  return {
    windowId,
    created: createdTabs.map((tab) => ({ descriptorIndex: tab.descriptorIndex, tabId: tab.tabId })),
    failed,
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
