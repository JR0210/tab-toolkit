import { useState } from 'react'
import {
  ArchiveIcon,
  EllipsisVerticalIcon,
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
import { createChromeCloseRepository } from './close-repository'
import type { CloseRepository } from './close-repository'
import { showBulkResultToast, showCloseToast } from './lifecycle-toast'
import { closeTabs } from './tab-lifecycle-service'
import { useTabInteractions } from './use-tab-interactions'
import { useTabs } from './use-tabs'

interface TabActionsMenuProps {
  tab: TabRecord
  repository?: CloseRepository
}

/**
 * Per-row lifecycle actions. Every action operates on this single tab's id
 * explicitly (never on whatever happens to be selected elsewhere).
 */
export function TabActionsMenu({
  tab,
  repository = createChromeCloseRepository(),
}: TabActionsMenuProps) {
  const gateway = useBrowserGateway()
  const { snapshot, refresh } = useTabs()
  const { setManySelected } = useTabInteractions()
  const [pending, setPending] = useState(false)

  const canDiscard = !tab.active && !tab.discarded

  const runAction = async (
    verb: string,
    actionLabel: string,
    operation: () => Promise<BulkResult>,
  ) => {
    setPending(true)

    try {
      const result = await operation()
      showBulkResultToast(result, verb)
    } catch {
      toast.error(`Could not ${actionLabel} the tab. Try again.`)
    } finally {
      try {
        await refresh()
      } finally {
        setPending(false)
      }
    }
  }

  const handlePinToggle = () =>
    runAction(tab.pinned ? 'Unpinned' : 'Pinned', tab.pinned ? 'unpin' : 'pin', () =>
      gateway.setPinned([tab.id], !tab.pinned),
    )
  const handleMuteToggle = () =>
    runAction(tab.muted ? 'Unmuted' : 'Muted', tab.muted ? 'unmute' : 'mute', () =>
      gateway.setMuted([tab.id], !tab.muted),
    )
  const handleReload = () => runAction('Reloaded', 'reload', () => gateway.reloadTabs([tab.id]))
  const handleDiscard = () => runAction('Discarded', 'discard', () => gateway.discardTabs([tab.id]))

  const handleClose = async () => {
    setPending(true)

    try {
      const groupsById = new Map((snapshot?.groups ?? []).map((group) => [group.id, group]))
      const result = await closeTabs([tab], groupsById, gateway, repository)

      setManySelected(result.succeeded, false)
      showCloseToast(result, gateway, repository, refresh)
    } catch {
      toast.error('Could not close the tab. Try again.')
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
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Actions for ${tab.title} (tab ${tab.id}, window ${tab.windowId})`}
            title="Tab actions"
            disabled={pending}
          />
        }
      >
        <EllipsisVerticalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handlePinToggle} disabled={pending}>
          {tab.pinned ? <PinOffIcon /> : <PinIcon />}
          {tab.pinned ? 'Unpin' : 'Pin'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleMuteToggle} disabled={pending}>
          {tab.muted ? <Volume2Icon /> : <VolumeXIcon />}
          {tab.muted ? 'Unmute' : 'Mute'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleReload} disabled={pending}>
          <RefreshCwIcon />
          Reload
        </DropdownMenuItem>
        {canDiscard ? (
          <DropdownMenuItem onClick={handleDiscard} disabled={pending}>
            <ArchiveIcon />
            Discard
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={handleClose} disabled={pending} variant="destructive">
          <XIcon />
          Close
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
