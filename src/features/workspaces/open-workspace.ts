import type { BrowserGateway } from '../../chrome/browser-gateway'
import { restoreIntoNewWindow } from '../restore/restore-window'
import type { RestoreResult } from '../restore/restore-window'
import type { Workspace } from './workspace'

/**
 * Opens a saved workspace into a brand new window. A thin wrapper around
 * `restoreIntoNewWindow` -- `workspace.tabs` is forwarded exactly as stored,
 * in order, with no URL/title rewriting: the workspace already holds
 * normalized descriptors from when it was saved (or imported).
 */
export async function openWorkspace(
  workspace: Workspace,
  gateway: BrowserGateway,
): Promise<RestoreResult> {
  return restoreIntoNewWindow(workspace.tabs, gateway)
}
