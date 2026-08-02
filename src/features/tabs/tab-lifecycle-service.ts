import type { BrowserGateway } from '../../chrome/browser-gateway'
import type { BulkResult, TabGroupRecord, TabRecord } from '../../domain/browser'
import type { CloseRepository, CloseSnapshot } from './close-repository'
import { restoreDescriptors } from './restore-descriptors'

/**
 * Closes an explicit, ordered list of tabs. Records a recovery snapshot
 * *before* removing anything (write-before-remove): if the snapshot can't be
 * saved, the tabs are never removed, so a close that's advertised as
 * undoable always actually has recovery data behind it.
 */
export async function closeTabs(
  tabs: readonly TabRecord[],
  groupsById: ReadonlyMap<number, TabGroupRecord>,
  gateway: BrowserGateway,
  repository: CloseRepository,
): Promise<BulkResult> {
  const snapshot = buildCloseSnapshot(tabs, groupsById)

  await repository.save(snapshot)

  return gateway.removeTabs(tabs.map((tab) => tab.id))
}

/**
 * Restores the most recently closed tabs. The saved snapshot is cleared only
 * after the restore has been attempted (successfully or not), so a partial
 * failure doesn't leave a stale snapshot the user could try to undo again.
 */
export async function undoClose(
  gateway: BrowserGateway,
  repository: CloseRepository,
): Promise<BulkResult> {
  const snapshot = await repository.load()

  if (!snapshot) {
    return { succeeded: [], failed: [] }
  }

  try {
    return await restoreDescriptors(snapshot, gateway)
  } finally {
    await repository.clear()
  }
}

function buildCloseSnapshot(
  tabs: readonly TabRecord[],
  groupsById: ReadonlyMap<number, TabGroupRecord>,
): CloseSnapshot {
  return {
    closedAt: Date.now(),
    tabs: tabs.map((tab) => {
      const group = tab.groupId === null ? undefined : groupsById.get(tab.groupId)

      return {
        url: tab.url,
        title: tab.title,
        pinned: tab.pinned,
        windowId: tab.windowId,
        index: tab.index,
        ...(group ? { group: { title: group.title, color: group.color } } : {}),
      }
    }),
  }
}
