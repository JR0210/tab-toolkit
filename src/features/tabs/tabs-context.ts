import { createContext } from 'react'
import type { TabSnapshot } from '../../domain/browser'

export type TabsStatus = 'loading' | 'ready' | 'error'

export interface TabsContextValue {
  snapshot: TabSnapshot | null
  status: TabsStatus
  error: unknown
  refresh: () => Promise<void>
  activateTab: (tabId: number, windowId: number) => Promise<void>
}

export const TabsContext = createContext<TabsContextValue | null>(null)
