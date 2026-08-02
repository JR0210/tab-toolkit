import { toast } from 'sonner'
import type { BrowserGateway } from '../../chrome/browser-gateway'
import type { BulkResult } from '../../domain/browser'
import { summarizeBulk } from './bulk-result'
import type { CloseRepository } from './close-repository'
import { undoClose } from './tab-lifecycle-service'

/**
 * Shows a success toast only when every id in `result` succeeded, an error
 * (mixed-result) toast when any failed, and nothing when the result is
 * entirely empty (e.g. there was nothing eligible to act on).
 */
export function showBulkResultToast(result: BulkResult, verb: string): void {
  if (result.succeeded.length === 0 && result.failed.length === 0) {
    return
  }

  const message = summarizeBulk(result, verb)

  if (result.failed.length === 0) {
    toast.success(message)
  } else {
    toast.error(message)
  }
}

/**
 * Shows the result of a close operation. When at least one tab was removed,
 * the toast offers an "Undo" action that restores the recorded snapshot
 * exactly once, guarding against a second click re-running the restore.
 */
export function showCloseToast(
  result: BulkResult,
  gateway: BrowserGateway,
  repository: CloseRepository,
  refresh: () => Promise<void>,
): void {
  if (result.succeeded.length === 0) {
    showBulkResultToast(result, 'Closed')
    return
  }

  const message = summarizeBulk(result, 'Closed')
  let undone = false

  toast(message, {
    action: {
      label: 'Undo',
      onClick: () => {
        if (undone) {
          return
        }

        undone = true

        void undoClose(gateway, repository).then(async (undoResult) => {
          await refresh()
          showBulkResultToast(undoResult, 'Restored')
        })
      },
    },
  })
}
