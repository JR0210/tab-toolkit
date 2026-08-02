import { useState } from 'react'
import {
  ArchiveIcon,
  ArrowDownAZIcon,
  ChevronDownIcon,
  CopyXIcon,
  ExternalLinkIcon,
  FolderPlusIcon,
  GlobeIcon,
  PinIcon,
  PinOffIcon,
  RefreshCwIcon,
  Volume2Icon,
  VolumeXIcon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useBrowserGateway } from '../../chrome/use-browser-gateway'
import type { BulkResult, TabRecord } from '../../domain/browser'
import { AddToGroupDialog } from '../organise/AddToGroupDialog'
import { DuplicatesDialog } from '../organise/DuplicatesDialog'
import { findDuplicateSets } from '../organise/duplicate-plan'
import { groupByDomain } from '../organise/group-tabs'
import { moveSelectionToNewWindow } from '../organise/move-to-window'
import { arrangeSelection } from '../organise/sort-tabs'
import type { ArrangeSort } from '../organise/sort-tabs'
import { Button } from '../../shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../shared/ui/dropdown-menu'
import { summarizeBulk } from './bulk-result'
import { createChromeCloseRepository } from './close-repository'
import type { CloseRepository } from './close-repository'
import { showBulkResultToast } from './lifecycle-toast'
import { useCloseTabs } from './use-close-tabs'
import { useTabs } from './use-tabs'

interface ManageTabsMenuProps {
  tabs: readonly TabRecord[]
  repository?: CloseRepository
}

/**
 * Bulk lifecycle actions for an explicit, ordered list of tabs (the current
 * selection, passed in from SelectionDock) — never read from context here,
 * so a stale selection can't silently act on the wrong tabs.
 */
export function ManageTabsMenu({
  tabs,
  repository = createChromeCloseRepository(),
}: ManageTabsMenuProps) {
  const gateway = useBrowserGateway()
  const { refresh } = useTabs()
  const closeSelected = useCloseTabs(repository)
  const [pending, setPending] = useState(false)
  const [addToGroupOpen, setAddToGroupOpen] = useState(false)
  const [duplicatesOpen, setDuplicatesOpen] = useState(false)

  const ids = tabs.map((tab) => tab.id)
  const hasDuplicates = findDuplicateSets(tabs).length > 0

  const runAction = async (
    verb: string,
    actionLabel: string,
    operation: (ids: number[]) => Promise<BulkResult>,
  ) => {
    setPending(true)

    try {
      const result = await operation(ids)
      showBulkResultToast(result, verb)
    } catch {
      toast.error(`Could not ${actionLabel} the tabs. Try again.`)
    } finally {
      try {
        await refresh()
      } finally {
        setPending(false)
      }
    }
  }

  const handlePin = () => runAction('Pinned', 'pin', (tabIds) => gateway.setPinned(tabIds, true))
  const handleUnpin = () =>
    runAction('Unpinned', 'unpin', (tabIds) => gateway.setPinned(tabIds, false))
  const handleMute = () => runAction('Muted', 'mute', (tabIds) => gateway.setMuted(tabIds, true))
  const handleUnmute = () =>
    runAction('Unmuted', 'unmute', (tabIds) => gateway.setMuted(tabIds, false))
  const handleReload = () => runAction('Reloaded', 'reload', (tabIds) => gateway.reloadTabs(tabIds))

  const handleDiscard = async () => {
    const eligible = tabs.filter((tab) => !tab.active && !tab.discarded)
    const skippedCount = tabs.length - eligible.length

    if (eligible.length === 0) {
      toast.error('No tabs were eligible to discard (active or already discarded).')
      return
    }

    setPending(true)

    try {
      const result = await gateway.discardTabs(eligible.map((tab) => tab.id))
      const skippedSuffix =
        skippedCount > 0
          ? ` (${skippedCount} ${skippedCount === 1 ? 'tab was' : 'tabs were'} skipped: active or already discarded.)`
          : ''

      if (result.succeeded.length === 0 && result.failed.length === 0) {
        return
      }

      toast[result.failed.length === 0 ? 'success' : 'error'](
        `${summarizeBulk(result, 'Discarded')}${skippedSuffix}`,
      )
    } catch {
      toast.error('Could not discard the tabs. Try again.')
    } finally {
      try {
        await refresh()
      } finally {
        setPending(false)
      }
    }
  }

  const handleMoveToNewWindow = async () => {
    setPending(true)

    try {
      const result = await moveSelectionToNewWindow(tabs, gateway)
      showBulkResultToast(result, 'Moved')
    } catch {
      toast.error('Could not move the tabs. Try again.')
    } finally {
      try {
        await refresh()
      } finally {
        setPending(false)
      }
    }
  }

  const handleArrange = async (sort: ArrangeSort) => {
    setPending(true)

    try {
      const result = await arrangeSelection(tabs, sort, gateway)
      showBulkResultToast(result, 'Arranged')
    } catch {
      toast.error('Could not arrange the tabs. Try again.')
    } finally {
      try {
        await refresh()
      } finally {
        setPending(false)
      }
    }
  }

  const handleSortByTitle = () => handleArrange('title')
  const handleSortByDomain = () => handleArrange('domain')

  const handleGroupByDomain = async () => {
    setPending(true)

    try {
      const result = await groupByDomain(tabs, gateway)
      showBulkResultToast(result, 'Grouped')
    } catch {
      toast.error('Could not group the tabs. Try again.')
    } finally {
      try {
        await refresh()
      } finally {
        setPending(false)
      }
    }
  }

  const handleClose = async () => {
    setPending(true)

    try {
      await closeSelected(tabs)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={pending} />}>
          Manage
          <ChevronDownIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handlePin} disabled={pending}>
            <PinIcon />
            Pin
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleUnpin} disabled={pending}>
            <PinOffIcon />
            Unpin
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleMute} disabled={pending}>
            <VolumeXIcon />
            Mute
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleUnmute} disabled={pending}>
            <Volume2Icon />
            Unmute
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleReload} disabled={pending}>
            <RefreshCwIcon />
            Reload
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDiscard} disabled={pending}>
            <ArchiveIcon />
            Discard
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleMoveToNewWindow} disabled={pending}>
            <ExternalLinkIcon />
            Move to new window
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSortByTitle} disabled={pending}>
            <ArrowDownAZIcon />
            Sort by title
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSortByDomain} disabled={pending}>
            <GlobeIcon />
            Sort by domain
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleGroupByDomain} disabled={pending}>
            <FolderPlusIcon />
            Group by domain
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAddToGroupOpen(true)} disabled={pending}>
            <FolderPlusIcon />
            Add to group...
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDuplicatesOpen(true)}
            disabled={pending || !hasDuplicates}
          >
            <CopyXIcon />
            Find duplicates...
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleClose} disabled={pending} variant="destructive">
            <XIcon />
            Close
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AddToGroupDialog open={addToGroupOpen} onOpenChange={setAddToGroupOpen} tabs={tabs} />
      <DuplicatesDialog
        open={duplicatesOpen}
        onOpenChange={setDuplicatesOpen}
        tabs={tabs}
        repository={repository}
      />
    </>
  )
}
