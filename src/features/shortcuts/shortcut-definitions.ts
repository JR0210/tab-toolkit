export type ShortcutCommand =
  | 'focus-search'
  | 'select-visible'
  | 'copy-selected'
  | 'export-selected'
  | 'close-selected'
  | 'undo-close'
  | 'show-tabs'
  | 'show-workspaces'
  | 'escape'

export interface ShortcutDefinition {
  command: ShortcutCommand
  /**
   * The non-platform key. For every command except 'close-selected' this is
   * the literal KeyboardEvent.key to match. 'close-selected' uses the
   * sentinel value 'Delete' to mean "use the platform's logical destructive
   * key" (Backspace on mac, Delete elsewhere) -- see match-shortcut.ts.
   */
  key: string
  action: string
  /** Defaults to true (requires the platform's primary modifier). */
  modifier?: boolean
}

export const SHORTCUTS = [
  { command: 'focus-search', key: 'k', action: 'Focus search' },
  { command: 'select-visible', key: 'a', action: 'Select all visible tabs' },
  { command: 'copy-selected', key: 'c', action: 'Copy selected tabs' },
  { command: 'export-selected', key: 'e', action: 'Export selected tabs' },
  { command: 'close-selected', key: 'Delete', action: 'Close selected tabs' },
  { command: 'undo-close', key: 'z', action: 'Undo last close' },
  { command: 'show-tabs', key: '1', action: 'Switch to Tabs' },
  { command: 'show-workspaces', key: '2', action: 'Switch to Workspaces' },
  { command: 'escape', key: 'Escape', action: 'Close or clear the active layer', modifier: false },
] as const satisfies readonly ShortcutDefinition[]
