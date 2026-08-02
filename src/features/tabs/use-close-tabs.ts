import { toast } from 'sonner'
import { useBrowserGateway } from '../../chrome/use-browser-gateway'
import type { TabRecord } from '../../domain/browser'
import type { CloseRepository } from './close-repository'
import { createChromeCloseRepository } from './close-repository'
import { showCloseToast } from './lifecycle-toast'
import { closeTabs } from './tab-lifecycle-service'
import { useTabInteractions } from './use-tab-interactions'
import { useTabs } from './use-tabs'

/**
 * The single implementation behind every "close these tabs" entry point
 * (the Manage menu's Close item, the close-selected keyboard shortcut, and
 * any future caller) so they can never drift apart. Builds the recovery
 * snapshot, removes the tabs, clears the successfully-closed ids from
 * selection, shows the Undo toast, and refreshes -- matching the sequence
 * ManageTabsMenu.tsx's handleClose originally ran inline.
 */
export function useCloseTabs(
  repository: CloseRepository = createChromeCloseRepository(),
): (tabs: readonly TabRecord[]) => Promise<void> {
  const gateway = useBrowserGateway()
  const { snapshot, refresh } = useTabs()
  const { setManySelected } = useTabInteractions()

  return async (tabs: readonly TabRecord[]) => {
    try {
      const groupsById = new Map((snapshot?.groups ?? []).map((group) => [group.id, group]))
      const result = await closeTabs(tabs, groupsById, gateway, repository)

      setManySelected(result.succeeded, false)
      showCloseToast(result, gateway, repository, refresh)
    } catch {
      toast.error('Could not close the tabs. Try again.')
    } finally {
      await refresh()
    }
  }
}
