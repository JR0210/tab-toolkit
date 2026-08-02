import { createContext, useEffect, useMemo, useRef } from 'react'
import type { PropsWithChildren } from 'react'
import { matchShortcut } from './match-shortcut'
import { usePlatformFamily } from './use-shortcut-actions'

export type ShortcutHandler = () => void

// Keyed by plain string, not just ShortcutCommand: keyboard shortcuts are
// the primary user of this registry, but it also carries non-keyboard
// "reach into another subtree" actions (e.g. Settings' Reset clearing
// TabsView's filters and switching AppShell's view) -- see
// useRegisterAction/useInvokeAction in use-shortcut-actions.ts, which are
// the same mechanism under a different, non-keyboard-shaped id namespace.
export interface ShortcutHandlersValue {
  handlers: Map<string, ShortcutHandler>
}

export const ShortcutHandlersContext = createContext<ShortcutHandlersValue | null>(null)

/**
 * True while a Base UI Dialog or Menu popup is open anywhere in the popup.
 * Base UI's own dismiss handling also listens for Escape on `document`, but
 * it registers *after* this listener (only once the overlay actually opens),
 * so on the same `document` target our listener would otherwise always run
 * first. Checking the DOM directly lets Escape's "close the topmost
 * dialog/menu" priority win without us tracking every dialog/menu's open
 * state by hand.
 */
function isOverlayOpen(): boolean {
  return (
    document.querySelector(
      '[role="dialog"][data-open], [role="alertdialog"][data-open], [role="menu"][data-open]',
    ) !== null
  )
}

function usePopupShortcutsListener(handlersRef: { current: Map<string, ShortcutHandler> }): void {
  const platform = usePlatformFamily()
  const platformRef = useRef(platform)
  platformRef.current = platform

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const command = matchShortcut(event, platformRef.current)

      if (!command) {
        return
      }

      if (command === 'escape') {
        if (isOverlayOpen()) {
          return
        }
      } else if (event.repeat) {
        // Holding a shortcut key down must not repeatedly fire it -- most
        // importantly for destructive commands like close-selected, but
        // repeat-guarding every command is simpler and just as safe.
        return
      }

      const handler = handlersRef.current.get(command)

      if (!handler) {
        return
      }

      handler()
      event.preventDefault()
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [handlersRef])
}

/**
 * Mounts the single popup-level keydown listener and provides the shared
 * handler registry that useRegisterShortcut writes into. Render this once,
 * near the root of the popup (inside BrowserProvider), so every feature
 * below it can register its own commands without prop-drilling.
 */
export function ShortcutHandlersProvider({ children }: PropsWithChildren) {
  const handlersRef = useRef<Map<string, ShortcutHandler>>(new Map())
  usePopupShortcutsListener(handlersRef)

  const value = useMemo<ShortcutHandlersValue>(() => ({ handlers: handlersRef.current }), [])

  return <ShortcutHandlersContext value={value}>{children}</ShortcutHandlersContext>
}
