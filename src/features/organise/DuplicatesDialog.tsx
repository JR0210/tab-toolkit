import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useBrowserGateway } from '../../chrome/use-browser-gateway'
import type { TabRecord } from '../../domain/browser'
import { Button } from '../../shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../shared/ui/dialog'
import { Separator } from '../../shared/ui/separator'
import { createChromeCloseRepository } from '../tabs/close-repository'
import type { CloseRepository } from '../tabs/close-repository'
import { closeTabs } from '../tabs/tab-lifecycle-service'
import { useTabs } from '../tabs/use-tabs'
import { findDuplicateSets } from './duplicate-plan'

interface DuplicatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tabs: readonly TabRecord[]
  repository?: CloseRepository
}

/**
 * Lets the user review exact-URL duplicates within the current selection
 * and choose which tab in each set survives (defaulting to
 * chooseDefaultKeeper's pick). Confirming routes the non-keeper tabs through
 * the Loop 05 close service so the removal stays undoable.
 */
export function DuplicatesDialog({
  open,
  onOpenChange,
  tabs,
  repository = createChromeCloseRepository(),
}: DuplicatesDialogProps) {
  const gateway = useBrowserGateway()
  const { snapshot, refresh } = useTabs()
  const [pending, setPending] = useState(false)
  const [overrides, setOverrides] = useState<ReadonlyMap<string, number>>(new Map())

  const sets = useMemo(() => findDuplicateSets(tabs), [tabs])

  const nonKeepers = sets.flatMap((set) => {
    const keepId = overrides.get(set.url) ?? set.keepId
    return set.candidates.filter((candidate) => candidate.id !== keepId)
  })

  const handleConfirm = async () => {
    if (nonKeepers.length === 0) {
      return
    }

    setPending(true)

    try {
      const groupsById = new Map((snapshot?.groups ?? []).map((group) => [group.id, group]))
      const result = await closeTabs(nonKeepers, groupsById, gateway, repository)

      toast.success(
        result.succeeded.length === 1
          ? 'Closed 1 duplicate tab'
          : `Closed ${result.succeeded.length} duplicate tabs`,
      )
      await refresh()
      onOpenChange(false)
    } catch {
      // Storage/removal failed before anything committed -- keep the dialog
      // open so the user can retry instead of losing their choices.
      toast.error('Could not close the duplicate tabs. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicate tabs</DialogTitle>
          <DialogDescription>
            {sets.length === 0
              ? 'No exact-URL duplicates found in the current selection.'
              : 'Choose which tab to keep in each set. The rest will be closed.'}
          </DialogDescription>
        </DialogHeader>

        {sets.map((set, setIndex) => (
          <fieldset key={set.url} className="flex flex-col gap-1.5">
            {setIndex > 0 ? <Separator className="mb-1" /> : null}
            <legend className="mb-1 truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {set.url}
            </legend>
            {set.candidates.map((candidate) => (
              <label
                key={candidate.id}
                className="flex cursor-pointer items-center gap-2 py-0.5 text-[13px]"
              >
                <input
                  type="radio"
                  name={`duplicate-keeper-${set.url}`}
                  checked={(overrides.get(set.url) ?? set.keepId) === candidate.id}
                  onChange={() => {
                    setOverrides((current) => {
                      const next = new Map(current)
                      next.set(set.url, candidate.id)
                      return next
                    })
                  }}
                  className="size-4 shrink-0 cursor-pointer accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                Keep {candidate.title}
                {candidate.pinned ? ' (pinned)' : ''}
              </label>
            ))}
          </fieldset>
        ))}

        <DialogFooter>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={pending || nonKeepers.length === 0}
          >
            {nonKeepers.length === 1
              ? 'Close 1 duplicate tab'
              : `Close ${nonKeepers.length} duplicate tabs`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
