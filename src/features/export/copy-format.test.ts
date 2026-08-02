import { describe, expect, it } from 'vitest'
import type { TabRecord } from '../../domain/browser'
import { formatTabsForClipboard } from './copy-format'

describe('formatTabsForClipboard', () => {
  describe('urls format', () => {
    it('joins tab URLs with newlines', () => {
      const tabs = [createTab({ url: 'https://a.test' }), createTab({ url: 'https://b.test' })]

      expect(formatTabsForClipboard(tabs, 'urls')).toBe('https://a.test\nhttps://b.test')
    })

    it('preserves special-scheme URLs like chrome:// and file:// as-is', () => {
      const tabs = [
        createTab({ url: 'chrome://extensions/' }),
        createTab({ url: 'file:///C:/tmp/report.pdf' }),
      ]

      expect(formatTabsForClipboard(tabs, 'urls')).toBe(
        'chrome://extensions/\nfile:///C:/tmp/report.pdf',
      )
    })
  })

  describe('title-url format', () => {
    it('pairs title and url per tab, separated by a blank line between tabs', () => {
      const tabs = [
        createTab({ title: 'Tab A', url: 'https://a.test' }),
        createTab({ title: 'Tab B', url: 'https://b.test' }),
      ]

      expect(formatTabsForClipboard(tabs, 'title-url')).toBe(
        'Tab A\nhttps://a.test\n\nTab B\nhttps://b.test',
      )
    })

    it('falls back to "Untitled tab" when the title is missing', () => {
      const tabs = [createTab({ title: '', url: 'https://a.test' })]

      expect(formatTabsForClipboard(tabs, 'title-url')).toBe('Untitled tab\nhttps://a.test')
    })
  })

  describe('markdown format', () => {
    it('renders a markdown link per tab', () => {
      const tabs = [createTab({ title: 'Example', url: 'https://example.test' })]

      expect(formatTabsForClipboard(tabs, 'markdown')).toBe('[Example](https://example.test)')
    })

    it('escapes backslashes and brackets in the label', () => {
      const tabs = [createTab({ title: 'A [B] \\ C', url: 'https://example.test' })]

      expect(formatTabsForClipboard(tabs, 'markdown')).toBe(
        '[A \\[B\\] \\\\ C](https://example.test)',
      )
    })

    it('wraps destinations containing parentheses or whitespace in angle brackets', () => {
      const tabs = [createTab({ title: 'Example', url: 'https://example.test/(foo bar)' })]

      expect(formatTabsForClipboard(tabs, 'markdown')).toBe(
        '[Example](<https://example.test/(foo bar)>)',
      )
    })

    it('falls back to "Untitled tab" as the label when the title is missing', () => {
      const tabs = [createTab({ title: '', url: 'https://example.test' })]

      expect(formatTabsForClipboard(tabs, 'markdown')).toBe('[Untitled tab](https://example.test)')
    })

    it('renders an empty destination when the url is missing', () => {
      const tabs = [createTab({ title: 'Example', url: '' })]

      expect(formatTabsForClipboard(tabs, 'markdown')).toBe('[Example]()')
    })

    it('joins multiple links with newlines', () => {
      const tabs = [
        createTab({ title: 'A', url: 'https://a.test' }),
        createTab({ title: 'B', url: 'https://b.test' }),
      ]

      expect(formatTabsForClipboard(tabs, 'markdown')).toBe(
        '[A](https://a.test)\n[B](https://b.test)',
      )
    })
  })

  describe('html format', () => {
    it('escapes text and attribute content separately', () => {
      const tabs = [createTab({ title: 'A & B <C>', url: 'https://example.test/?x="y"' })]

      expect(formatTabsForClipboard(tabs, 'html')).toBe(
        '<a href="https://example.test/?x=&quot;y&quot;">A &amp; B &lt;C&gt;</a>',
      )
    })

    it('falls back to "Untitled tab" as the link text when the title is missing', () => {
      const tabs = [createTab({ title: '', url: 'https://example.test' })]

      expect(formatTabsForClipboard(tabs, 'html')).toBe(
        '<a href="https://example.test">Untitled tab</a>',
      )
    })

    it('joins multiple links with newlines', () => {
      const tabs = [
        createTab({ title: 'A', url: 'https://a.test' }),
        createTab({ title: 'B', url: 'https://b.test' }),
      ]

      expect(formatTabsForClipboard(tabs, 'html')).toBe(
        '<a href="https://a.test">A</a>\n<a href="https://b.test">B</a>',
      )
    })
  })

  describe('csv format', () => {
    it('produces a title,url CSV and quotes cells containing special characters', () => {
      const tabs = [createTab({ title: 'A, B', url: 'https://a.test' })]

      expect(formatTabsForClipboard(tabs, 'csv')).toBe('title,url\r\n"A, B",https://a.test')
    })

    it('neutralises formula-injection titles', () => {
      const tabs = [createTab({ title: '=HYPERLINK("bad")', url: 'https://a.test' })]

      expect(formatTabsForClipboard(tabs, 'csv')).toBe(
        'title,url\r\n"\'=HYPERLINK(""bad"")",https://a.test',
      )
    })

    it('falls back to "Untitled tab" when the title is missing', () => {
      const tabs = [createTab({ title: '', url: 'https://a.test' })]

      expect(formatTabsForClipboard(tabs, 'csv')).toBe('title,url\r\nUntitled tab,https://a.test')
    })
  })

  describe('json format', () => {
    it('produces a JSON array of title/url objects', () => {
      const tabs = [createTab({ title: 'A', url: 'https://a.test' })]

      expect(formatTabsForClipboard(tabs, 'json')).toBe(
        JSON.stringify([{ title: 'A', url: 'https://a.test' }], null, 2),
      )
    })

    it('falls back to "Untitled tab" when the title is missing', () => {
      const tabs = [createTab({ title: '', url: 'https://a.test' })]

      expect(formatTabsForClipboard(tabs, 'json')).toBe(
        JSON.stringify([{ title: 'Untitled tab', url: 'https://a.test' }], null, 2),
      )
    })
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
