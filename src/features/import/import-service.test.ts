import { describe, expect, it, vi } from 'vitest'
import { createStubBrowserGateway } from '../../test/browser-gateway-mock'
import type { Workspace } from '../workspaces/workspace'
import type { WorkspaceRepository } from '../workspaces/workspace-repository'
import { importUrls } from './import-service'

describe('importUrls', () => {
  it('opens all valid URLs into a new window and does not save a workspace when no name is given', async () => {
    const createWindow = vi.fn().mockResolvedValue({ windowId: 9, tabId: 101 })
    const createTab = vi.fn().mockResolvedValueOnce(102)
    const gateway = createStubBrowserGateway({ createWindow, createTab })
    const put = vi.fn().mockResolvedValue(undefined)
    const repository = createRepository({ put })

    const result = await importUrls(
      { text: 'https://a.example\nhttps://b.example' },
      { gateway, repository },
    )

    expect(createWindow).toHaveBeenCalledExactlyOnceWith('https://a.example/')
    expect(createTab).toHaveBeenCalledExactlyOnceWith({
      windowId: 9,
      url: 'https://b.example/',
      index: 1,
    })
    expect(put).not.toHaveBeenCalled()
    expect(result).toEqual({
      openedCount: 2,
      failedCount: 0,
      parseErrorCount: 0,
      savedCount: 0,
    })
  })

  it('runs restore first, then saves a workspace with the same normalized ordered URLs when a name is given', async () => {
    const calls: string[] = []
    const createWindow = vi.fn().mockImplementation(async () => {
      calls.push('createWindow')
      return { windowId: 9, tabId: 201 }
    })
    const createTab = vi.fn().mockImplementation(async () => {
      calls.push('createTab')
      return 202
    })
    const gateway = createStubBrowserGateway({ createWindow, createTab })
    const put = vi.fn().mockImplementation(async () => {
      calls.push('put')
    })
    const repository = createRepository({ put })

    const result = await importUrls(
      { text: 'https://a.example\nlocalhost:5173/path', workspaceName: 'Reading list' },
      { gateway, repository },
    )

    expect(calls).toEqual(['createWindow', 'createTab', 'put'])
    expect(put).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        name: 'Reading list',
        tabs: [
          { url: 'https://a.example/', title: 'https://a.example/', pinned: false },
          {
            url: 'http://localhost:5173/path',
            title: 'http://localhost:5173/path',
            pinned: false,
          },
        ],
      }),
    )
    expect(result).toEqual({
      openedCount: 2,
      failedCount: 0,
      parseErrorCount: 0,
      savedCount: 2,
    })
  })

  it('saves all valid requested URLs to the workspace even when some fail to open', async () => {
    const createWindow = vi.fn().mockResolvedValue({ windowId: 9, tabId: 301 })
    const createTab = vi.fn().mockRejectedValueOnce(new Error('Chrome refused'))
    const gateway = createStubBrowserGateway({ createWindow, createTab })
    const put = vi.fn().mockResolvedValue(undefined)
    const repository = createRepository({ put })

    const result = await importUrls(
      { text: 'https://a.example\nhttps://b.example', workspaceName: 'Reading list' },
      { gateway, repository },
    )

    expect(put).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        tabs: [
          { url: 'https://a.example/', title: 'https://a.example/', pinned: false },
          { url: 'https://b.example/', title: 'https://b.example/', pinned: false },
        ],
      }),
    )
    expect(result).toEqual({
      openedCount: 1,
      failedCount: 1,
      parseErrorCount: 0,
      savedCount: 2,
    })
  })

  it('reports parse errors alongside opened/failed counts', async () => {
    const gateway = createStubBrowserGateway({
      createWindow: vi.fn().mockResolvedValue({ windowId: 9, tabId: 401 }),
    })
    const repository = createRepository()

    const result = await importUrls(
      { text: 'https://a.example\nnot a url\njavascript:x' },
      { gateway, repository },
    )

    expect(result).toEqual({
      openedCount: 1,
      failedCount: 0,
      parseErrorCount: 2,
      savedCount: 0,
    })
  })

  it('treats a whitespace-only workspace name the same as no name: does not save', async () => {
    const gateway = createStubBrowserGateway({
      createWindow: vi.fn().mockResolvedValue({ windowId: 9, tabId: 501 }),
    })
    const put = vi.fn().mockResolvedValue(undefined)
    const repository = createRepository({ put })

    const result = await importUrls(
      { text: 'https://a.example', workspaceName: '   ' },
      { gateway, repository },
    )

    expect(put).not.toHaveBeenCalled()
    expect(result.savedCount).toBe(0)
  })

  it('fails outright without creating a window or saving a workspace when there are zero valid URLs', async () => {
    const createWindow = vi.fn().mockResolvedValue({ windowId: 9, tabId: 601 })
    const gateway = createStubBrowserGateway({ createWindow })
    const put = vi.fn().mockResolvedValue(undefined)
    const repository = createRepository({ put })

    await expect(
      importUrls(
        { text: 'not a url\njavascript:x', workspaceName: 'Reading list' },
        { gateway, repository },
      ),
    ).rejects.toThrow()

    expect(createWindow).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })
})

function createRepository(overrides: Partial<WorkspaceRepository> = {}): WorkspaceRepository {
  return {
    list: vi.fn().mockResolvedValue({ workspaces: [] as Workspace[], skippedCount: 0 }),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    replaceAll: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}
