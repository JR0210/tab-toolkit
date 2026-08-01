import { useContext } from 'react'
import { TabsContext } from './tabs-context'
import type { TabsContextValue } from './tabs-context'

export function useTabs(): TabsContextValue {
  const context = useContext(TabsContext)

  if (!context) {
    throw new Error('useTabs must be used within TabsProvider')
  }

  return context
}
