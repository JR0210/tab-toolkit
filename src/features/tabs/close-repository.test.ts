import { describe, expect, it } from 'vitest'
import { createCloseRepository } from './close-repository'
import type { CloseSnapshot, SessionStorageArea } from './close-repository'

describe('createCloseRepository', () => {
  it('returns null when nothing has been closed yet', async () => {
    const storage = createStorage({})
    const repository = createCloseRepository(storage)

    await expect(repository.load()).resolves.toBeNull()
  })

  it('persists a close snapshot under the lastClosedTabs session key', async () => {
    const persisted: Record<string, unknown> = {}
    const storage = createStorage(persisted)
    const repository = createCloseRepository(storage)
    const snapshot = createSnapshot()

    await repository.save(snapshot)

    expect(persisted).toEqual({ lastClosedTabs: snapshot })
  })

  it('loads a previously saved snapshot', async () => {
    const snapshot = createSnapshot()
    const storage = createStorage({ lastClosedTabs: snapshot })
    const repository = createCloseRepository(storage)

    await expect(repository.load()).resolves.toEqual(snapshot)
  })

  it('only ever keeps the latest snapshot, overwriting any previous one', async () => {
    const persisted: Record<string, unknown> = {}
    const storage = createStorage(persisted)
    const repository = createCloseRepository(storage)

    await repository.save(createSnapshot(1))
    await repository.save(createSnapshot(2))

    await expect(repository.load()).resolves.toEqual(createSnapshot(2))
  })

  it('clears the persisted snapshot', async () => {
    const persisted: Record<string, unknown> = { lastClosedTabs: createSnapshot() }
    const storage = createStorage(persisted)
    const repository = createCloseRepository(storage)

    await repository.clear()

    await expect(repository.load()).resolves.toBeNull()
  })

  it('treats a malformed stored value as no snapshot', async () => {
    const storage = createStorage({ lastClosedTabs: { nonsense: true } })
    const repository = createCloseRepository(storage)

    await expect(repository.load()).resolves.toBeNull()
  })
})

function createSnapshot(closedAt = 1000): CloseSnapshot {
  return {
    closedAt,
    tabs: [{ url: 'https://example.com', title: 'Example', pinned: false, windowId: 1, index: 0 }],
  }
}

function createStorage(persisted: Record<string, unknown>): SessionStorageArea {
  return {
    async get(
      _keys?: string | string[] | Record<string, unknown> | null,
    ): Promise<Record<string, unknown>> {
      return persisted
    },
    async set(items: Record<string, unknown>): Promise<void> {
      Object.assign(persisted, items)
    },
    async remove(keys: string | string[]): Promise<void> {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete persisted[key]
      }
    },
  }
}
