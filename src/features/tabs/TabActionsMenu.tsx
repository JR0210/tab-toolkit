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
import { useBulkAction } from './use-bulk-action'
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
  const { pending, run } = useBulkAction()

  const canDiscard = !tab.active && !tab.discarded

  const runAction = (verb: string, actionLabel: string, operation: () => Promise<BulkResult>) =>
    run(operation, {
      onSuccess: (result) => showBulkResultToast(result, verb),
      errorMessage: `Could not ${actionLabel} the tab. Try again.`,
    })

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

  const handleClose = () =>
    run(
      async () => {
        const groupsById = new Map((snapshot?.groups ?? []).map((group) => [group.id, group]))
        return closeTabs([tab], groupsById, gateway, repository)
      },
      {
        onSuccess: (result) => {
          setManySelected(result.succeeded, false)
          showCloseToast(result, gateway, repository, refresh)
        },
        errorMessage: 'Could not close the tab. Try again.',
      },
    )

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
