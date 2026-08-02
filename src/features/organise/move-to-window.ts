import type { BrowserGateway } from '../../chrome/browser-gateway'
import type { BulkResult, TabRecord } from '../../domain/browser'

/**
 * Moves an ordered selection of tabs into a brand new window. The FIRST tab
 * in the given order carries the new window into existence (Chrome's
 * `windows.create({ tabId })` moves an existing tab rather than creating a
 * fresh one), and every remaining tab is then moved, in its given relative
 * order, to the end of that window.
 */
export async function moveSelectionToNewWindow(
  tabs: readonly TabRecord[],
  gateway: BrowserGateway,
): Promise<BulkResult> {
  if (tabs.length === 0) {
    return { succeeded: [], failed: [] }
  }

  const [first, ...rest] = tabs

  let created: { windowId: number; tabId: number }

  try {
    created = await gateway.createWindowWithTab(first.id)
  } catch (error) {
    // There's no window to move the rest into, so the whole selection fails
    // together rather than attempting any moves.
    const message = describeError(error)
    return { succeeded: [], failed: tabs.map((tab) => ({ id: tab.id, message })) }
  }

  if (rest.length === 0) {
    return { succeeded: [created.tabId], failed: [] }
  }

  const moveResult = await gateway.moveTabs(
    rest.map((tab) => tab.id),
    created.windowId,
    -1,
  )

  return {
    succeeded: [created.tabId, ...moveResult.succeeded],
    failed: moveResult.failed,
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
