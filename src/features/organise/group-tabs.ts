import type { BrowserGateway } from '../../chrome/browser-gateway'
import type { BulkResult, OperationFailure, TabGroupColor, TabRecord } from '../../domain/browser'

/** The 8 colors available for auto-generated groups -- 'grey' is reserved. */
export const GROUP_COLOR_PALETTE: readonly TabGroupColor[] = [
  'blue',
  'cyan',
  'green',
  'yellow',
  'orange',
  'red',
  'pink',
  'purple',
]

const MAX_GROUP_TITLE_LENGTH = 80

/** Deterministic domain -> color mapping so the same domain always groups the same color. */
export function colorForDomain(domain: string): TabGroupColor {
  let hash = 0

  for (let i = 0; i < domain.length; i += 1) {
    hash += domain.charCodeAt(i)
  }

  return GROUP_COLOR_PALETTE[hash % GROUP_COLOR_PALETTE.length]
}

export type AddToGroupTarget =
  | { groupId: number; windowId: number }
  | { newGroupTitle: string; color: TabGroupColor }

/**
 * Groups the given selection by (window, exact domain). Partitions with
 * fewer than 2 tabs are skipped entirely -- not attempted, and therefore
 * absent from both `succeeded` and `failed` -- since there's nothing to
 * usefully group.
 */
export async function groupByDomain(
  tabs: readonly TabRecord[],
  gateway: BrowserGateway,
): Promise<BulkResult> {
  const succeeded: number[] = []
  const failed: OperationFailure[] = []

  const partitions = new Map<string, { windowId: number; domain: string; tabIds: number[] }>()

  for (const tab of tabs) {
    const key = `${tab.windowId}::${tab.domain}`
    const partition = partitions.get(key) ?? {
      windowId: tab.windowId,
      domain: tab.domain,
      tabIds: [],
    }
    partition.tabIds.push(tab.id)
    partitions.set(key, partition)
  }

  for (const partition of partitions.values()) {
    if (partition.tabIds.length < 2) {
      continue
    }

    try {
      const groupId = await gateway.groupTabs(partition.tabIds, partition.windowId)
      await gateway.updateGroup(groupId, {
        title: truncateTitle(partition.domain),
        color: colorForDomain(partition.domain),
      })
      succeeded.push(...partition.tabIds)
    } catch (error) {
      const message = describeError(error)
      failed.push(...partition.tabIds.map((id) => ({ id, message })))
    }
  }

  return { succeeded, failed }
}

/**
 * Adds the given tabs to a chosen group. When targeting an EXISTING group
 * (by id), only tabs already in that group's window are eligible -- tabs
 * from any other window are silently excluded (never attempted, so they
 * appear in neither `succeeded` nor `failed`) rather than being passed to a
 * group id that belongs to a different window. When creating a new group,
 * one same-named/colored group is created per distinct window represented
 * in the selection.
 */
export async function addToChosenGroup(
  tabs: readonly TabRecord[],
  target: AddToGroupTarget,
  gateway: BrowserGateway,
): Promise<BulkResult> {
  if ('groupId' in target) {
    const eligible = tabs.filter((tab) => tab.windowId === target.windowId)

    if (eligible.length === 0) {
      return { succeeded: [], failed: [] }
    }

    try {
      await gateway.groupTabs(
        eligible.map((tab) => tab.id),
        target.windowId,
        target.groupId,
      )
      return { succeeded: eligible.map((tab) => tab.id), failed: [] }
    } catch (error) {
      const message = describeError(error)
      return { succeeded: [], failed: eligible.map((tab) => ({ id: tab.id, message })) }
    }
  }

  const succeeded: number[] = []
  const failed: OperationFailure[] = []
  const byWindow = new Map<number, number[]>()

  for (const tab of tabs) {
    const ids = byWindow.get(tab.windowId) ?? []
    ids.push(tab.id)
    byWindow.set(tab.windowId, ids)
  }

  for (const [windowId, tabIds] of byWindow) {
    try {
      const groupId = await gateway.groupTabs(tabIds, windowId)
      await gateway.updateGroup(groupId, { title: target.newGroupTitle, color: target.color })
      succeeded.push(...tabIds)
    } catch (error) {
      const message = describeError(error)
      failed.push(...tabIds.map((id) => ({ id, message })))
    }
  }

  return { succeeded, failed }
}

function truncateTitle(domain: string): string {
  return domain.length > MAX_GROUP_TITLE_LENGTH ? domain.slice(0, MAX_GROUP_TITLE_LENGTH) : domain
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
