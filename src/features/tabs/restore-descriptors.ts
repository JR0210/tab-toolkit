import type { BrowserGateway } from '../../chrome/browser-gateway'
import type { BulkResult, OperationFailure } from '../../domain/browser'
import type { CloseSnapshot } from './close-repository'
import {
  applyPinnedAndGroups,
  createDescriptorsInWindow,
  type CreatedTab,
  type QueuedDescriptor,
} from '../restore/restore-window'

type DescriptorEntry = CloseSnapshot['tabs'][number]

interface QueuedEntry {
  originalIndex: number
  descriptor: DescriptorEntry
}

/**
 * Recreates the tabs from a CloseSnapshot. `failed` entries are identified by
 * their original index within `snapshot.tabs` — there is no other stable id
 * for a descriptor that was never (re)created. `succeeded` entries are the
 * real ids of the newly created tabs.
 *
 * Groups descriptors by their ORIGINAL windowId and, for each group, either
 * recreates the remaining tabs directly into that window (if it still
 * exists) or creates ONE new window from the first descriptor and recreates
 * the rest into it (if it doesn't) -- this "restore into the original
 * window when possible" fallback is specific to undoing a close and isn't
 * shared with `restoreIntoNewWindow` (used by import/workspace-open, which
 * always creates a fresh window). The lower-level "create descriptors into a
 * given window" and "apply pinned + group metadata" steps ARE shared, via
 * `createDescriptorsInWindow`/`applyPinnedAndGroups`.
 */
export async function restoreDescriptors(
  snapshot: CloseSnapshot,
  gateway: BrowserGateway,
): Promise<BulkResult> {
  const failed: OperationFailure[] = []
  const restored: CreatedTab[] = []

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
          descriptorIndex: first.originalIndex,
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

    const queued: QueuedDescriptor[] = remaining.map((entry) => ({
      descriptorIndex: entry.originalIndex,
      descriptor: entry.descriptor,
      index: entry.descriptor.index,
    }))

    const { created, failed: creationFailures } = await createDescriptorsInWindow(
      queued,
      targetWindowId,
      gateway,
    )

    restored.push(...created)
    failed.push(
      ...creationFailures.map((failure) => ({
        id: failure.descriptorIndex,
        message: failure.message,
      })),
    )
  }

  await applyPinnedAndGroups(restored, gateway)

  return { succeeded: restored.map((tab) => tab.tabId), failed }
}

function isRestorableUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
