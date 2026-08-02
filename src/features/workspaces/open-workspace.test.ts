import { describe, expect, it, vi } from 'vitest'
import { createStubBrowserGateway } from '../../test/browser-gateway-mock'
import { openWorkspace } from './open-workspace'
import type { Workspace } from './workspace'

describe('openWorkspace', () => {
  it('passes every saved descriptor through to the restore primitive in stored order, unmodified', async () => {
    const createWindow = vi.fn().mockResolvedValue({ windowId: 9, tabId: 1 })
    const createTab = vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(3)
    const gateway = createStubBrowserGateway({ createWindow, createTab })
    const workspace = createWorkspace({
      tabs: [
        { url: 'https://z.example/', title: 'Z title', pinned: true },
        {
          url: 'https://a.example/',
          title: 'A title',
          pinned: false,
          group: { title: 'Research', color: 'yellow' },
        },
        { url: 'https://m.example/', title: 'M title', pinned: false },
      ],
    })

    const result = await openWorkspace(workspace, gateway)

    expect(createWindow).toHaveBeenCalledExactlyOnceWith('https://z.example/')
    expect(createTab).toHaveBeenNthCalledWith(1, {
      windowId: 9,
      url: 'https://a.example/',
      index: 1,
    })
    expect(createTab).toHaveBeenNthCalledWith(2, {
      windowId: 9,
      url: 'https://m.example/',
      index: 2,
    })
    expect(result.created).toEqual([
      { descriptorIndex: 0, tabId: 1 },
      { descriptorIndex: 1, tabId: 2 },
      { descriptorIndex: 2, tabId: 3 },
    ])
    expect(result.failed).toEqual([])
  })

  it('does not rewrite URLs or titles before restoring', async () => {
    const createWindow = vi.fn().mockResolvedValue({ windowId: 9, tabId: 1 })
    const gateway = createStubBrowserGateway({ createWindow })
    const workspace = createWorkspace({
      tabs: [{ url: 'https://example.com/weird?a=1#frag', title: 'Weird Title', pinned: false }],
    })

    await openWorkspace(workspace, gateway)

    expect(createWindow).toHaveBeenCalledExactlyOnceWith('https://example.com/weird?a=1#frag')
  })
})

function createWorkspace(overrides: Partial<Workspace>): Workspace {
  return {
    id: 'ws-1',
    name: 'Research',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    tabs: [{ url: 'https://example.com', title: 'Example', pinned: false }],
    ...overrides,
  }
}
