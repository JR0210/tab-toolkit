import { describe, expect, it } from 'vitest'
import type { TabGroupRecord, TabRecord } from '../../domain/browser'
import {
  EXPORT_FIELDS,
  buildExportRows,
  csvCell,
  serializeCsv,
  serializeJson,
} from './export-format'

describe('csvCell', () => {
  it('neutralises and quotes a formula-injection payload', () => {
    expect(csvCell('=HYPERLINK("bad")')).toBe('"\'=HYPERLINK(""bad"")"')
  })

  it.each(['=cmd', '+cmd', '-cmd', '@cmd'])(
    'neutralises the leading %s formula prefix',
    (value) => {
      expect(csvCell(value)).toBe(`"'${value}"`)
    },
  )

  it.each([' =cmd', '\t=cmd', '  +cmd'])(
    'neutralises a formula prefix hidden behind leading whitespace (%j)',
    (value) => {
      expect(csvCell(value)).toBe(`"'${value}"`)
    },
  )

  it('quotes cells containing commas', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
  })

  it('quotes cells containing double quotes and doubles them', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
  })

  it('leaves plain cells unquoted', () => {
    expect(csvCell('plain')).toBe('plain')
  })

  it('stringifies non-string values', () => {
    expect(csvCell(true)).toBe('true')
    expect(csvCell(42)).toBe('42')
  })
})

describe('serializeCsv', () => {
  it('joins the header and a row with CRLF and preserves embedded newlines inside quotes', () => {
    expect(serializeCsv([{ title: 'A\nB', url: 'https://x.test' }], ['title', 'url'])).toBe(
      'title,url\r\n"A\nB",https://x.test',
    )
  })

  it('orders columns by the given field list', () => {
    const rows = [{ title: 'A', url: 'https://a.test' }]
    expect(serializeCsv(rows, ['url', 'title'])).toBe('url,title\r\nhttps://a.test,A')
  })

  it('separates multiple rows with CRLF', () => {
    const rows = [{ title: 'A' }, { title: 'B' }]
    expect(serializeCsv(rows, ['title'])).toBe('title\r\nA\r\nB')
  })
})

describe('serializeJson', () => {
  it('outputs pretty-printed JSON with fields in the given order', () => {
    const rows = [{ title: 'A', url: 'https://a.test', domain: 'a.test' }]
    expect(serializeJson(rows, ['domain', 'title'])).toBe(
      JSON.stringify([{ domain: 'a.test', title: 'A' }], null, 2),
    )
  })

  it('keeps boolean and number values as native JSON types instead of strings', () => {
    const rows = [{ pinned: true, position: 2 }]
    expect(serializeJson(rows, ['pinned', 'position'])).toBe(
      JSON.stringify([{ pinned: true, position: 2 }], null, 2),
    )
  })
})

describe('EXPORT_FIELDS', () => {
  it('lists every export field in the default checkbox order', () => {
    expect(EXPORT_FIELDS).toEqual([
      'title',
      'url',
      'domain',
      'window',
      'group',
      'position',
      'pinned',
    ])
  })
})

describe('buildExportRows', () => {
  it('produces one row per tab with every field populated', () => {
    const tabs = [
      createTab({
        id: 1,
        windowId: 4,
        index: 2,
        title: 'A',
        url: 'https://a.test',
        domain: 'a.test',
        pinned: true,
      }),
    ]

    expect(buildExportRows(tabs, [])).toEqual([
      {
        title: 'A',
        url: 'https://a.test',
        domain: 'a.test',
        window: 4,
        group: '',
        position: 3,
        pinned: true,
      },
    ])
  })

  it('preserves the given tab order', () => {
    const tabs = [createTab({ id: 1, title: 'First' }), createTab({ id: 2, title: 'Second' })]

    expect(buildExportRows(tabs, []).map((row) => row.title)).toEqual(['First', 'Second'])
  })

  it('falls back to "Untitled tab" when the title is missing', () => {
    const tabs = [createTab({ title: '' })]

    expect(buildExportRows(tabs, [])[0].title).toBe('Untitled tab')
  })

  it('resolves the group title for a grouped tab', () => {
    const group: TabGroupRecord = { id: 9, windowId: 1, title: 'Research', color: 'blue' }
    const tabs = [createTab({ groupId: 9 })]

    expect(buildExportRows(tabs, [group])[0].group).toBe('Research')
  })

  it('falls back to "Unnamed group" for a grouped tab whose group has no title', () => {
    const group: TabGroupRecord = { id: 9, windowId: 1, title: '', color: 'blue' }
    const tabs = [createTab({ groupId: 9 })]

    expect(buildExportRows(tabs, [group])[0].group).toBe('Unnamed group')
  })

  it('leaves the group field empty for an ungrouped tab', () => {
    const tabs = [createTab({ groupId: null })]

    expect(buildExportRows(tabs, [])[0].group).toBe('')
  })

  it('leaves the group field empty when the referenced group is missing from the snapshot', () => {
    const tabs = [createTab({ groupId: 99 })]

    expect(buildExportRows(tabs, [])[0].group).toBe('')
  })
})

function createTab(overrides: Partial<TabRecord> = {}): TabRecord {
  return {
    id: 1,
    windowId: 1,
    index: 0,
    title: 'Tab',
    url: 'https://example.test',
    domain: 'example.test',
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
