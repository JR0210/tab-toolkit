import { describe, expect, it } from 'vitest'
import { runBulk, summarizeBulk } from './bulk-result'

describe('runBulk', () => {
  it('separates succeeded ids from failed ids with their error message', async () => {
    const result = await runBulk([1, 2, 3], async (id) => {
      if (id === 2) throw new Error('No tab with id: 2')
    })

    expect(result).toEqual({
      succeeded: [1, 3],
      failed: [{ id: 2, message: 'No tab with id: 2' }],
    })
  })

  it('reports every id as succeeded when every operation resolves', async () => {
    const result = await runBulk([5, 6], async () => {})

    expect(result).toEqual({ succeeded: [5, 6], failed: [] })
  })

  it('reports every id as failed when every operation rejects', async () => {
    const result = await runBulk([1, 2], async (id) => {
      throw new Error(`boom ${id}`)
    })

    expect(result).toEqual({
      succeeded: [],
      failed: [
        { id: 1, message: 'boom 1' },
        { id: 2, message: 'boom 2' },
      ],
    })
  })

  it('falls back to String(error) when a non-Error value is thrown', async () => {
    const result = await runBulk([1], async () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'nope'
    })

    expect(result).toEqual({ succeeded: [], failed: [{ id: 1, message: 'nope' }] })
  })

  it('returns an empty result for an empty id list', async () => {
    const result = await runBulk([], async () => {})

    expect(result).toEqual({ succeeded: [], failed: [] })
  })
})

describe('summarizeBulk', () => {
  it('describes a full success with singular wording for one tab', () => {
    expect(summarizeBulk({ succeeded: [1], failed: [] }, 'Pinned')).toBe('Pinned 1 tab.')
  })

  it('describes a full success with plural wording for multiple tabs', () => {
    expect(summarizeBulk({ succeeded: [1, 2], failed: [] }, 'Pinned')).toBe('Pinned 2 tabs.')
  })

  it('describes a mixed result with singular success and singular failure', () => {
    expect(summarizeBulk({ succeeded: [1], failed: [{ id: 2, message: 'gone' }] }, 'Pinned')).toBe(
      'Pinned 1 tab; 1 tab was no longer available.',
    )
  })

  it('describes a mixed result with plural success and plural failure', () => {
    expect(
      summarizeBulk(
        {
          succeeded: [1, 2],
          failed: [
            { id: 3, message: 'gone' },
            { id: 4, message: 'gone' },
          ],
        },
        'Closed',
      ),
    ).toBe('Closed 2 tabs; 2 tabs were no longer available.')
  })
})
