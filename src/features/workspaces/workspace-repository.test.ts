import { describe, expect, it } from 'vitest'
import { validateWorkspace } from './workspace'
import type { Workspace } from './workspace'
import { createWorkspaceRepository } from './workspace-repository'
import type { WorkspaceStorageArea } from './workspace-repository'

describe('validateWorkspace', () => {
  it('validates and normalizes a well-formed record, trimming the name', () => {
    expect(
      validateWorkspace({
        id: 'abc',
        name: ' Research ',
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
        tabs: [{ url: 'https://example.com', title: 'Example', pinned: false }],
      }),
    ).toMatchObject({ name: 'Research' })
  })

  it('rejects an empty name', () => {
    expect(validateWorkspace(createRawWorkspace({ name: '' }))).toBeNull()
  })

  it('rejects a whitespace-only name', () => {
    expect(validateWorkspace(createRawWorkspace({ name: '   ' }))).toBeNull()
  })

  it('rejects an invalid createdAt timestamp', () => {
    expect(validateWorkspace(createRawWorkspace({ createdAt: 'not-a-date' }))).toBeNull()
  })

  it('rejects an invalid updatedAt timestamp', () => {
    expect(validateWorkspace(createRawWorkspace({ updatedAt: 'not-a-date' }))).toBeNull()
  })

  it('rejects a non-array tabs field', () => {
    expect(validateWorkspace(createRawWorkspace({ tabs: 'nope' }))).toBeNull()
  })

  it('rejects a workspace with zero tabs', () => {
    expect(validateWorkspace(createRawWorkspace({ tabs: [] }))).toBeNull()
  })

  it('rejects a workspace whose tabs contain an unsafe (non-http/https) URL', () => {
    expect(
      validateWorkspace(
        createRawWorkspace({
          tabs: [{ url: 'chrome://extensions', title: 'Extensions', pinned: false }],
        }),
      ),
    ).toBeNull()
  })

  it('rejects a workspace whose tabs contain a missing URL', () => {
    expect(
      validateWorkspace(
        createRawWorkspace({ tabs: [{ url: '', title: 'Blank', pinned: false }] }),
      ),
    ).toBeNull()
  })

  it('truncates names beyond 80 characters', () => {
    const longName = 'x'.repeat(90)
    const result = validateWorkspace(createRawWorkspace({ name: longName }))

    expect(result?.name).toHaveLength(80)
  })

  it('preserves a valid optional group descriptor on a tab', () => {
    const result = validateWorkspace(
      createRawWorkspace({
        tabs: [
          {
            url: 'https://example.com',
            title: 'Example',
            pinned: true,
            group: { title: 'Research', color: 'blue' },
          },
        ],
      }),
    )

    expect(result?.tabs[0]).toEqual({
      url: 'https://example.com',
      title: 'Example',
      pinned: true,
      group: { title: 'Research', color: 'blue' },
    })
  })

  it('rejects a tab with an invalid group color', () => {
    expect(
      validateWorkspace(
        createRawWorkspace({
          tabs: [
            {
              url: 'https://example.com',
              title: 'Example',
              pinned: false,
              group: { title: 'Research', color: 'not-a-real-color' },
            },
          ],
        }),
      ),
    ).toBeNull()
  })
})

describe('createWorkspaceRepository', () => {
  it('returns an empty list when nothing has been saved yet', async () => {
    const storage = createStorage({})
    const repository = createWorkspaceRepository(storage)

    await expect(repository.list()).resolves.toEqual({ workspaces: [], skippedCount: 0 })
  })

  it('put() appends a new workspace under the workspaces storage key', async () => {
    const persisted: Record<string, unknown> = {}
    const storage = createStorage(persisted)
    const repository = createWorkspaceRepository(storage)
    const workspace = createWorkspace({ id: 'a' })

    await repository.put(workspace)

    expect(persisted.workspaces).toEqual([workspace])
  })

  it('put() replaces-by-id (upsert) rather than duplicating an entry', async () => {
    const storage = createStorage({})
    const repository = createWorkspaceRepository(storage)
    const original = createWorkspace({ id: 'a', name: 'Original', updatedAt: '2026-08-01T10:00:00.000Z' })
    const renamed = createWorkspace({ id: 'a', name: 'Renamed', updatedAt: '2026-08-02T10:00:00.000Z' })

    await repository.put(original)
    await repository.put(renamed)

    const { workspaces } = await repository.list()
    expect(workspaces).toEqual([renamed])
  })

  it('sorts the full list descending by updatedAt before writing back', async () => {
    const storage = createStorage({})
    const repository = createWorkspaceRepository(storage)
    const older = createWorkspace({ id: 'a', updatedAt: '2026-08-01T10:00:00.000Z' })
    const newer = createWorkspace({ id: 'b', updatedAt: '2026-08-03T10:00:00.000Z' })

    await repository.put(older)
    await repository.put(newer)

    const { workspaces } = await repository.list()
    expect(workspaces.map((workspace) => workspace.id)).toEqual(['b', 'a'])
  })

  it('delete() removes the workspace with the given id', async () => {
    const storage = createStorage({})
    const repository = createWorkspaceRepository(storage)

    await repository.put(createWorkspace({ id: 'a' }))
    await repository.put(createWorkspace({ id: 'b' }))
    await repository.delete('a')

    const { workspaces } = await repository.list()
    expect(workspaces.map((workspace) => workspace.id)).toEqual(['b'])
  })

  it('replaceAll() overwrites the entire stored array', async () => {
    const storage = createStorage({})
    const repository = createWorkspaceRepository(storage)

    await repository.put(createWorkspace({ id: 'a' }))
    await repository.replaceAll([createWorkspace({ id: 'b' })])

    const { workspaces } = await repository.list()
    expect(workspaces.map((workspace) => workspace.id)).toEqual(['b'])
  })

  it('drops malformed sibling records but keeps valid ones, reporting the skipped count', async () => {
    const valid = createWorkspace({ id: 'a' })
    const storage = createStorage({
      workspaces: [valid, { id: 'bad', name: '', createdAt: 'nope', updatedAt: 'nope', tabs: [] }],
    })
    const repository = createWorkspaceRepository(storage)

    const result = await repository.list()

    expect(result.workspaces).toEqual([valid])
    expect(result.skippedCount).toBe(1)
  })

  it('always performs an immutable read-modify-write of the full array, never a partial update', async () => {
    const persisted: Record<string, unknown> = {}
    const setCalls: Array<Record<string, unknown>> = []
    const storage: WorkspaceStorageArea = {
      async get() {
        return persisted
      },
      async set(items) {
        setCalls.push(items)
        Object.assign(persisted, items)
      },
      async remove(keys) {
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          delete persisted[key]
        }
      },
    }
    const repository = createWorkspaceRepository(storage)

    await repository.put(createWorkspace({ id: 'a' }))

    expect(setCalls).toEqual([{ workspaces: [expect.objectContaining({ id: 'a' })] }])
  })
})

function createRawWorkspace(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'abc',
    name: 'Research',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    tabs: [{ url: 'https://example.com', title: 'Example', pinned: false }],
    ...overrides,
  }
}

function createWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'abc',
    name: 'Research',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    tabs: [{ url: 'https://example.com', title: 'Example', pinned: false }],
    ...overrides,
  }
}

function createStorage(persisted: Record<string, unknown>): WorkspaceStorageArea {
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
