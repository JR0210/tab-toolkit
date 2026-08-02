import { vi } from 'vitest'
import type { BrowserGateway } from '../chrome/browser-gateway'
import type { BulkResult, TabSnapshot } from '../domain/browser'

/**
 * A fully-stubbed BrowserGateway so tests that only care about a couple of
 * methods don't have to hand-implement the entire (growing) interface.
 * Pass `overrides` for the methods a given test actually exercises.
 */
export function createStubBrowserGateway(overrides: Partial<BrowserGateway> = {}): BrowserGateway {
  return {
    getSnapshot: vi.fn().mockResolvedValue(createEmptySnapshot()),
    activateTab: vi.fn().mockResolvedValue(undefined),
    setPinned: vi.fn().mockResolvedValue(createEmptyBulkResult()),
    setMuted: vi.fn().mockResolvedValue(createEmptyBulkResult()),
    reloadTabs: vi.fn().mockResolvedValue(createEmptyBulkResult()),
    discardTabs: vi.fn().mockResolvedValue(createEmptyBulkResult()),
    removeTabs: vi.fn().mockResolvedValue(createEmptyBulkResult()),
    windowExists: vi.fn().mockResolvedValue(true),
    createWindow: vi.fn().mockResolvedValue({ windowId: 1, tabId: 1 }),
    createTab: vi.fn().mockResolvedValue(1),
    groupCreatedTabs: vi.fn().mockResolvedValue(undefined),
    createWindowWithTab: vi.fn().mockResolvedValue({ windowId: 1, tabId: 1 }),
    moveTabs: vi.fn().mockResolvedValue(createEmptyBulkResult()),
    moveTab: vi.fn().mockResolvedValue(undefined),
    groupTabs: vi.fn().mockResolvedValue(1),
    updateGroup: vi.fn().mockResolvedValue(undefined),
    ungroupTabs: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function createEmptySnapshot(): TabSnapshot {
  return { tabs: [], groups: [], currentWindowId: null, capturedAt: 0 }
}

function createEmptyBulkResult(): BulkResult {
  return { succeeded: [], failed: [] }
}
