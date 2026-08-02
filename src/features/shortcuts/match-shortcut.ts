import type { PlatformFamily } from '../../platform/platform'
import { destructiveKeyLabel, modifierLabel } from '../../platform/platform'
import { SHORTCUTS } from './shortcut-definitions'
import type { ShortcutCommand, ShortcutDefinition } from './shortcut-definitions'

export interface PlatformShortcutKeys {
  label: string
  matches: (event: KeyboardEvent) => boolean
}

/**
 * Resolves the logical registry key to the literal KeyboardEvent.key that
 * should be matched on the given platform. Every command uses its own key
 * literally except 'close-selected', whose registry key ('Delete') is a
 * sentinel meaning "the platform's destructive key" -- Backspace on mac,
 * Delete elsewhere.
 */
function eventKeyFor(definition: ShortcutDefinition, platform: PlatformFamily): string {
  if (definition.command === 'close-selected') {
    return platform === 'mac' ? 'Backspace' : 'Delete'
  }

  return definition.key
}

function keyLabelFor(definition: ShortcutDefinition, platform: PlatformFamily): string {
  if (definition.command === 'close-selected') {
    return destructiveKeyLabel(platform)
  }

  if (definition.key === 'Escape') {
    return 'Esc'
  }

  return definition.key.length === 1 ? definition.key.toUpperCase() : definition.key
}

function keyMatches(eventKey: string, targetKey: string): boolean {
  if (targetKey.length === 1) {
    return eventKey.length === 1 && eventKey.toLowerCase() === targetKey.toLowerCase()
  }

  return eventKey === targetKey
}

/**
 * Generates both the rendered keycap label and the event-matching predicate
 * for a single definition on a single platform, from the same source data,
 * so labels shown in the UI can never drift from what the router actually
 * matches.
 */
export function keysForPlatform(
  definition: ShortcutDefinition,
  platform: PlatformFamily,
): PlatformShortcutKeys {
  const requiresModifier = definition.modifier !== false
  const targetKey = eventKeyFor(definition, platform)
  const keyLabel = keyLabelFor(definition, platform)
  const label = requiresModifier
    ? platform === 'mac'
      ? `${modifierLabel(platform)}${keyLabel}`
      : `${modifierLabel(platform)}+${keyLabel}`
    : keyLabel

  return {
    label,
    matches: (event: KeyboardEvent) => {
      if (!keyMatches(event.key, targetKey)) {
        return false
      }

      if (requiresModifier) {
        return platform === 'mac'
          ? event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey
          : event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey
      }

      return !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey
    },
  }
}

const EDITABLE_TAGS = new Set(['input', 'textarea', 'select'])

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false
  }

  if (EDITABLE_TAGS.has(target.tagName.toLowerCase())) {
    return true
  }

  return target.closest('[contenteditable="true"]') !== null
}

/**
 * Matches a keydown event against the registry for the given platform.
 * Every command except 'escape' is suppressed while the event's target is
 * editable, so typing 'c' in the search box never fires copy-selected, but
 * Escape can still blur/close things while a field has focus.
 */
export function matchShortcut(
  event: KeyboardEvent,
  platform: PlatformFamily,
): ShortcutCommand | null {
  const editable = isEditableTarget(event.target)

  for (const definition of SHORTCUTS) {
    if (editable && definition.command !== 'escape') {
      continue
    }

    if (keysForPlatform(definition, platform).matches(event)) {
      return definition.command
    }
  }

  return null
}
