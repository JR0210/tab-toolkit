import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { getExtensionChrome } from './extension-chrome'
import { createSettingsRepository } from './shared/settings/settings-repository'

const extensionChrome = getExtensionChrome()
const settingsRepository = createSettingsRepository(extensionChrome.storage.local)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App repository={settingsRepository} />
  </StrictMode>,
)
