import { describe, expect, it } from 'vitest'
import { SHORTCUTS } from './shortcut-definitions'
import type { ShortcutDefinition } from './shortcut-definitions'

const definitions: readonly ShortcutDefinition[] = SHORTCUTS

describe('SHORTCUTS', () => {
  it('encodes the exact registry defined by the plan', () => {
    expect(SHORTCUTS).toEqual([
      { command: 'focus-search', key: 'k', action: 'Focus search' },
      { command: 'select-visible', key: 'a', action: 'Select all visible tabs' },
      { command: 'copy-selected', key: 'c', action: 'Copy selected tabs' },
      { command: 'export-selected', key: 'e', action: 'Export selected tabs' },
      { command: 'close-selected', key: 'Delete', action: 'Close selected tabs' },
      { command: 'undo-close', key: 'z', action: 'Undo last close' },
      { command: 'show-tabs', key: '1', action: 'Switch to Tabs' },
      { command: 'show-workspaces', key: '2', action: 'Switch to Workspaces' },
      {
        command: 'escape',
        key: 'Escape',
        action: 'Close or clear the active layer',
        modifier: false,
      },
    ])
  })

  it('has a unique command id for every entry', () => {
    const commands = definitions.map((definition) => definition.command)
    expect(new Set(commands).size).toBe(commands.length)
  })

  it('requires a modifier for every command except escape', () => {
    for (const definition of definitions) {
      if (definition.command === 'escape') {
        expect(definition.modifier).toBe(false)
      } else {
        expect(definition.modifier).not.toBe(false)
      }
    }
  })
})
