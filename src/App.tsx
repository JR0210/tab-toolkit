import { AppShell } from './app/AppShell'
import { BrowserProvider } from './chrome/browser-context'
import type { BrowserGateway } from './chrome/browser-gateway'
import type { CloseRepository } from './features/tabs/close-repository'
import { TabsProvider } from './features/tabs/tabs-provider'
import { ShortcutHandlersProvider } from './features/shortcuts/use-popup-shortcuts'
import { WorkspacesProvider } from './features/workspaces/workspaces-provider'
import { SettingsProvider } from './shared/settings/settings-provider'
import type { SettingsRepository } from './shared/settings/settings-repository'
import { Toaster } from './shared/ui/toaster'
import { TooltipProvider } from './shared/ui/tooltip'

interface AppProps {
  repository: SettingsRepository
  gateway?: BrowserGateway
  /** Injectable for tests; defaults to the real chrome.storage.session-backed repository. */
  closeRepository?: CloseRepository
}

function App({ repository, gateway, closeRepository }: AppProps) {
  return (
    <SettingsProvider repository={repository}>
      <BrowserProvider gateway={gateway}>
        <TabsProvider>
          <WorkspacesProvider>
            <TooltipProvider>
              <ShortcutHandlersProvider>
                <AppShell closeRepository={closeRepository} />
              </ShortcutHandlersProvider>
            </TooltipProvider>
          </WorkspacesProvider>
        </TabsProvider>
      </BrowserProvider>
      <Toaster />
    </SettingsProvider>
  )
}

export default App
