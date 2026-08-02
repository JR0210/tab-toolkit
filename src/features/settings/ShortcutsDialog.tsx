import { keysForPlatform } from '../shortcuts/match-shortcut'
import { SHORTCUTS } from '../shortcuts/shortcut-definitions'
import { usePlatformFamily } from '../shortcuts/use-popup-shortcuts'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../shared/ui/dialog'

interface ShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Renders every SHORTCUTS entry's action label and platform-appropriate
 * keycap. The keycap always comes from keysForPlatform (Task 2) applied to
 * the platform resolved by usePlatformFamily (Task 1/3) -- never a literal
 * glyph here -- so this list can never drift from what actually matches a
 * keydown.
 */
export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const platform = usePlatformFamily()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Shortcuts work while this popup has focus.</DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-1">
          {SHORTCUTS.map((definition) => {
            const { label } = keysForPlatform(definition, platform)

            return (
              <li
                key={definition.command}
                className="flex items-center justify-between gap-3 py-0.5 text-[13px]"
              >
                <span className="text-foreground">{definition.action}</span>
                <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {label}
                </kbd>
              </li>
            )
          })}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
