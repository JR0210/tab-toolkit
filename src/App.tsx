import { AppShell } from './app/AppShell'
import { SettingsProvider } from './shared/settings/settings-provider'
import type { SettingsRepository } from './shared/settings/settings-repository'
import { Toaster } from './shared/ui/toaster'
import { TooltipProvider } from './shared/ui/tooltip'

function App({ repository }: { repository: SettingsRepository }) {
  return (
    <SettingsProvider repository={repository}>
      <TooltipProvider>
        <AppShell />
      </TooltipProvider>
      <Toaster />
    </SettingsProvider>
  )
}

export default App
