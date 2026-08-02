import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Workspace } from './workspace'
import { WorkspaceCard } from './WorkspaceCard'

describe('WorkspaceCard', () => {
  it('derives the tab count from workspace.tabs.length rather than a stored field', () => {
    const workspace = createWorkspace({
      tabs: [createDescriptor('https://a.example.com'), createDescriptor('https://b.example.com')],
    })

    render(<WorkspaceCard workspace={workspace} onRename={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText('2 tabs')).toBeVisible()
  })

  it('uses singular "tab" for a workspace with exactly one tab', () => {
    const workspace = createWorkspace({ tabs: [createDescriptor('https://a.example.com')] })

    render(<WorkspaceCard workspace={workspace} onRename={vi.fn()} onDelete={vi.fn()} />)

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

    render(<WorkspaceCard workspace={workspace} onRename={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getAllByTestId('workspace-favicon')).toHaveLength(4)
    expect(screen.getByTestId('workspace-favicon-overflow')).toHaveTextContent('+1')
  })

  it('renders exactly as many favicon indicators as tabs when there are fewer than 4', () => {
    const workspace = createWorkspace({ tabs: [createDescriptor('https://a.example.com')] })

    render(<WorkspaceCard workspace={workspace} onRename={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getAllByTestId('workspace-favicon')).toHaveLength(1)
    expect(screen.queryByTestId('workspace-favicon-overflow')).not.toBeInTheDocument()
  })

  it('falls back to a safe placeholder when a tab url has no recognizable domain', () => {
    const workspace = createWorkspace({ tabs: [createDescriptor('not a real url')] })

    render(<WorkspaceCard workspace={workspace} onRename={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getAllByTestId('workspace-favicon')[0]).toHaveTextContent('?')
  })

  it('formats the relative date deterministically from an injected clock', () => {
    const workspace = createWorkspace({ updatedAt: '2026-08-01T12:00:00.000Z' })

    render(
      <WorkspaceCard
        workspace={workspace}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        now={new Date('2026-08-01T12:05:00.000Z')}
      />,
    )

    expect(screen.getByText(/5 minutes ago/)).toBeVisible()
  })

  it('disables saving a rename until the name is non-empty', async () => {
    const user = userEvent.setup()
    const workspace = createWorkspace({ name: 'Research' })

    render(<WorkspaceCard workspace={workspace} onRename={vi.fn()} onDelete={vi.fn()} />)

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

    render(<WorkspaceCard workspace={workspace} onRename={onRename} onDelete={vi.fn()} />)

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

    render(<WorkspaceCard workspace={workspace} onRename={vi.fn()} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: 'Delete Research' }))

    expect(onDelete).not.toHaveBeenCalled()
    expect(await screen.findByRole('dialog')).toBeVisible()
  })

  it('calls onDelete only after confirming in the dialog', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockResolvedValue(undefined)
    const workspace = createWorkspace({ name: 'Research' })

    render(<WorkspaceCard workspace={workspace} onRename={vi.fn()} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: 'Delete Research' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(onDelete).toHaveBeenCalledExactlyOnceWith(workspace.id)
  })

  it('renders the Open workspace control as disabled with explanatory text', () => {
    const workspace = createWorkspace({})

    render(<WorkspaceCard workspace={workspace} onRename={vi.fn()} onDelete={vi.fn()} />)

    const openButton = screen.getByRole('button', { name: /Open workspace/ })
    expect(openButton).toBeDisabled()
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
