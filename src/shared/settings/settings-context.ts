import { createContext } from 'react'
import type { Settings, Theme } from './settings'

export interface SettingsContextValue {
  settings: Settings
  resolvedTheme: Exclude<Theme, 'system'>
  persistenceError: string | null
  updateSettings: (changes: Partial<Settings>) => Promise<void>
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)
