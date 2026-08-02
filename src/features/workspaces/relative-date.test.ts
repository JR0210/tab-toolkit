import { describe, expect, it } from 'vitest'
import { formatRelativeDate } from './relative-date'

const NOW = new Date('2026-08-02T12:00:00.000Z')

describe('formatRelativeDate', () => {
  it('reports timestamps under a minute old as "Just now"', () => {
    const iso = new Date(NOW.getTime() - 30 * 1000).toISOString()

    expect(formatRelativeDate(iso, NOW)).toBe('Just now')
  })

  it('reports singular "1 minute ago"', () => {
    const iso = new Date(NOW.getTime() - 60 * 1000).toISOString()

    expect(formatRelativeDate(iso, NOW)).toBe('1 minute ago')
  })

  it('reports plural minutes', () => {
    const iso = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString()

    expect(formatRelativeDate(iso, NOW)).toBe('5 minutes ago')
  })

  it('reports singular "1 hour ago"', () => {
    const iso = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString()

    expect(formatRelativeDate(iso, NOW)).toBe('1 hour ago')
  })

  it('reports plural hours', () => {
    const iso = new Date(NOW.getTime() - 2 * 60 * 60 * 1000).toISOString()

    expect(formatRelativeDate(iso, NOW)).toBe('2 hours ago')
  })

  it('reports singular "1 day ago"', () => {
    const iso = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString()

    expect(formatRelativeDate(iso, NOW)).toBe('1 day ago')
  })

  it('reports plural days', () => {
    const iso = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()

    expect(formatRelativeDate(iso, NOW)).toBe('3 days ago')
  })

  it('falls back to an absolute date beyond 7 days', () => {
    const iso = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()

    expect(formatRelativeDate(iso, NOW)).toBe('Jul 23, 2026')
  })

  it('is deterministic given an injected clock rather than relying on the real current time', () => {
    const iso = new Date('2020-01-01T00:00:00.000Z').toISOString()

    expect(formatRelativeDate(iso, new Date('2020-01-01T00:05:00.000Z'))).toBe('5 minutes ago')
  })
})
