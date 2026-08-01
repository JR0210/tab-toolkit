import { useContext } from 'react'
import { SettingsContext } from './settings-context'
import type { SettingsContextValue } from './settings-context'

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)

  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider')
  }

  return context
}
