import { describe, expect, it } from 'vitest'
import type { TabRecord } from '../../domain/browser'
import { chooseDefaultKeeper, findDuplicateSets } from './duplicate-plan'

describe('chooseDefaultKeeper', () => {
  it('matches the exact precedence example from the plan: pinned beats active and index', () => {
    expect(
      chooseDefaultKeeper([
        tab({ id: 1, pinned: false, active: true, index: 4 }),
        tab({ id: 2, pinned: true, active: false, index: 7 }),
        tab({ id: 3, pinned: false, active: false, index: 0 }),
      ]),
    ).toBe(2)
  })

  it('picks the active tab over earliest index when none is pinned', () => {
    expect(
      chooseDefaultKeeper([
        tab({ id: 1, pinned: false, active: false, index: 0 }),
        tab({ id: 2, pinned: false, active: true, index: 5 }),
      ]),
    ).toBe(2)
  })

  it('falls back to earliest index when nothing is pinned or active', () => {
    expect(
      chooseDefaultKeeper([
        tab({ id: 1, pinned: false, active: false, index: 2 }),
        tab({ id: 2, pinned: false, active: false, index: 0 }),
      ]),
    ).toBe(2)
  })

  it('breaks a tie between multiple pinned tabs by earliest index, not array order', () => {
    expect(
      chooseDefaultKeeper([
        tab({ id: 1, pinned: true, active: false, index: 5 }),
        tab({ id: 2, pinned: true, active: false, index: 1 }),
      ]),
    ).toBe(2)
  })

  it('breaks a tie between multiple active tabs by earliest index, not array order', () => {
    expect(
      chooseDefaultKeeper([
        tab({ id: 1, pinned: false, active: true, index: 5 }),
        tab({ id: 2, pinned: false, active: true, index: 1 }),
      ]),
    ).toBe(2)
  })
})

describe('findDuplicateSets', () => {
  it('groups the given selection by exact URL equality, only urls with 2+ occurrences', () => {
    const tabs = [
      tab({ id: 1, url: 'https://example.com/a' }),
      tab({ id: 2, url: 'https://example.com/a' }),
      tab({ id: 3, url: 'https://example.com/b' }),
    ]

    const sets = findDuplicateSets(tabs)

    expect(sets).toHaveLength(1)
    expect(sets[0].url).toBe('https://example.com/a')
    expect(sets[0].candidates.map((t) => t.id).sort((a, b) => a - b)).toEqual([1, 2])
    expect(sets[0].keepId).toBe(chooseDefaultKeeper(sets[0].candidates))
  })

  it('only considers the given selection, not any wider snapshot', () => {
    // Two tabs sharing a URL, but only one of them is passed in -- there's
    // no duplicate set to find within the selection itself.
    const tabs = [tab({ id: 1, url: 'https://example.com/a' })]

    expect(findDuplicateSets(tabs)).toEqual([])
  })

  it('does not treat visually similar but byte-different URLs as duplicates', () => {
    const tabs = [
      tab({ id: 1, url: 'https://example.com/a' }),
      tab({ id: 2, url: 'https://example.com/a/' }),
      tab({ id: 3, url: 'http://example.com/a' }),
    ]

    expect(findDuplicateSets(tabs)).toEqual([])
  })
})

function tab(overrides: Partial<TabRecord> & { id: number }): TabRecord {
  return {
    windowId: 1,
    index: 0,
    title: `Tab ${overrides.id}`,
    url: `https://tab-${overrides.id}.example`,
    domain: `tab-${overrides.id}.example`,
    faviconUrl: null,
    pinned: false,
    muted: false,
    audible: false,
    active: false,
    discarded: false,
    groupId: null,
    ...overrides,
  }
}
