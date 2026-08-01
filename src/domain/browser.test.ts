import { expect, test } from 'vitest'
import './browser'
import type { TabRecord } from './browser'

test('represents a live browser tab with stable numeric identifiers', () => {
  const tab: TabRecord = {
    id: 12,
    windowId: 3,
    index: 1,
    title: 'Untitled tab',
    url: '',
    domain: '',
    faviconUrl: null,
    pinned: false,
    muted: false,
    audible: false,
    active: true,
    discarded: false,
    groupId: null,
  }

  expect(tab.id).toBe(12)
})
