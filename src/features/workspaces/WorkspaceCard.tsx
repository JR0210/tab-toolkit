import { useState } from 'react'
import { ExternalLinkIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { useBrowserGateway } from '../../chrome/use-browser-gateway'
import { useTabs } from '../tabs/use-tabs'
import { openWorkspace } from './open-workspace'
import { formatRelativeDate } from './relative-date'
import type { Workspace } from './workspace'
import { Button } from '../../shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../shared/ui/dialog'
import { Input } from '../../shared/ui/input'

const MAX_VISIBLE_FAVICONS = 4

interface WorkspaceCardProps {
  workspace: Workspace
  onRename: (id: string, newName: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  /** Injectable clock for deterministic relative-date rendering in tests. */
  now?: Date
}

export function WorkspaceCard({ workspace, onRename, onDelete, now }: WorkspaceCardProps) {
  const gateway = useBrowserGateway()
  const { refresh } = useTabs()
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [draftName, setDraftName] = useState(workspace.name)
  const [pending, setPending] = useState(false)
  const [opening, setOpening] = useState(false)

  const tabCount = workspace.tabs.length
  const visibleTabs = workspace.tabs.slice(0, MAX_VISIBLE_FAVICONS)
  const overflowCount = tabCount - visibleTabs.length

  const openRename = () => {
    setDraftName(workspace.name)
    setRenameOpen(true)
  }

  const submitRename = async () => {
    if (pending) {
      return
    }

    const trimmed = draftName.trim()

    if (!trimmed) {
      return
    }

    setPending(true)
    try {
      await onRename(workspace.id, trimmed)
      setRenameOpen(false)
    } catch {
      // The provider already surfaced a toast describing what went wrong;
      // keep the dialog open (skipped above) so the user can retry.
    } finally {
      setPending(false)
    }
  }

  const confirmDelete = async () => {
    setPending(true)
    try {
      await onDelete(workspace.id)
      setDeleteOpen(false)
    } catch {
      // The provider already surfaced a toast describing what went wrong;
      // keep the dialog open (skipped above) so the user can retry.
    } finally {
      setPending(false)
    }
  }

  const handleOpen = async () => {
    // Guards against a second click firing a second restore while the first
    // is still in flight.
    if (opening) {
      return
    }

    setOpening(true)

    try {
      const result = await openWorkspace(workspace, gateway)
      const openedCount = result.created.length
      const failedCount = result.failed.length
      const message = `Opened ${openedCount} ${openedCount === 1 ? 'tab' : 'tabs'} from “${workspace.name}”${
        failedCount > 0 ? `; ${failedCount} could not be opened.` : ''
      }`

      if (failedCount === 0) {
        toast.success(message)
      } else if (openedCount === 0) {
        toast.error(message)
      } else {
        toast.warning(message)
      }
    } catch {
      toast.error(`Could not open “${workspace.name}”. Try again.`)
    } finally {
      try {
        await refresh()
      } finally {
        setOpening(false)
      }
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="truncate text-sm font-medium text-card-foreground">{workspace.name}</h3>
          <p className="text-xs text-muted-foreground">
            <span>
              {tabCount} {tabCount === 1 ? 'tab' : 'tabs'}
            </span>{' '}
            · saved {formatRelativeDate(workspace.updatedAt, now)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Rename ${workspace.name}`}
            onClick={openRename}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${workspace.name}`}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {visibleTabs.map((tab, index) => (
          <FaviconInitial key={`${tab.url}-${index}`} url={tab.url} />
        ))}
        {overflowCount > 0 ? (
          <span
            data-testid="workspace-favicon-overflow"
            className="flex size-5 shrink-0 items-center justify-center rounded-[5px] bg-muted text-[10px] font-semibold text-muted-foreground"
          >
            +{overflowCount}
          </span>
        ) : null}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={opening}
        aria-label={`Open workspace: ${workspace.name}`}
        onClick={() => void handleOpen()}
      >
        <ExternalLinkIcon />
        Open workspace
      </Button>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename workspace</DialogTitle>
          </DialogHeader>
          <label
            className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground"
            htmlFor={`workspace-name-${workspace.id}`}
          >
            Name
            <Input
              id={`workspace-name-${workspace.id}`}
              value={draftName}
              autoFocus
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void submitRename()
                }
              }}
            />
          </label>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button onClick={() => void submitRename()} disabled={!draftName.trim() || pending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete workspace?</DialogTitle>
            <DialogDescription>
              &ldquo;{workspace.name}&rdquo; and its {tabCount} saved{' '}
              {tabCount === 1 ? 'tab' : 'tabs'} will be removed. You can undo this right after.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={pending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FaviconInitial({ url }: { url: string }) {
  const domain = extractDomain(url)
  const label = domain.charAt(0).toUpperCase() || '?'

  return (
    <span
      data-testid="workspace-favicon"
      aria-hidden="true"
      className="flex size-5 shrink-0 items-center justify-center rounded-[5px] bg-secondary text-[10px] font-semibold text-muted-foreground"
    >
      {label}
    </span>
  )
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}
