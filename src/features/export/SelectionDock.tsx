import { ChevronDownIcon, ClipboardIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { TabRecord } from '../../domain/browser'
import { createClipboardGateway } from '../../platform/clipboard-gateway'
import type { ClipboardGateway } from '../../platform/clipboard-gateway'
import type { CopyFormat } from '../../shared/settings/settings'
import { useSettings } from '../../shared/settings/use-settings'
import { Button } from '../../shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../shared/ui/dropdown-menu'
import { useTabInteractions } from '../tabs/use-tab-interactions'
import { COPY_FORMAT_LABELS, COPY_FORMATS, copyTabsToClipboard } from './copy-actions'

interface SelectionDockProps {
  clipboard?: ClipboardGateway
}

export function SelectionDock({ clipboard = createClipboardGateway() }: SelectionDockProps) {
  const { selectedTabs, clearSelection } = useTabInteractions()
  const { settings, updateSettings } = useSettings()

  if (selectedTabs.length === 0) {
    return null
  }

  const runCopy = (tabs: readonly TabRecord[], format: CopyFormat) => {
    copyTabsToClipboard(tabs, format, clipboard).then(
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

        {/* Export lands here (Task 4). Manage/Close land here in Loop 05+. */}

        <Button variant="ghost" size="sm" onClick={clearSelection}>
          <XIcon />
          Clear
        </Button>
      </div>
    </div>
  )
}
