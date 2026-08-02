import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useBrowserGateway } from '../chrome/use-browser-gateway'
import type { CloseRepository } from '../features/tabs/close-repository'
import { createChromeCloseRepository } from '../features/tabs/close-repository'
import { showBulkResultToast } from '../features/tabs/lifecycle-toast'
import { TabsView } from '../features/tabs/TabsView'
import { undoClose } from '../features/tabs/tab-lifecycle-service'
import { useTabs } from '../features/tabs/use-tabs'
import { useRegisterAction, useRegisterShortcut } from '../features/shortcuts/use-popup-shortcuts'
import { WorkspacesView } from '../features/workspaces/WorkspacesView'
import { Header } from './Header'
import type { PrimaryView } from './PrimaryNav'

interface AppShellProps {
  closeRepository?: CloseRepository
}

export function AppShell({ closeRepository = createChromeCloseRepository() }: AppShellProps) {
  const [view, setView] = useState<PrimaryView>('tabs')
  const gateway = useBrowserGateway()
  const { refresh } = useTabs()

  useRegisterShortcut(
    'show-tabs',
    useCallback(() => setView('tabs'), []),
  )
  useRegisterShortcut(
    'show-workspaces',
    useCallback(() => setView('workspaces'), []),
  )
  useRegisterShortcut(
    'undo-close',
    useCallback(async () => {
      try {
        const result = await undoClose(gateway, closeRepository)
        await refresh()
        showBulkResultToast(result, 'Restored')
      } catch {
        toast.error('Could not restore the tabs. Try again.')
      }
    }, [gateway, closeRepository, refresh]),
  )

  // Reused by SettingsDialog's Reset action -- see the matching
  // 'reset-filters' registration in TabsToolbar.tsx for why this indirection
  // exists instead of a direct call.
  useRegisterAction(
    'reset-view',
    useCallback(() => setView('tabs'), []),
  )

  return (
    <div
      data-testid="popup-root"
      className="flex flex-col overflow-hidden bg-card text-card-foreground"
      style={{ width: '760px', height: '580px', overflow: 'hidden' }}
    >
      <Header view={view} onViewChange={setView} />
      <main className="relative flex min-h-0 flex-1 flex-col" aria-label={`${view} view`}>
        <h1 className="sr-only">{view === 'tabs' ? 'Tabs' : 'Workspaces'}</h1>
        {view === 'tabs' ? <TabsView /> : <WorkspacesView />}
      </main>
    </div>
  )
}
