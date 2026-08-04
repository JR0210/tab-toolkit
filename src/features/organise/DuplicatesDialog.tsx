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
import { RadioGroup } from '../../shared/ui/radio-group'
import { Separator } from '../../shared/ui/separator'
import { createChromeCloseRepository } from '../tabs/close-repository'
import type { CloseRepository } from '../tabs/close-repository'
import { closeTabs } from '../tabs/tab-lifecycle-service'
import { useTabs } from '../tabs/use-tabs'
import { findDuplicateSets } from './duplicate-plan'
import type { DuplicateSet } from './duplicate-plan'

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

  // Ignore a stale override -- e.g. the selection changed while the dialog
  // was open and that candidate is no longer part of this set -- rather than
  // letting it silently widen "non-keepers" to every candidate in the set.
  const resolveKeepId = (set: DuplicateSet): number => {
    const override = overrides.get(set.url)
    return override !== undefined && set.candidates.some((candidate) => candidate.id === override)
      ? override
      : set.keepId
  }

  const nonKeepers = sets.flatMap((set) => {
    const keepId = resolveKeepId(set)
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
      onOpenChange(false)
    } catch {
      // closeTabs can still reject after tabs were actually removed (e.g. if
      // the undo-snapshot save fails post-removal), so this isn't always "no
      // change happened" -- refresh() below always runs regardless. Keep the
      // dialog open here so the user can retry instead of losing their
      // choices.
      toast.error('Could not close the duplicate tabs. Try again.')
    } finally {
      try {
        await refresh()
      } finally {
        setPending(false)
      }
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
          <div key={set.url}>
            {setIndex > 0 ? <Separator className="mb-1" /> : null}
            <RadioGroup
              legend={set.url}
              legendClassName="truncate"
              name={`duplicate-keeper-${set.url}`}
              value={resolveKeepId(set)}
              onChange={(candidateId) => {
                setOverrides((current) => {
                  const next = new Map(current)
                  next.set(set.url, candidateId)
                  return next
                })
              }}
              options={set.candidates.map((candidate) => ({
                value: candidate.id,
                label: (
                  <>
                    Keep {candidate.title}
                    {candidate.pinned ? ' (pinned)' : ''}
                  </>
                ),
              }))}
            />
          </div>
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
