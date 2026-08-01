import { describe, expect, it, vi } from 'vitest'
import { createSettingsRepository } from './settings-repository'
import type { SettingsStorageArea } from './settings-repository'

describe('createSettingsRepository', () => {
  it('falls back per field when stored settings are malformed', async () => {
    // Catches a repository that trusts an invalid stored union value or
    // discards valid sibling fields when one field is malformed.
    const storage = {
      get: vi.fn().mockResolvedValue({ settings: { theme: 'neon', scope: 'all' } }),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    }
    const repository = createSettingsRepository(storage)

    await expect(repository.load()).resolves.toEqual({
      theme: 'system',
      scope: 'all',
      copyFormat: 'markdown',
    })
  })

  it('falls back only for a malformed scope value', async () => {
    // Catches a repository that validates all settings as one object and loses
    // valid theme and copy format values when only scope is malformed.
    const storage = {
      get: vi.fn().mockResolvedValue({
        settings: { theme: 'dark', scope: 'everywhere', copyFormat: 'json' },
      }),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    }
    const repository = createSettingsRepository(storage)

    await expect(repository.load()).resolves.toEqual({
      theme: 'dark',
      scope: 'current',
      copyFormat: 'json',
    })
  })

  it('falls back only for a malformed copy format value', async () => {
    // Catches a repository that accepts an invalid copy format or resets
    // otherwise valid persisted settings.
    const storage = {
      get: vi.fn().mockResolvedValue({
        settings: { theme: 'light', scope: 'all', copyFormat: 'text' },
      }),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    }
    const repository = createSettingsRepository(storage)

    await expect(repository.load()).resolves.toEqual({
      theme: 'light',
      scope: 'all',
      copyFormat: 'markdown',
    })
  })

  it('persists explicit settings changes', async () => {
    // Catches a repository that only updates in-memory state instead of
    // writing the complete settings object to local storage.
    const persisted: Record<string, unknown> = {}
    const storage = createStorage(persisted)
    const repository = createSettingsRepository(storage)

    await repository.save({ theme: 'dark', scope: 'all', copyFormat: 'csv' })

    await expect(repository.load()).resolves.toEqual({
      theme: 'dark',
      scope: 'all',
      copyFormat: 'csv',
    })
  })

  it('resets settings by removing the persisted value', async () => {
    // Catches a repository that leaves a saved value behind after reset.
    const persisted: Record<string, unknown> = {
      settings: { theme: 'dark', scope: 'all', copyFormat: 'html' },
    }
    const storage = createStorage(persisted)
    const repository = createSettingsRepository(storage)

    await repository.reset()

    await expect(repository.load()).resolves.toEqual({
      theme: 'system',
      scope: 'current',
      copyFormat: 'markdown',
    })
  })
})

function createStorage(persisted: Record<string, unknown>): SettingsStorageArea {
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
