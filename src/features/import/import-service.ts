import type { BrowserGateway } from '../../chrome/browser-gateway'
import type { TabDescriptor } from '../../domain/browser'
import { restoreIntoNewWindow } from '../restore/restore-window'
import { validateWorkspace } from '../workspaces/workspace'
import type { WorkspaceRepository } from '../workspaces/workspace-repository'
import { parseUrlLines } from './parse-urls'

export interface ImportOptions {
  text: string
  /** Optional; a blank/whitespace-only name is treated the same as no name. */
  workspaceName?: string
}

export interface ImportDeps {
  gateway: BrowserGateway
  repository: WorkspaceRepository
}

export interface ImportResult {
  /** Number of valid URLs that successfully opened as tabs. */
  openedCount: number
  /** Number of valid URLs that were requested but failed to open. */
  failedCount: number
  /** Number of lines that could not be parsed as a valid web URL. */
  parseErrorCount: number
  /**
   * Number of URLs saved into a new workspace. 0 means no workspace was
   * requested (or the name was blank) -- this single field conveys both
   * "was anything saved" and "how many" without a separate boolean.
   */
  savedCount: number
}

/**
 * Parses pasted URL text, opens every valid URL into a brand new window
 * (never the current window, never an existing one), and -- if a non-blank
 * workspace name is given -- ALSO saves the same full set of valid,
 * normalized, ordered URLs as a new workspace. The workspace save always
 * uses the complete valid-URL list, not just the ones that actually opened:
 * a URL that failed to open due to a transient Chrome error is still worth
 * keeping around for a later retry.
 *
 * Zero valid URLs is a hard failure -- nothing is opened and nothing is
 * saved, mirroring every other "don't create something out of nothing" rule
 * in this codebase (e.g. saveCurrentWindow's zero-tabs rejection).
 */
export async function importUrls(options: ImportOptions, deps: ImportDeps): Promise<ImportResult> {
  const { valid, invalid } = parseUrlLines(options.text)

  if (valid.length === 0) {
    throw new Error('No valid URLs to import.')
  }

  const descriptors: TabDescriptor[] = valid.map((entry) => ({
    url: entry.url,
    title: entry.url,
    pinned: false,
  }))

  // Restore runs before any workspace save: the plan's contract is "open,
  // then optionally also save" -- never the reverse.
  const restoreResult = await restoreIntoNewWindow(descriptors, deps.gateway)

  let savedCount = 0
  const trimmedName = (options.workspaceName ?? '').trim()

  if (trimmedName.length > 0) {
    const now = new Date().toISOString()
    const workspace = validateWorkspace({
      id: crypto.randomUUID(),
      name: trimmedName,
      createdAt: now,
      updatedAt: now,
      tabs: descriptors,
    })

    if (workspace) {
      await deps.repository.put(workspace)
      savedCount = descriptors.length
    }
  }

  return {
    openedCount: restoreResult.created.length,
    failedCount: restoreResult.failed.length,
    parseErrorCount: invalid.length,
    savedCount,
  }
}
