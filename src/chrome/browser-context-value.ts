import { createContext } from 'react'
import type { BrowserGateway } from './browser-gateway'

export const BrowserContext = createContext<BrowserGateway | null>(null)
