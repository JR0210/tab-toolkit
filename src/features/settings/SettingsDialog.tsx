import { useState } from 'react'
import { BookOpenIcon } from 'lucide-react'
import { useBrowserGateway } from '../../chrome/use-browser-gateway'
import { COPY_FORMAT_LABELS, COPY_FORMATS } from '../export/copy-actions'
import { defaultSettings } from '../../shared/settings/settings'
import type { Scope, Theme } from '../../shared/settings/settings'
import { useSettings } from '../../shared/settings/use-settings'
import { Button } from '../../shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../shared/ui/dialog'
import { Separator } from '../../shared/ui/separator'
import { useInvokeAction } from '../shortcuts/use-popup-shortcuts'
import { ShortcutsDialog } from './ShortcutsDialog'

const TAB_TOOLKIT_REPOSITORY_URL = 'https://github.com/JR0210/tab-toolkit'

const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

const SCOPE_LABELS: Record<Scope, string> = {
  current: 'Current window',
  all: 'All windows',
}

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { settings, updateSettings } = useSettings()
  const gateway = useBrowserGateway()
  const invokeAction = useInvokeAction()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const handleReset = () => {
    void updateSettings(defaultSettings)
    // Reaches into TabsView's live filter state and AppShell's view state --
    // both live outside this dialog's own subtree (it's rendered from
    // Header) -- via the same registration mechanism the keyboard shortcuts
    // use, rather than a second cross-tree channel.
    invokeAction('reset-filters')
    invokeAction('reset-view')
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>

          <RadioGroup
            legend="Theme"
            name="settings-theme"
            options={THEME_LABELS}
            value={settings.theme}
            onChange={(theme) => void updateSettings({ theme })}
          />

          <Separator />

          <RadioGroup
            legend="Default scope"
            name="settings-scope"
            options={SCOPE_LABELS}
            value={settings.scope}
            onChange={(scope) => void updateSettings({ scope })}
          />

          <Separator />

          <RadioGroup
            legend="Default copy format"
            name="settings-copy-format"
            options={COPY_FORMAT_LABELS}
            optionOrder={COPY_FORMATS}
            value={settings.copyFormat}
            onChange={(copyFormat) => void updateSettings({ copyFormat })}
          />

          <Separator />

          <div className="flex flex-col gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setShortcutsOpen(true)}>
              Keyboard shortcuts
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void gateway.openUrl(TAB_TOOLKIT_REPOSITORY_URL)}
            >
              <BookOpenIcon />
              Help & documentation
            </Button>
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            Tab Toolkit version {gateway.getManifestVersion()}
          </p>

          <DialogFooter>
            <Button variant="ghost" onClick={handleReset}>
              Reset to defaults
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  )
}

function RadioGroup<Value extends string>({
  legend,
  name,
  options,
  optionOrder,
  value,
  onChange,
}: {
  legend: string
  name: string
  options: Record<Value, string>
  optionOrder?: readonly Value[]
  value: Value
  onChange: (value: Value) => void
}) {
  const values = optionOrder ?? (Object.keys(options) as Value[])

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {legend}
      </legend>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {values.map((optionValue) => (
          <label key={optionValue} className="flex cursor-pointer items-center gap-2 text-[13px]">
            <input
              type="radio"
              name={name}
              checked={value === optionValue}
              onChange={() => onChange(optionValue)}
              className="size-4 shrink-0 cursor-pointer accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {options[optionValue]}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
