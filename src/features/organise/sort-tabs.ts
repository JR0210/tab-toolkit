import type { BrowserGateway } from '../../chrome/browser-gateway'
import type { BulkResult, OperationFailure, TabRecord } from '../../domain/browser'

export type ArrangeSort = 'title' | 'domain'

export interface PlannedMove {
  tabId: number
  windowId: number
  index: number
}

interface PartitionKey {
  windowId: number
  pinned: boolean
}

interface PartitionEntry {
  tab: TabRecord
  originalIndex: number
}

/**
 * Pure planner: given an ordered selection, computes the individual
 * chrome.tabs.move commands needed to sort it by title or domain.
 *
 * Tabs are first partitioned by window, then by pinned state -- a move
 * NEVER crosses either boundary, mirroring how Chrome itself always keeps
 * pinned tabs ahead of unpinned ones. Within a partition, tabs are sorted
 * locale-aware/case-insensitively, with ties broken by each tab's original
 * position in the given `tabs` array (not alphabetically), and are then
 * assigned the exact set of real window indices the partition already
 * occupies -- never indices belonging to another partition or a
 * selection-relative renumbering. Moves are returned in ascending
 * target-index order within each partition, because each chrome.tabs.move
 * call shifts other tabs' indices as a side effect.
 */
export function planTabMoves(tabs: readonly TabRecord[], sort: ArrangeSort): PlannedMove[] {
  const partitions = groupByPartition(tabs)
  const moves: PlannedMove[] = []

  for (const partition of partitions) {
    moves.push(...planPartitionMoves(partition, sort))
  }

  return moves
}

/**
 * Executes a sort plan against the gateway. Partitions are handled one at a
 * time, in ascending target-index order within each. If a move fails, the
 * rest of THAT partition's moves are abandoned without retry (the failure
 * may have left assumptions about tab positions stale), the live snapshot
 * is re-read, and planning continues for the remaining partitions from that
 * fresh data.
 */
export async function arrangeSelection(
  tabs: readonly TabRecord[],
  sort: ArrangeSort,
  gateway: BrowserGateway,
): Promise<BulkResult> {
  const succeeded: number[] = []
  const failed: OperationFailure[] = []

  const partitionKeys = groupByPartition(tabs).map((partition) => partition.key)
  let liveTabs = tabs

  for (const key of partitionKeys) {
    const partitionTabs = liveTabs.filter(
      (tab) => tab.windowId === key.windowId && tab.pinned === key.pinned,
    )

    if (partitionTabs.length === 0) {
      continue
    }

    const moves = planTabMoves(partitionTabs, sort)
    let partitionFailed = false

    for (const move of moves) {
      try {
        await gateway.moveTab(move.tabId, move.windowId, move.index)
        succeeded.push(move.tabId)
      } catch (error) {
        failed.push({ id: move.tabId, message: describeError(error) })
        partitionFailed = true
        break
      }
    }

    if (partitionFailed) {
      const snapshot = await gateway.getSnapshot()
      const byId = new Map(snapshot.tabs.map((tab) => [tab.id, tab]))
      liveTabs = liveTabs
        .map((tab) => byId.get(tab.id))
        .filter((tab): tab is TabRecord => tab !== undefined)
    }
  }

  return { succeeded, failed }
}

function groupByPartition(
  tabs: readonly TabRecord[],
): Array<{ key: PartitionKey; entries: PartitionEntry[] }> {
  const partitionsByKey = new Map<string, { key: PartitionKey; entries: PartitionEntry[] }>()

  tabs.forEach((tab, originalIndex) => {
    const keyString = `${tab.windowId}::${tab.pinned}`
    const partition = partitionsByKey.get(keyString) ?? {
      key: { windowId: tab.windowId, pinned: tab.pinned },
      entries: [],
    }
    partition.entries.push({ tab, originalIndex })
    partitionsByKey.set(keyString, partition)
  })

  // Deterministic ordering: window id ascending, pinned before unpinned --
  // matches Chrome's own tab layout within a window.
  return [...partitionsByKey.values()].sort((left, right) => {
    if (left.key.windowId !== right.key.windowId) {
      return left.key.windowId - right.key.windowId
    }
    if (left.key.pinned === right.key.pinned) {
      return 0
    }
    return left.key.pinned ? -1 : 1
  })
}

function planPartitionMoves(
  partition: { key: PartitionKey; entries: PartitionEntry[] },
  sort: ArrangeSort,
): PlannedMove[] {
  const sortedEntries = [...partition.entries].sort((left, right) => {
    const leftValue = sort === 'title' ? left.tab.title : left.tab.domain
    const rightValue = sort === 'title' ? right.tab.title : right.tab.domain
    const compared = leftValue.localeCompare(rightValue, undefined, { sensitivity: 'base' })

    return compared !== 0 ? compared : left.originalIndex - right.originalIndex
  })

  // The partition keeps the exact set of real window indices it already
  // occupies -- only the tabs within those slots are reordered.
  const targetIndices = partition.entries.map((entry) => entry.tab.index).sort((a, b) => a - b)

  const moves: PlannedMove[] = []

  sortedEntries.forEach((entry, position) => {
    const targetIndex = targetIndices[position]

    if (entry.tab.index !== targetIndex) {
      moves.push({ tabId: entry.tab.id, windowId: partition.key.windowId, index: targetIndex })
    }
  })

  return moves.sort((left, right) => left.index - right.index)
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
