import { useState } from 'react'
import { toast } from 'sonner'
import type { BrowserGateway } from '../../chrome/browser-gateway'
import type { WorkspaceRepository } from '../workspaces/workspace-repository'
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
import { importUrls } from './import-service'
import { parseUrlLines } from './parse-urls'
import type { ImportResult } from './import-service'

const PREVIEW_LIMIT = 4

const TEXTAREA_CLASS =
  'min-h-24 w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gateway: BrowserGateway
  repository: WorkspaceRepository
  /** Called after a successful import so the caller can refresh its own state. */
  onImported?: () => void
}

export function ImportDialog({
  open,
  onOpenChange,
  gateway,
  repository,
  onImported,
}: ImportDialogProps) {
  const [text, setText] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [importing, setImporting] = useState(false)

  const parsed = parseUrlLines(text)
  const trimmedName = workspaceName.trim()
  // A fully empty name means "no workspace requested" (valid, allowed). A
  // name that's non-empty but trims to nothing means the user typed
  // something meaningless -- disable Import until they fix or clear it.
  const nameIsInvalid = workspaceName.length > 0 && trimmedName.length === 0
  const canImport = parsed.valid.length > 0 && !nameIsInvalid && !importing

  const resetDraft = () => {
    setText('')
    setWorkspaceName('')
  }

  const handleImport = async () => {
    if (!canImport) {
      return
    }

    setImporting(true)

    try {
      const result = await importUrls(
        { text, workspaceName: trimmedName || undefined },
        { gateway, repository },
      )
      onOpenChange(false)
      resetDraft()
      onImported?.()
      toast.success(describeResult(result))
    } catch {
      toast.error('Could not import URLs. Try again.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          resetDraft()
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import URLs</DialogTitle>
          <DialogDescription>
            Paste one URL per line. They&rsquo;ll open together in a new window.
          </DialogDescription>
        </DialogHeader>

        <label
          className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground"
          htmlFor="import-urls-text"
        >
          URLs
          <textarea
            id="import-urls-text"
            value={text}
            autoFocus
            rows={6}
            placeholder={'https://example.com\nhttps://example.org'}
            className={TEXTAREA_CLASS}
            onChange={(event) => setText(event.target.value)}
          />
        </label>

        <p className="text-xs text-muted-foreground">
          {parsed.valid.length} valid {parsed.valid.length === 1 ? 'URL' : 'URLs'}
          {parsed.invalid.length > 0
            ? `, ${parsed.invalid.length} invalid ${parsed.invalid.length === 1 ? 'line' : 'lines'}`
            : ''}
        </p>

        {parsed.valid.length > 0 ? (
          <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            {parsed.valid.slice(0, PREVIEW_LIMIT).map((entry) => (
              <li key={entry.line} className="truncate">
                {entry.url}
              </li>
            ))}
          </ul>
        ) : null}

        {parsed.invalid.length > 0 ? (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground select-none">
              {parsed.invalid.length} invalid {parsed.invalid.length === 1 ? 'line' : 'lines'}
            </summary>
            <ul className="mt-1 flex flex-col gap-1">
              {parsed.invalid.map((issue) => (
                <li key={issue.line}>
                  Line {issue.line}: &ldquo;{issue.input}&rdquo; &mdash; {issue.reason}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <label
          className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground"
          htmlFor="import-workspace-name"
        >
          Save as workspace (optional)
          <Input
            id="import-workspace-name"
            value={workspaceName}
            placeholder="e.g. Reading list"
            aria-invalid={nameIsInvalid}
            onChange={(event) => setWorkspaceName(event.target.value)}
          />
        </label>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={() => void handleImport()} disabled={!canImport}>
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function describeResult(result: ImportResult): string {
  const parts = [`Opened ${result.openedCount} ${result.openedCount === 1 ? 'tab' : 'tabs'}`]

  if (result.failedCount > 0) {
    parts.push(`${result.failedCount} could not be opened`)
  }

  if (result.savedCount > 0) {
    parts.push(
      `saved ${result.savedCount} ${result.savedCount === 1 ? 'URL' : 'URLs'} to a new workspace`,
    )
  }

  if (result.parseErrorCount > 0) {
    parts.push(
      `${result.parseErrorCount} invalid ${result.parseErrorCount === 1 ? 'line was' : 'lines were'} skipped`,
    )
  }

  return parts.join('; ')
}
