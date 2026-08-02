import { describe, expect, it } from 'vitest'
import { parseUrlLines } from './parse-urls'

describe('parseUrlLines', () => {
  it('parses valid web URLs, normalizes bare localhost, and reports invalid lines with 1-indexed line numbers', () => {
    expect(
      parseUrlLines(`
https://example.com/a
localhost:5173/path
javascript:alert(1)
not a url
`),
    ).toEqual({
      valid: [
        { line: 2, input: 'https://example.com/a', url: 'https://example.com/a' },
        { line: 3, input: 'localhost:5173/path', url: 'http://localhost:5173/path' },
      ],
      invalid: [
        { line: 4, input: 'javascript:alert(1)', reason: 'Only HTTP and HTTPS URLs are supported' },
        { line: 5, input: 'not a url', reason: 'Invalid URL' },
      ],
    })
  })

  it('rejects a bare 127.0.0.1 with no scheme the same as any other bare hostname', () => {
    const result = parseUrlLines('127.0.0.1')

    expect(result.valid).toEqual([])
    expect(result.invalid).toEqual([{ line: 1, input: '127.0.0.1', reason: 'Invalid URL' }])
  })

  it('accepts 127.0.0.1 when given an explicit http/https scheme', () => {
    const result = parseUrlLines('http://127.0.0.1\nhttps://127.0.0.1:8080/status')

    expect(result.valid).toEqual([
      { line: 1, input: 'http://127.0.0.1', url: 'http://127.0.0.1/' },
      {
        line: 2,
        input: 'https://127.0.0.1:8080/status',
        url: 'https://127.0.0.1:8080/status',
      },
    ])
    expect(result.invalid).toEqual([])
  })

  it('accepts URLs with embedded credentials, explicit ports, and fragments', () => {
    const result = parseUrlLines(
      'https://user:pass@example.com\nhttps://example.com:8080\nhttps://example.com/a#section',
    )

    expect(result.valid.map((entry) => entry.url)).toEqual([
      'https://user:pass@example.com/',
      'https://example.com:8080/',
      'https://example.com/a#section',
    ])
    expect(result.invalid).toEqual([])
  })

  it('normalizes Unicode/IDN domains to their punycode form', () => {
    const result = parseUrlLines('https://münchen.example')

    expect(result.valid).toEqual([
      { line: 1, input: 'https://münchen.example', url: 'https://xn--mnchen-3ya.example/' },
    ])
  })

  it('trims surrounding whitespace on a line before parsing', () => {
    const result = parseUrlLines('   https://example.com/a   ')

    expect(result.valid).toEqual([
      { line: 1, input: 'https://example.com/a', url: 'https://example.com/a' },
    ])
  })

  it('skips blank lines silently without counting them as invalid or breaking line numbering', () => {
    const result = parseUrlLines('https://a.example\n\n   \nhttps://b.example')

    expect(result.valid).toEqual([
      { line: 1, input: 'https://a.example', url: 'https://a.example/' },
      { line: 4, input: 'https://b.example', url: 'https://b.example/' },
    ])
    expect(result.invalid).toEqual([])
  })

  it('rejects file: URLs as a non-web scheme', () => {
    const result = parseUrlLines('file:///path')

    expect(result.valid).toEqual([])
    expect(result.invalid).toEqual([
      { line: 1, input: 'file:///path', reason: 'Only HTTP and HTTPS URLs are supported' },
    ])
  })

  it('rejects chrome: URLs as a non-web scheme', () => {
    const result = parseUrlLines('chrome://extensions')

    expect(result.valid).toEqual([])
    expect(result.invalid).toEqual([
      { line: 1, input: 'chrome://extensions', reason: 'Only HTTP and HTTPS URLs are supported' },
    ])
  })

  it('rejects malformed schemes as invalid URLs', () => {
    const result = parseUrlLines('ht!tp://example.com')

    expect(result.valid).toEqual([])
    expect(result.invalid).toEqual([
      { line: 1, input: 'ht!tp://example.com', reason: 'Invalid URL' },
    ])
  })

  it('preserves the input line order in both valid and invalid arrays', () => {
    const result = parseUrlLines('https://a.example\nnot a url\nhttps://b.example\njavascript:x')

    expect(result.valid.map((entry) => entry.line)).toEqual([1, 3])
    expect(result.invalid.map((entry) => entry.line)).toEqual([2, 4])
  })
})
