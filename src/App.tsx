import { AppShell } from './app/AppShell'
import { BrowserProvider } from './chrome/browser-context'
import type { BrowserGateway } from './chrome/browser-gateway'
import { TabsProvider } from './features/tabs/tabs-provider'
import { SettingsProvider } from './shared/settings/settings-provider'
import type { SettingsRepository } from './shared/settings/settings-repository'
import { Toaster } from './shared/ui/toaster'
import { TooltipProvider } from './shared/ui/tooltip'

interface AppProps {
  repository: SettingsRepository
  gateway?: BrowserGateway
}

function App({ repository, gateway }: AppProps) {
  return (
    <SettingsProvider repository={repository}>
      <BrowserProvider gateway={gateway}>
        <TabsProvider>
          <TooltipProvider>
            <AppShell />
          </TooltipProvider>
        </TabsProvider>
      </BrowserProvider>
      <Toaster />
    </SettingsProvider>
  )
}

export default App
