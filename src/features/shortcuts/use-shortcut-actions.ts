import { useCallback, useContext, useEffect, useState } from 'react'
import { useBrowserGateway } from '../../chrome/use-browser-gateway'
import { getPlatformFamily } from '../../platform/platform'
import type { PlatformFamily } from '../../platform/platform'
import { ShortcutHandlersContext } from './use-popup-shortcuts'
import type { ShortcutHandler } from './use-popup-shortcuts'
import type { ShortcutCommand } from './shortcut-definitions'

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
