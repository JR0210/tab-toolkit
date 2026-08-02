import { useContext } from 'react'
import { TabInteractionsContext } from './tab-interaction-provider'
import type { TabInteractionsContextValue } from './tab-interaction-provider'

export function useTabInteractions(): TabInteractionsContextValue {
  const context = useContext(TabInteractionsContext)

  if (!context) {
    throw new Error('useTabInteractions must be used within TabInteractionProvider')
  }

  return context
}
