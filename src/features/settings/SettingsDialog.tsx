import { useState } from 'react'
import { BookOpenIcon } from 'lucide-react'
import { useBrowserGateway } from '../../chrome/use-browser-gateway'
import { COPY_FORMAT_LABELS, COPY_FORMATS } from '../export/copy-actions'
import { defaultSettings } from '../../shared/settings/settings'
import type { CopyFormat, Scope, Theme } from '../../shared/settings/settings'
import { useSettings } from '../../shared/settings/use-settings'
import { Button } from '../../shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../shared/ui/dialog'
import { RadioGroup } from '../../shared/ui/radio-group'
import type { RadioOption } from '../../shared/ui/radio-group'
import { Separator } from '../../shared/ui/separator'
import { useInvokeAction } from '../shortcuts/use-shortcut-actions'
import { ShortcutsDialog } from './ShortcutsDialog'

const TAB_TOOLKIT_REPOSITORY_URL = 'https://github.com/JR0210/tab-toolkit'

const THEME_OPTIONS: readonly RadioOption<Theme>[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

const SCOPE_OPTIONS: readonly RadioOption<Scope>[] = [
  { value: 'current', label: 'Current window' },
  { value: 'all', label: 'All windows' },
]

const COPY_FORMAT_OPTIONS: readonly RadioOption<CopyFormat>[] = COPY_FORMATS.map((format) => ({
  value: format,
  label: COPY_FORMAT_LABELS[format],
}))

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
    void updateSettings(defaultSettings).catch(() => undefined)
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
            layout="wrap"
            options={THEME_OPTIONS}
            value={settings.theme}
            onChange={(theme) => void updateSettings({ theme }).catch(() => undefined)}
          />

          <Separator />

          <RadioGroup
            legend="Default scope"
            name="settings-scope"
            layout="wrap"
            options={SCOPE_OPTIONS}
            value={settings.scope}
            onChange={(scope) => void updateSettings({ scope }).catch(() => undefined)}
          />

          <Separator />

          <RadioGroup
            legend="Default copy format"
            name="settings-copy-format"
            layout="wrap"
            options={COPY_FORMAT_OPTIONS}
            value={settings.copyFormat}
            onChange={(copyFormat) => void updateSettings({ copyFormat }).catch(() => undefined)}
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
