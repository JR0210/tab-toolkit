import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BrowserProvider } from '../../chrome/browser-context'
import type { BrowserGateway } from '../../chrome/browser-gateway'
import { createStubBrowserGateway } from '../../test/browser-gateway-mock'
import { TabsContext } from '../tabs/tabs-context'
import type { TabsContextValue } from '../tabs/tabs-context'
import type { Workspace } from './workspace'
import { WorkspaceCard } from './WorkspaceCard'

describe('WorkspaceCard', () => {
  it('derives the tab count from workspace.tabs.length rather than a stored field', () => {
    const workspace = createWorkspace({
      tabs: [createDescriptor('https://a.example.com'), createDescriptor('https://b.example.com')],
    })

    renderCard({ workspace })

    expect(screen.getByText('2 tabs')).toBeVisible()
  })

  it('uses singular "tab" for a workspace with exactly one tab', () => {
    const workspace = createWorkspace({ tabs: [createDescriptor('https://a.example.com')] })

    renderCard({ workspace })

    expect(screen.getByText('1 tab')).toBeVisible()
  })

  it('renders at most 4 favicon indicators plus an overflow badge for the rest', () => {
    const workspace = createWorkspace({
      tabs: [
        createDescriptor('https://a.example.com'),
        createDescriptor('https://b.example.com'),
        createDescriptor('https://c.example.com'),
        createDescriptor('https://d.example.com'),
        createDescriptor('https://e.example.com'),
      ],
    })

    renderCard({ workspace })

    expect(screen.getAllByTestId('workspace-favicon')).toHaveLength(4)
    expect(screen.getByTestId('workspace-favicon-overflow')).toHaveTextContent('+1')
  })

  it('renders exactly as many favicon indicators as tabs when there are fewer than 4', () => {
    const workspace = createWorkspace({ tabs: [createDescriptor('https://a.example.com')] })

    renderCard({ workspace })

    expect(screen.getAllByTestId('workspace-favicon')).toHaveLength(1)
    expect(screen.queryByTestId('workspace-favicon-overflow')).not.toBeInTheDocument()
  })

  it('falls back to a safe placeholder when a tab url has no recognizable domain', () => {
    const workspace = createWorkspace({ tabs: [createDescriptor('not a real url')] })

    renderCard({ workspace })

    expect(screen.getAllByTestId('workspace-favicon')[0]).toHaveTextContent('?')
  })

  it('formats the relative date deterministically from an injected clock', () => {
    const workspace = createWorkspace({ updatedAt: '2026-08-01T12:00:00.000Z' })

    renderCard({ workspace, now: new Date('2026-08-01T12:05:00.000Z') })

    expect(screen.getByText(/5 minutes ago/)).toBeVisible()
  })

  it('disables saving a rename until the name is non-empty', async () => {
    const user = userEvent.setup()
    const workspace = createWorkspace({ name: 'Research' })

    renderCard({ workspace })

    await user.click(screen.getByRole('button', { name: 'Rename Research' }))
    const dialog = await screen.findByRole('dialog')
    const nameInput = within(dialog).getByLabelText('Name')

    await user.clear(nameInput)
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()

    await user.type(nameInput, 'New name')
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('calls onRename with the trimmed name when Save is confirmed', async () => {
    const user = userEvent.setup()
    const onRename = vi.fn().mockResolvedValue(undefined)
    const workspace = createWorkspace({ name: 'Research' })

    renderCard({ workspace, onRename })

    await user.click(screen.getByRole('button', { name: 'Rename Research' }))
    const dialog = await screen.findByRole('dialog')
    const nameInput = within(dialog).getByLabelText('Name')

    await user.clear(nameInput)
    await user.type(nameInput, '  Renamed  ')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(onRename).toHaveBeenCalledExactlyOnceWith(workspace.id, 'Renamed')
  })

  it('requires confirmation before deleting: the trigger alone does not call onDelete', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockResolvedValue(undefined)
    const workspace = createWorkspace({ name: 'Research' })

    renderCard({ workspace, onDelete })

    await user.click(screen.getByRole('button', { name: 'Delete Research' }))

    expect(onDelete).not.toHaveBeenCalled()
    expect(await screen.findByRole('dialog')).toBeVisible()
  })

  it('calls onDelete only after confirming in the dialog', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockResolvedValue(undefined)
    const workspace = createWorkspace({ name: 'Research' })

    renderCard({ workspace, onDelete })

    await user.click(screen.getByRole('button', { name: 'Delete Research' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(onDelete).toHaveBeenCalledExactlyOnceWith(workspace.id)
  })

  it('keeps the rename dialog open and does not throw when onRename rejects', async () => {
    const user = userEvent.setup()
    const onRename = vi.fn().mockRejectedValue(new Error('storage unavailable'))
    const workspace = createWorkspace({ name: 'Research' })

    renderCard({ workspace, onRename })

    await user.click(screen.getByRole('button', { name: 'Rename Research' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(onRename).toHaveBeenCalledOnce()
    expect(screen.getByRole('dialog')).toBeVisible()
  })

  it('does not resubmit a rename while the previous one is still pending', async () => {
    const user = userEvent.setup()
    const pending = createDeferred<void>()
    const onRename = vi.fn().mockReturnValue(pending.promise)
    const workspace = createWorkspace({ name: 'Research' })

    renderCard({ workspace, onRename })

    await user.click(screen.getByRole('button', { name: 'Rename Research' }))
    const dialog = await screen.findByRole('dialog')
    const nameInput = within(dialog).getByLabelText('Name')
    await user.type(nameInput, '{Enter}')
    await user.type(nameInput, '{Enter}')

    expect(onRename).toHaveBeenCalledOnce()
    pending.resolve()
  })

  it('keeps the delete dialog open and does not throw when onDelete rejects', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockRejectedValue(new Error('storage unavailable'))
    const workspace = createWorkspace({ name: 'Research' })

    renderCard({ workspace, onDelete })

    await user.click(screen.getByRole('button', { name: 'Delete Research' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(onDelete).toHaveBeenCalledOnce()
    expect(screen.getByRole('dialog')).toBeVisible()
  })

  it('opens a workspace by forwarding it to restoreIntoNewWindow via the browser gateway', async () => {
    const user = userEvent.setup()
    const createWindow = vi.fn().mockResolvedValue({ windowId: 9, tabId: 1 })
    const gateway = createStubBrowserGateway({ createWindow })
    const workspace = createWorkspace({
      name: 'Research',
      tabs: [createDescriptor('https://a.example.com')],
    })

    renderCard({ workspace, gateway })

    await user.click(screen.getByRole('button', { name: 'Open workspace: Research' }))

    expect(createWindow).toHaveBeenCalledExactlyOnceWith('https://a.example.com')
  })

  it('invokes restore only once when the Open workspace button is double-clicked while pending', async () => {
    const user = userEvent.setup()
    const createWindow = vi
      .fn()
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ windowId: 9, tabId: 1 }), 20)),
      )
    const gateway = createStubBrowserGateway({ createWindow })
    const workspace = createWorkspace({
      name: 'Research',
      tabs: [createDescriptor('https://a.example.com')],
    })

    renderCard({ workspace, gateway })

    const openButton = screen.getByRole('button', { name: 'Open workspace: Research' })
    await user.dblClick(openButton)

    expect(createWindow).toHaveBeenCalledTimes(1)
  })

  it('refreshes the tab snapshot after opening a workspace', async () => {
    const user = userEvent.setup()
    const gateway = createStubBrowserGateway({
      createWindow: vi.fn().mockResolvedValue({ windowId: 9, tabId: 1 }),
    })
    const refresh = vi.fn().mockResolvedValue(undefined)
    const workspace = createWorkspace({ tabs: [createDescriptor('https://a.example.com')] })

    renderCard({ workspace, gateway, refresh })

    await user.click(screen.getByRole('button', { name: /Open workspace/ }))

    expect(refresh).toHaveBeenCalled()
  })
})

function createDescriptor(url: string) {
  return { url, title: 'Tab', pinned: false }
}

function createWorkspace(overrides: Partial<Workspace>): Workspace {
  return {
    id: 'ws-1',
    name: 'Research',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    tabs: [createDescriptor('https://example.com')],
    ...overrides,
  }
}

function createDeferred<Value>() {
  let resolve: (value: Value) => void = () => {
    throw new Error('Deferred promise is not initialized')
  }
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

function renderCard({
  workspace,
  onRename = vi.fn().mockResolvedValue(undefined),
  onDelete = vi.fn().mockResolvedValue(undefined),
  now,
  gateway = createStubBrowserGateway(),
  refresh = vi.fn().mockResolvedValue(undefined),
}: {
  workspace: Workspace
  onRename?: (id: string, newName: string) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  now?: Date
  gateway?: BrowserGateway
  refresh?: TabsContextValue['refresh']
}) {
  return render(
    <BrowserProvider gateway={gateway}>
      <TabsContext value={createTabsContextValue(refresh)}>
        <WorkspaceCard workspace={workspace} onRename={onRename} onDelete={onDelete} now={now} />
      </TabsContext>
    </BrowserProvider>,
  )
}

function createTabsContextValue(refresh: TabsContextValue['refresh']): TabsContextValue {
  return {
    snapshot: { tabs: [], groups: [], currentWindowId: 1, capturedAt: 0 },
    status: 'ready',
    error: null,
    refresh,
    activateTab: vi.fn().mockResolvedValue(undefined),
  }
}
