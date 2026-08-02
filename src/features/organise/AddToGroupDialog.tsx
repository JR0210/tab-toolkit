import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useBrowserGateway } from '../../chrome/use-browser-gateway'
import type { TabGroupColor, TabRecord } from '../../domain/browser'
import { Button } from '../../shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../shared/ui/dialog'
import { Input } from '../../shared/ui/input'
import { Separator } from '../../shared/ui/separator'
import { showBulkResultToast } from '../tabs/lifecycle-toast'
import { useTabs } from '../tabs/use-tabs'
import { GROUP_COLOR_PALETTE, addToChosenGroup } from './group-tabs'

const COLOR_LABELS: Record<TabGroupColor, string> = {
  grey: 'Grey',
  blue: 'Blue',
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  pink: 'Pink',
  purple: 'Purple',
  cyan: 'Cyan',
  orange: 'Orange',
}

interface AddToGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tabs: readonly TabRecord[]
}

/**
 * Lets the user add the given selection to an existing Chrome tab group (in
 * one of the selection's windows) or create a new group. A Chrome tab group
 * belongs to a single window, so choosing an EXISTING group only ever acts
 * on the subset of the selection that's actually in that group's window --
 * the rest are surfaced via a note rather than silently dropped or errored.
 */
export function AddToGroupDialog({ open, onOpenChange, tabs }: AddToGroupDialogProps) {
  const gateway = useBrowserGateway()
  const { snapshot, refresh } = useTabs()
  const [pending, setPending] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newColor, setNewColor] = useState<TabGroupColor>(GROUP_COLOR_PALETTE[0])

  const windowIds = useMemo(() => new Set(tabs.map((tab) => tab.windowId)), [tabs])
  const eligibleGroups = (snapshot?.groups ?? []).filter((group) => windowIds.has(group.windowId))

  const [selection, setSelection] = useState<{ mode: 'existing' | 'new'; groupId: number | null }>(
    () => ({
      mode: eligibleGroups.length > 0 ? 'existing' : 'new',
      groupId: eligibleGroups[0]?.id ?? null,
    }),
  )

  const selectedGroup =
    selection.mode === 'existing'
      ? (eligibleGroups.find((group) => group.id === selection.groupId) ?? null)
      : null

  const tabsInSelectedGroupWindow = selectedGroup
    ? tabs.filter((tab) => tab.windowId === selectedGroup.windowId)
    : []
  const excludedFromSelectedGroup = tabs.length - tabsInSelectedGroupWindow.length

  const canConfirm =
    selection.mode === 'existing'
      ? selectedGroup !== null && tabsInSelectedGroupWindow.length > 0
      : newTitle.trim().length > 0

  const handleConfirm = async () => {
    if (!canConfirm) {
      return
    }

    setPending(true)

    try {
      const target =
        selection.mode === 'existing' && selectedGroup
          ? { groupId: selectedGroup.id, windowId: selectedGroup.windowId }
          : { newGroupTitle: newTitle.trim(), color: newColor }

      const result = await addToChosenGroup(tabs, target, gateway)
      showBulkResultToast(result, 'Grouped')
      await refresh()
      onOpenChange(false)
    } catch {
      toast.error('Could not add the tabs to a group. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to group</DialogTitle>
          <DialogDescription>
            Add the selected tabs to an existing group, or create a new one.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Group
          </legend>

          {eligibleGroups.map((group) => (
            <label
              key={group.id}
              className="flex cursor-pointer items-center gap-2 py-0.5 text-[13px]"
            >
              <input
                type="radio"
                name="add-to-group-target"
                checked={selection.mode === 'existing' && selection.groupId === group.id}
                onChange={() => setSelection({ mode: 'existing', groupId: group.id })}
                className="size-4 shrink-0 cursor-pointer accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              {group.title || 'Untitled group'}
            </label>
          ))}

          <label className="flex cursor-pointer items-center gap-2 py-0.5 text-[13px]">
            <input
              type="radio"
              name="add-to-group-target"
              checked={selection.mode === 'new'}
              onChange={() => setSelection({ mode: 'new', groupId: null })}
              className="size-4 shrink-0 cursor-pointer accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            Create a new group
          </label>
        </fieldset>

        {selection.mode === 'existing' && excludedFromSelectedGroup > 0 ? (
          <p className="text-[12px] text-muted-foreground">
            {excludedFromSelectedGroup} of {tabs.length}{' '}
            {excludedFromSelectedGroup === 1 ? 'tab is' : 'tabs are'} in a different window and
            won't be added to this group.
          </p>
        ) : null}

        {selection.mode === 'new' ? (
          <>
            <Separator />
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="new-group-name"
                className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
              >
                Group name
              </label>
              <Input
                id="new-group-name"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Group name"
              />
            </div>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Color
              </legend>
              <div className="flex flex-wrap items-center gap-2">
                {GROUP_COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={COLOR_LABELS[color]}
                    aria-pressed={newColor === color}
                    onClick={() => setNewColor(color)}
                    className={`size-6 shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                      newColor === color ? 'ring-2 ring-foreground ring-offset-2' : ''
                    }`}
                    style={{ backgroundColor: `var(--color-${color}, ${color})` }}
                  />
                ))}
              </div>
            </fieldset>
          </>
        ) : null}

        <DialogFooter>
          <Button variant="default" onClick={handleConfirm} disabled={!canConfirm || pending}>
            Add to group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
