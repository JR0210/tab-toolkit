import { useMemo, useState } from 'react'
import {
  AlertCircleIcon,
  DownloadIcon,
  LayoutGridIcon,
  LoaderCircleIcon,
  SaveIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useBrowserGateway } from '../../chrome/use-browser-gateway'
import { Button } from '../../shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../shared/ui/dialog'
import { Input } from '../../shared/ui/input'
import { ImportDialog } from '../import/ImportDialog'
import { useWorkspaces } from './use-workspaces'
import { createChromeWorkspaceRepository } from './workspace-repository'
import { WorkspaceCard } from './WorkspaceCard'

export function WorkspacesView() {
  const {
    workspaces,
    status,
    error,
    saveCurrentWindow,
    renameWorkspace,
    deleteWorkspace,
    undoDelete,
    refresh,
  } = useWorkspaces()
  const gateway = useBrowserGateway()
  // Stable across renders so it doesn't defeat any memoization downstream;
  // createChromeWorkspaceRepository() resolves the chrome API lazily per
  // call, so a fresh instance here is functionally identical to the one
  // WorkspacesProvider uses -- both always read/write the same underlying
  // chrome.storage.local, there's no client-side cache to desync.
  const importRepository = useMemo(() => createChromeWorkspaceRepository(), [])
  const [saveOpen, setSaveOpen] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [saving, setSaving] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const openSaveDialog = () => {
    setDraftName('')
    setSaveOpen(true)
  }

  const handleSave = async () => {
    if (saving) {
      return
    }

    const trimmed = draftName.trim()

    if (!trimmed) {
      return
    }

    setSaving(true)
    try {
      await saveCurrentWindow(trimmed)
      setSaveOpen(false)
    } catch {
      // The provider already surfaced a toast describing what went wrong.
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteWorkspace(id)

    toast('Workspace deleted', {
      action: {
        label: 'Undo',
        onClick: () => {
          void undoDelete().then(
            () => toast.success('Workspace restored'),
            () => toast.error('Could not restore the workspace. Try again.'),
          )
        },
      },
    })
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-canvas px-6 text-center">
        <div role="status" className="flex flex-col items-center gap-2 text-muted-foreground">
          <LoaderCircleIcon aria-hidden="true" className="size-5 animate-spin" />
          <span className="text-sm">Loading workspaces…</span>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    const message = error instanceof Error ? error.message : 'Workspaces could not be loaded.'

    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-canvas px-6 text-center">
        <div role="alert" className="flex max-w-sm flex-col items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircleIcon aria-hidden="true" className="size-4" />
          </span>
          <h2 className="text-sm font-semibold text-foreground">Couldn’t load workspaces</h2>
          <p className="text-xs text-muted-foreground">{message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-medium text-foreground">Workspaces</h2>
          <p className="text-xs text-muted-foreground">Save sets of tabs and reopen them later.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <DownloadIcon />
            Import URLs
          </Button>
          <Button size="sm" onClick={openSaveDialog}>
            <SaveIcon />
            Save current window
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {workspaces.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center px-6 py-12 text-center">
            <div className="flex max-w-sm flex-col items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <LayoutGridIcon aria-hidden="true" className="size-4" />
              </span>
              <h2 className="text-sm font-semibold text-foreground">No workspaces yet</h2>
              <p className="text-xs text-muted-foreground">
                Save your current window to create your first workspace.
              </p>
              <Button size="sm" onClick={openSaveDialog}>
                <SaveIcon />
                Save current window
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {workspaces.map((workspace) => (
              <WorkspaceCard
                key={workspace.id}
                workspace={workspace}
                onRename={renameWorkspace}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save current window</DialogTitle>
          </DialogHeader>
          <label
            className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground"
            htmlFor="save-workspace-name"
          >
            Name
            <Input
              id="save-workspace-name"
              value={draftName}
              autoFocus
              placeholder="e.g. Research"
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleSave()
                }
              }}
            />
          </label>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button onClick={() => void handleSave()} disabled={!draftName.trim() || saving}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        gateway={gateway}
        repository={importRepository}
        onImported={() => void refresh()}
      />
    </div>
  )
}
