import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { createSettingsRepository } from './shared/settings/settings-repository'
import type { SettingsStorageArea } from './shared/settings/settings-repository'

interface ExtensionChrome {
  storage: {
    local: SettingsStorageArea
  }
}

const extensionChrome = (globalThis as typeof globalThis & { chrome: ExtensionChrome }).chrome
const settingsRepository = createSettingsRepository(extensionChrome.storage.local)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App repository={settingsRepository} />
  </StrictMode>,
)
