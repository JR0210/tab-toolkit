import { useCallback, useState } from 'react'
import { ChevronDownIcon, ClipboardIcon, DownloadIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { TabRecord } from '../../domain/browser'
import { createClipboardGateway } from '../../platform/clipboard-gateway'
import type { ClipboardGateway } from '../../platform/clipboard-gateway'
import type { DownloadGateway } from '../../platform/download-gateway'
import type { CopyFormat } from '../../shared/settings/settings'
import { useSettings } from '../../shared/settings/use-settings'
import { Button } from '../../shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../shared/ui/dropdown-menu'
import { useRegisterShortcut } from '../shortcuts/use-shortcut-actions'
import { createChromeCloseRepository } from '../tabs/close-repository'
import type { CloseRepository } from '../tabs/close-repository'
import { ManageTabsMenu } from '../tabs/ManageTabsMenu'
import { useCloseTabs } from '../tabs/use-close-tabs'
import { useTabInteractions } from '../tabs/use-tab-interactions'
import { useTabs } from '../tabs/use-tabs'
import { COPY_FORMAT_LABELS, COPY_FORMATS, copyTabsToClipboard } from './copy-actions'
import { ExportDialog } from './ExportDialog'

interface SelectionDockProps {
  clipboard?: ClipboardGateway
  download?: DownloadGateway
  closeRepository?: CloseRepository
}

export function SelectionDock({
  clipboard = createClipboardGateway(),
  download,
  closeRepository = createChromeCloseRepository(),
}: SelectionDockProps) {
  const { selectedTabs, clearSelection } = useTabInteractions()
  const { snapshot } = useTabs()
  const { settings, updateSettings } = useSettings()
  const closeSelected = useCloseTabs(closeRepository)
  const [exportOpen, setExportOpen] = useState(false)
  const hasSelection = selectedTabs.length > 0

  const runCopy = (tabs: readonly TabRecord[], format: CopyFormat) => {
    Promise.resolve()
      .then(() => copyTabsToClipboard(tabs, format, clipboard))
      .then(
        () => {
          toast.success(tabs.length === 1 ? 'Copied 1 tab' : `Copied ${tabs.length} tabs`)
        },
        () => {
          toast.error('Could not copy to the clipboard. Try again.')
        },
      )
  }

  const handlePrimaryCopy = () => {
    runCopy(selectedTabs, settings.copyFormat)
  }

  const handleFormatChoice = (format: CopyFormat) => {
    void updateSettings({ copyFormat: format })
    runCopy(selectedTabs, format)
  }

  const handleCloseSelected = useCallback(() => {
    void closeSelected(selectedTabs)
  }, [closeSelected, selectedTabs])

  // Registering only while there's an actual selection (null otherwise)
  // means these three commands naturally do nothing when nothing is
  // selected -- there's no separate "is anything selected" check needed at
  // the shortcut-routing layer.
  useRegisterShortcut('copy-selected', hasSelection ? handlePrimaryCopy : null)
  useRegisterShortcut('export-selected', hasSelection ? () => setExportOpen(true) : null)
  useRegisterShortcut('close-selected', hasSelection ? handleCloseSelected : null)

  if (!hasSelection) {
    return null
  }

  return (
    <div
      role="toolbar"
      aria-label="Selected tabs"
      className="flex items-center gap-2 border-t border-border bg-popover px-3 py-2 text-popover-foreground shadow-md"
    >
      <span className="font-mono text-[11px] text-muted-foreground">
        {selectedTabs.length} selected
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="inline-flex overflow-hidden rounded-lg">
          <Button
            variant="default"
            size="sm"
            className="rounded-r-none"
            onClick={handlePrimaryCopy}
          >
            <ClipboardIcon />
            {`Copy ${COPY_FORMAT_LABELS[settings.copyFormat]}`}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="default"
                  size="icon-sm"
                  className="rounded-l-none border-l border-primary-foreground/20"
                  aria-label="Choose copy format"
                />
              }
            >
              <ChevronDownIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {COPY_FORMATS.map((format) => (
                <DropdownMenuItem key={format} onClick={() => handleFormatChoice(format)}>
                  {COPY_FORMAT_LABELS[format]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
          <DownloadIcon />
          Export
        </Button>

        <ManageTabsMenu tabs={selectedTabs} repository={closeRepository} />

        <Button variant="ghost" size="sm" onClick={clearSelection}>
          <XIcon />
          Clear
        </Button>
      </div>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        tabs={selectedTabs}
        groups={snapshot?.groups ?? []}
        download={download}
      />
    </div>
  )
}
