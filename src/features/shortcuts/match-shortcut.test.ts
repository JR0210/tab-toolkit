import { describe, expect, it } from 'vitest'
import type { PlatformFamily } from '../../platform/platform'
import { isEditableTarget, keysForPlatform, matchShortcut } from './match-shortcut'
import { SHORTCUTS } from './shortcut-definitions'
import type { ShortcutDefinition } from './shortcut-definitions'

const PLATFORMS: PlatformFamily[] = ['mac', 'non-mac']
const definitions: readonly ShortcutDefinition[] = SHORTCUTS

function createEvent(
  overrides: {
    key?: string
    metaKey?: boolean
    ctrlKey?: boolean
    altKey?: boolean
    shiftKey?: boolean
    target?: EventTarget | null
  } = {},
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: overrides.key ?? 'a',
    metaKey: overrides.metaKey ?? false,
    ctrlKey: overrides.ctrlKey ?? false,
    altKey: overrides.altKey ?? false,
    shiftKey: overrides.shiftKey ?? false,
  })

  if (overrides.target !== undefined) {
    Object.defineProperty(event, 'target', { value: overrides.target, configurable: true })
  }

  return event
}

function eventKeyFor(definition: ShortcutDefinition, platform: PlatformFamily): string {
  if (definition.command === 'close-selected') {
    return platform === 'mac' ? 'Backspace' : 'Delete'
  }

  return definition.key
}

describe('keysForPlatform', () => {
  it('requires exactly the platform primary modifier for every non-escape command', () => {
    for (const definition of definitions) {
      if (definition.command === 'escape') {
        continue
      }

      for (const platform of PLATFORMS) {
        const { matches } = keysForPlatform(definition, platform)
        const key = eventKeyFor(definition, platform)

        expect(
          matches(createEvent({ key, metaKey: platform === 'mac', ctrlKey: platform === 'non-mac' })),
        ).toBe(true)

        // The other platform's modifier alone must never match.
        expect(
          matches(createEvent({ key, metaKey: platform === 'non-mac', ctrlKey: platform === 'mac' })),
        ).toBe(false)

        // No modifier at all must never match.
        expect(matches(createEvent({ key }))).toBe(false)
      }
    }
  })

  it('rejects unrelated Alt/Shift combinations even with the right base key and modifier', () => {
    const focusSearch = definitions.find((definition) => definition.command === 'focus-search')!

    for (const platform of PLATFORMS) {
      const { matches } = keysForPlatform(focusSearch, platform)
      const primary = { metaKey: platform === 'mac', ctrlKey: platform === 'non-mac' }

      expect(matches(createEvent({ key: 'k', altKey: true }))).toBe(false)
      expect(matches(createEvent({ key: 'k', ...primary, altKey: true }))).toBe(false)
      expect(matches(createEvent({ key: 'k', ...primary, shiftKey: true }))).toBe(false)
    }
  })

  it('matches close-selected against the mac Backspace key and not Delete', () => {
    const closeSelected = definitions.find((definition) => definition.command === 'close-selected')!
    const { matches } = keysForPlatform(closeSelected, 'mac')

    expect(matches(createEvent({ key: 'Backspace', metaKey: true }))).toBe(true)
    expect(matches(createEvent({ key: 'Delete', metaKey: true }))).toBe(false)
  })

  it('matches close-selected against the non-mac Delete key and not Backspace', () => {
    const closeSelected = definitions.find((definition) => definition.command === 'close-selected')!
    const { matches } = keysForPlatform(closeSelected, 'non-mac')

    expect(matches(createEvent({ key: 'Delete', ctrlKey: true }))).toBe(true)
    expect(matches(createEvent({ key: 'Backspace', ctrlKey: true }))).toBe(false)
  })

  it('renders the command and backspace glyphs on mac, Ctrl and Delete elsewhere', () => {
    const focusSearch = definitions.find((definition) => definition.command === 'focus-search')!
    const closeSelected = definitions.find((definition) => definition.command === 'close-selected')!

    expect(keysForPlatform(focusSearch, 'mac').label).toContain('⌘')
    expect(keysForPlatform(focusSearch, 'non-mac').label).toContain('Ctrl')
    expect(keysForPlatform(closeSelected, 'mac').label).toContain('⌫')
    expect(keysForPlatform(closeSelected, 'non-mac').label).toContain('Delete')
  })

  it('does not require a modifier for escape and rejects a modified escape', () => {
    const escapeDefinition = definitions.find((definition) => definition.command === 'escape')!

    for (const platform of PLATFORMS) {
      const { matches } = keysForPlatform(escapeDefinition, platform)

      expect(matches(createEvent({ key: 'Escape' }))).toBe(true)
      expect(matches(createEvent({ key: 'Escape', ctrlKey: true }))).toBe(false)
      expect(matches(createEvent({ key: 'Escape', metaKey: true }))).toBe(false)
      expect(matches(createEvent({ key: 'Escape', shiftKey: true }))).toBe(false)
      expect(matches(createEvent({ key: 'Escape', altKey: true }))).toBe(false)
    }
  })

  it('produces a label for every registry entry on both platforms', () => {
    for (const definition of definitions) {
      for (const platform of PLATFORMS) {
        expect(keysForPlatform(definition, platform).label.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('isEditableTarget', () => {
  it('treats input, textarea, and select elements as editable', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true)
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true)
    expect(isEditableTarget(document.createElement('select'))).toBe(true)
  })

  it('treats an element nested inside a contenteditable ancestor as editable', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('contenteditable', 'true')
    const span = document.createElement('span')
    wrapper.appendChild(span)

    expect(isEditableTarget(span)).toBe(true)
  })

  it('treats a plain element and null as non-editable', () => {
    expect(isEditableTarget(document.createElement('div'))).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })
})

describe('matchShortcut', () => {
  it('matches every registry command on the platform it targets', () => {
    for (const definition of definitions) {
      for (const platform of PLATFORMS) {
        const requiresModifier = definition.modifier !== false
        const event = createEvent({
          key: eventKeyFor(definition, platform),
          metaKey: requiresModifier && platform === 'mac',
          ctrlKey: requiresModifier && platform === 'non-mac',
        })

        expect(matchShortcut(event, platform)).toBe(definition.command)
      }
    }
  })

  it('returns null for a non-escape command while an input is focused', () => {
    const input = document.createElement('input')
    const event = createEvent({ key: 'k', metaKey: true, target: input })

    expect(matchShortcut(event, 'mac')).toBeNull()
  })

  it('still matches escape while an input is focused', () => {
    const input = document.createElement('input')
    const event = createEvent({ key: 'Escape', target: input })

    expect(matchShortcut(event, 'mac')).toBe('escape')
  })

  it('returns null when no definition matches', () => {
    const event = createEvent({ key: 'q', metaKey: true })

    expect(matchShortcut(event, 'mac')).toBeNull()
  })
})
