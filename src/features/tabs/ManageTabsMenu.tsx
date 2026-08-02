import { useState } from 'react'
import {
  ArchiveIcon,
  ChevronDownIcon,
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
import { showBulkResultToast, showCloseToast } from './lifecycle-toast'
import { closeTabs } from './tab-lifecycle-service'
import { useTabInteractions } from './use-tab-interactions'
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
  const { snapshot, refresh } = useTabs()
  const { setManySelected } = useTabInteractions()
  const [pending, setPending] = useState(false)

  const ids = tabs.map((tab) => tab.id)

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

  const handleClose = async () => {
    setPending(true)

    try {
      const groupsById = new Map((snapshot?.groups ?? []).map((group) => [group.id, group]))
      const result = await closeTabs(tabs, groupsById, gateway, repository)

      setManySelected(result.succeeded, false)
      showCloseToast(result, gateway, repository, refresh)
    } catch {
      toast.error('Could not close the tabs. Try again.')
    } finally {
      try {
        await refresh()
      } finally {
        setPending(false)
      }
    }
  }

  return (
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
        <DropdownMenuItem onClick={handleClose} disabled={pending} variant="destructive">
          <XIcon />
          Close
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
