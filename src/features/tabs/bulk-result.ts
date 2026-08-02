import type { BulkResult } from '../../domain/browser'

/**
 * Runs `operation` for each id in order, collecting per-id success/failure
 * instead of letting one rejection abort the whole batch.
 */
export async function runBulk(
  ids: readonly number[],
  operation: (id: number) => Promise<void>,
): Promise<BulkResult> {
  const succeeded: number[] = []
  const failed: BulkResult['failed'] = []

  for (const id of ids) {
    try {
      await operation(id)
      succeeded.push(id)
    } catch (error) {
      failed.push({ id, message: describeError(error) })
    }
  }

  return { succeeded, failed }
}

export function summarizeBulk(result: BulkResult, verb: string): string {
  const succeededCount = result.succeeded.length
  const failedCount = result.failed.length
  const summary = `${verb} ${succeededCount} ${pluralize(succeededCount, 'tab', 'tabs')}`

  if (failedCount === 0) {
    return `${summary}.`
  }

  const wasWere = failedCount === 1 ? 'was' : 'were'
  return `${summary}; ${failedCount} ${pluralize(failedCount, 'tab', 'tabs')} ${wasWere} no longer available.`
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
