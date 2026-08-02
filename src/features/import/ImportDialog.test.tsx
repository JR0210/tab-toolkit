import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createStubBrowserGateway } from '../../test/browser-gateway-mock'
import { SettingsContext } from '../../shared/settings/settings-context'
import type { SettingsContextValue } from '../../shared/settings/settings-context'
import { Toaster } from '../../shared/ui/toaster'
import type { Workspace } from '../workspaces/workspace'
import type { WorkspaceRepository } from '../workspaces/workspace-repository'
import { ImportDialog } from './ImportDialog'

describe('ImportDialog', () => {
  it('shows a live valid/invalid count as the text changes', async () => {
    const user = userEvent.setup()
    renderDialog({})

    const textarea = screen.getByLabelText('URLs')
    await user.type(textarea, 'https://a.example{Enter}not a url')

    expect(screen.getByText('1 valid URL, 1 invalid line')).toBeVisible()
  })

  it('previews up to the first 4 normalized valid URLs', async () => {
    const user = userEvent.setup()
    renderDialog({})

    const textarea = screen.getByLabelText('URLs')
    await user.click(textarea)
    await user.paste(
      'https://a.example\nhttps://b.example\nhttps://c.example\nhttps://d.example\nhttps://e.example',
    )

    expect(screen.getByText('https://a.example/')).toBeVisible()
    expect(screen.getByText('https://b.example/')).toBeVisible()
    expect(screen.getByText('https://c.example/')).toBeVisible()
    expect(screen.getByText('https://d.example/')).toBeVisible()
    expect(screen.queryByText('https://e.example/')).not.toBeInTheDocument()
  })

  it('lists each invalid line with its reason inside an expandable details region', async () => {
    const user = userEvent.setup()
    renderDialog({})

    const textarea = screen.getByLabelText('URLs')
    await user.click(textarea)
    await user.paste('not a url\njavascript:alert(1)')

    const summary = screen.getByText('2 invalid lines')
    const details = summary.closest('details')
    expect(details).not.toBeNull()

    await user.click(summary)

    expect(screen.getByText(/Invalid URL/)).toBeVisible()
    expect(screen.getByText(/Only HTTP and HTTPS URLs are supported/)).toBeVisible()
  })

  it('disables Import when there are zero valid URLs', async () => {
    const user = userEvent.setup()
    renderDialog({})

    const textarea = screen.getByLabelText('URLs')
    await user.click(textarea)
    await user.paste('not a url')

    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
  })

  it('allows an empty workspace name (no workspace requested)', async () => {
    const user = userEvent.setup()
    renderDialog({})

    const textarea = screen.getByLabelText('URLs')
    await user.click(textarea)
    await user.paste('https://a.example')

    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled()
  })

  it('disables Import when the workspace name is whitespace-only but non-empty', async () => {
    const user = userEvent.setup()
    renderDialog({})

    const textarea = screen.getByLabelText('URLs')
    await user.click(textarea)
    await user.paste('https://a.example')
    await user.type(screen.getByLabelText(/Save as workspace/), '   ')

    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
  })

  it('imports valid URLs, closes the dialog, and shows a toast reporting counts on success', async () => {
    const user = userEvent.setup()
    const createWindow = vi.fn().mockResolvedValue({ windowId: 9, tabId: 1 })
    const createTab = vi.fn().mockResolvedValue(2)
    const gateway = createStubBrowserGateway({ createWindow, createTab })
    const onOpenChange = vi.fn()
    const onImported = vi.fn()

    renderDialog({ gateway, onOpenChange, onImported })

    const textarea = screen.getByLabelText('URLs')
    await user.click(textarea)
    await user.paste('https://a.example\nhttps://b.example')
    await user.click(screen.getByRole('button', { name: 'Import' }))

    expect(await screen.findByText(/Opened 2 tabs/)).toBeVisible()
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onImported).toHaveBeenCalled()
  })

  it('keeps the text input intact and does not close when the import fails', async () => {
    const user = userEvent.setup()
    const gateway = createStubBrowserGateway({
      createWindow: vi.fn().mockResolvedValue({ windowId: 9, tabId: 1 }),
    })
    const put = vi.fn().mockRejectedValue(new Error('storage unavailable'))
    const onOpenChange = vi.fn()

    renderDialog({ gateway, repository: createRepository({ put }), onOpenChange })

    const textarea = screen.getByLabelText('URLs')
    await user.click(textarea)
    await user.paste('https://a.example')
    await user.type(screen.getByLabelText(/Save as workspace/), 'Reading list')
    await user.click(screen.getByRole('button', { name: 'Import' }))

    expect(await screen.findByText(/Could not import/)).toBeVisible()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect((textarea as HTMLTextAreaElement).value).toBe('https://a.example')
  })

  it('does not clear the draft when the dialog is dismissed while an import is still in flight', async () => {
    const user = userEvent.setup()
    const pending = createDeferred<{ windowId: number; tabId: number }>()
    const gateway = createStubBrowserGateway({
      createWindow: vi.fn().mockReturnValue(pending.promise),
    })

    renderDialog({ gateway })

    const textarea = screen.getByLabelText('URLs')
    await user.click(textarea)
    await user.paste('https://a.example')
    await user.type(screen.getByLabelText(/Save as workspace/), 'Reading list')
    await user.click(screen.getByRole('button', { name: 'Import' }))

    // The import hasn't resolved yet -- dismiss the dialog via Cancel now.
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect((textarea as HTMLTextAreaElement).value).toBe('https://a.example')
    expect(screen.getByLabelText(/Save as workspace/)).toHaveValue('Reading list')

    pending.resolve({ windowId: 9, tabId: 1 })
  })
})

function createDeferred<Value>() {
  let resolve: (value: Value) => void = () => {
    throw new Error('Deferred promise is not initialized')
  }
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

function renderDialog({
  gateway = createStubBrowserGateway(),
  repository = createRepository(),
  onOpenChange = vi.fn(),
  onImported = vi.fn(),
}: {
  gateway?: ReturnType<typeof createStubBrowserGateway>
  repository?: WorkspaceRepository
  onOpenChange?: (open: boolean) => void
  onImported?: () => void
}) {
  return render(
    <SettingsContext value={createSettingsContext()}>
      <ImportDialog
        open
        onOpenChange={onOpenChange}
        gateway={gateway}
        repository={repository}
        onImported={onImported}
      />
      <Toaster />
    </SettingsContext>,
  )
}

function createSettingsContext(): SettingsContextValue {
  return {
    settings: { theme: 'light', scope: 'current', copyFormat: 'markdown' },
    resolvedTheme: 'light',
    persistenceError: null,
    async updateSettings() {},
  }
}

function createRepository(overrides: Partial<WorkspaceRepository> = {}): WorkspaceRepository {
  return {
    list: vi.fn().mockResolvedValue({ workspaces: [] as Workspace[], skippedCount: 0 }),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    replaceAll: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}
