import { useState } from 'react'
import { toast } from 'sonner'
import { useTabs } from './use-tabs'

export interface BulkActionRunner {
  pending: boolean
  setPending: (pending: boolean) => void
  /**
   * Runs `operation`, refreshing the live tab snapshot afterward regardless
   * of outcome, and toggling `pending` around the whole thing -- the shape
   * shared by every per-row/bulk lifecycle action (pin, mute, reload,
   * discard, move, arrange, group...). `onSuccess` handles the result (e.g.
   * a toast, closing a dialog); a thrown/rejected `operation` shows
   * `errorMessage` instead and skips `onSuccess`.
   */
  run: <T>(
    operation: () => Promise<T>,
    options: { onSuccess?: (result: T) => void; errorMessage: string },
  ) => Promise<T | undefined>
}

export function useBulkAction(): BulkActionRunner {
  const { refresh } = useTabs()
  const [pending, setPending] = useState(false)

  const run = async <T>(
    operation: () => Promise<T>,
    { onSuccess, errorMessage }: { onSuccess?: (result: T) => void; errorMessage: string },
  ): Promise<T | undefined> => {
    setPending(true)

    try {
      const result = await operation()
      onSuccess?.(result)
      return result
    } catch {
      toast.error(errorMessage)
      return undefined
    } finally {
      try {
        await refresh()
      } finally {
        setPending(false)
      }
    }
  }

  return { pending, setPending, run }
}
