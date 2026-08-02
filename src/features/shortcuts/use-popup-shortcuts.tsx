import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { useBrowserGateway } from '../../chrome/use-browser-gateway'
import { getPlatformFamily } from '../../platform/platform'
import type { PlatformFamily } from '../../platform/platform'
import { matchShortcut } from './match-shortcut'
import type { ShortcutCommand } from './shortcut-definitions'

export type ShortcutHandler = () => void

// Keyed by plain string, not just ShortcutCommand: keyboard shortcuts are
// the primary user of this registry, but it also carries non-keyboard
// "reach into another subtree" actions (e.g. Settings' Reset clearing
// TabsView's filters and switching AppShell's view) -- see
// useRegisterAction/useInvokeAction below, which are the same mechanism
// under a different, non-keyboard-shaped id namespace.
interface ShortcutHandlersValue {
  handlers: Map<string, ShortcutHandler>
}

const ShortcutHandlersContext = createContext<ShortcutHandlersValue | null>(null)

/**
 * Registers `handler` as the live implementation of `id` for as long as the
 * calling component is mounted and `handler` is non-null. Passing null
 * unregisters it so lookups treat it as a no-op. This is the low-level
 * primitive; useRegisterShortcut is a ShortcutCommand-typed convenience
 * wrapper over it for the keyboard-routing case.
 */
export function useRegisterAction(id: string, handler: ShortcutHandler | null): void {
  const context = useContext(ShortcutHandlersContext)

  useEffect(() => {
    if (!context || !handler) {
      return
    }

    context.handlers.set(id, handler)

    return () => {
      if (context.handlers.get(id) === handler) {
        context.handlers.delete(id)
      }
    }
  }, [context, id, handler])
}

/**
 * Components that own a shortcut's real behaviour (e.g. TabsToolbar for
 * focus-search, SelectionDock for copy/export/close-selected) call this
 * instead of the popup-level listener knowing about their internals.
 * Passing null (e.g. SelectionDock with nothing selected) unregisters the
 * command so the listener treats it as a no-op -- satisfying "commands
 * requiring selection do nothing when selection is empty" without any
 * special-casing there.
 */
export function useRegisterShortcut(
  command: ShortcutCommand,
  handler: ShortcutHandler | null,
): void {
  useRegisterAction(command, handler)
}

/**
 * Looks up and calls whatever is currently registered for `id`, or does
 * nothing if there's no registered handler. Used to trigger a registered
 * action from outside the keyboard-routing path -- e.g. Settings' Reset
 * button invoking the same "clear filters" / "switch to Tabs view" handlers
 * that live deeper in the tree, without prop-drilling.
 */
export function useInvokeAction(): (id: string) => void {
  const context = useContext(ShortcutHandlersContext)

  return useCallback(
    (id: string) => {
      context?.handlers.get(id)?.()
    },
    [context],
  )
}

/**
 * Resolves and caches (per gateway, via Task 1's getPlatformFamily) the
 * popup's platform family. Shared by the shortcut router and ShortcutsDialog
 * so both use the exact same resolved value.
 */
export function usePlatformFamily(): PlatformFamily {
  const gateway = useBrowserGateway()
  const [platform, setPlatform] = useState<PlatformFamily>('non-mac')

  useEffect(() => {
    let cancelled = false

    void getPlatformFamily(gateway).then((family) => {
      if (!cancelled) {
        setPlatform(family)
      }
    })

    return () => {
      cancelled = true
    }
  }, [gateway])

  return platform
}

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
