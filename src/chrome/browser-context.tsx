import type { ReactNode } from 'react'
import {
  createChromeBrowserGateway,
  type BrowserGateway,
  type ChromeBrowserApi,
} from './browser-gateway'
import { BrowserContext } from './browser-context-value'

interface BrowserProviderProps {
  children: ReactNode
  gateway?: BrowserGateway
}

export function BrowserProvider({ children, gateway }: BrowserProviderProps) {
  const browserGateway = gateway ?? createChromeBrowserGateway(getChromeBrowserApi())

  return <BrowserContext value={browserGateway}>{children}</BrowserContext>
}

function getChromeBrowserApi(): ChromeBrowserApi {
  const chrome = (globalThis as typeof globalThis & { chrome?: unknown }).chrome

  if (!chrome || typeof chrome !== 'object') {
    throw new Error('Chrome browser APIs are unavailable. This app must run as a Chrome extension.')
  }

  return chrome as ChromeBrowserApi
}
