import { AppShell } from './app/AppShell'
import { BrowserProvider } from './chrome/browser-context'
import type { BrowserGateway } from './chrome/browser-gateway'
import type { ClipboardGateway } from './platform/clipboard-gateway'
import type { DownloadGateway } from './platform/download-gateway'
import type { CloseRepository } from './features/tabs/close-repository'
import { TabsProvider } from './features/tabs/tabs-provider'
import { ShortcutHandlersProvider } from './features/shortcuts/use-popup-shortcuts'
import { WorkspacesProvider } from './features/workspaces/workspaces-provider'
import type { WorkspaceRepository } from './features/workspaces/workspace-repository'
import { SettingsProvider } from './shared/settings/settings-provider'
import type { SettingsRepository } from './shared/settings/settings-repository'
import { Toaster } from './shared/ui/toaster'
import { TooltipProvider } from './shared/ui/tooltip'

interface AppProps {
  repository: SettingsRepository
  gateway?: BrowserGateway
  /** Injectable for tests; defaults to the real chrome.storage.session-backed repository. */
  closeRepository?: CloseRepository
  /**
   * Injectable for tests; defaults to the real chrome.storage.local-backed
   * repository. The SAME instance is used for both saving/renaming/deleting
   * workspaces (WorkspacesProvider) and for Import URLs' "save as workspace"
   * (WorkspacesView -> ImportDialog) -- see WorkspacesView's `repository`
   * prop for why those two call sites must share one instance.
   */
  workspaceRepository?: WorkspaceRepository
  /** Injectable for tests; defaults to the real navigator.clipboard-backed gateway. */
  clipboard?: ClipboardGateway
  /** Injectable for tests; defaults to the real anchor-download-backed gateway. */
  download?: DownloadGateway
}

function App({
  repository,
  gateway,
  closeRepository,
  workspaceRepository,
  clipboard,
  download,
}: AppProps) {
  return (
    <SettingsProvider repository={repository}>
      <BrowserProvider gateway={gateway}>
        <TabsProvider>
          <WorkspacesProvider repository={workspaceRepository}>
            <TooltipProvider>
              <ShortcutHandlersProvider>
                <AppShell
                  closeRepository={closeRepository}
                  workspaceRepository={workspaceRepository}
                  clipboard={clipboard}
                  download={download}
                />
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
