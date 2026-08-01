import { useContext } from 'react'
import { BrowserContext } from './browser-context-value'
import type { BrowserGateway } from './browser-gateway'

export function useBrowserGateway(): BrowserGateway {
  const gateway = useContext(BrowserContext)

  if (!gateway) {
    throw new Error('useBrowserGateway must be used within BrowserProvider')
  }

  return gateway
}
