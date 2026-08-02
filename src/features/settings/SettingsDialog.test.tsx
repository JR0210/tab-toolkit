import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserProvider } from '../../chrome/browser-context'
import type { BrowserGateway } from '../../chrome/browser-gateway'
import { defaultSettings } from '../../shared/settings/settings'
import { SettingsProvider } from '../../shared/settings/settings-provider'
import { createSettingsRepository } from '../../shared/settings/settings-repository'
import type { SettingsStorageArea } from '../../shared/settings/settings-repository'
import { createStubBrowserGateway } from '../../test/browser-gateway-mock'
import { ShortcutHandlersProvider } from '../shortcuts/use-popup-shortcuts'
import { SettingsDialog } from './SettingsDialog'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SettingsDialog', () => {
  it('persists a theme change', async () => {
    const user = userEvent.setup()
    const { repository } = renderDialog()
    await screen.findByRole('radio', { name: 'System' })

    await user.click(screen.getByRole('radio', { name: 'Dark' }))

    await waitFor(async () => {
      await expect(repository.load()).resolves.toMatchObject({ theme: 'dark' })
    })
  })

  it('persists a default scope change', async () => {
    const user = userEvent.setup()
    const { repository } = renderDialog()
    await screen.findByRole('radio', { name: 'Current window' })

    await user.click(screen.getByRole('radio', { name: 'All windows' }))

    await waitFor(async () => {
      await expect(repository.load()).resolves.toMatchObject({ scope: 'all' })
    })
  })

  it('persists a default copy format change', async () => {
    const user = userEvent.setup()
    const { repository } = renderDialog()
    await screen.findByRole('radio', { name: 'Markdown' })

    await user.click(screen.getByRole('radio', { name: 'CSV' }))

    await waitFor(async () => {
      await expect(repository.load()).resolves.toMatchObject({ copyFormat: 'csv' })
    })
  })

  it('resets every changed field to exact defaults', async () => {
    const user = userEvent.setup()
    const { repository } = renderDialog()
    await screen.findByRole('radio', { name: 'System' })

    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    await user.click(screen.getByRole('radio', { name: 'All windows' }))
    await user.click(screen.getByRole('radio', { name: 'CSV' }))
    await waitFor(async () => {
      await expect(repository.load()).resolves.toEqual({
        theme: 'dark',
        scope: 'all',
        copyFormat: 'csv',
      })
    })

    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }))

    await waitFor(async () => {
      await expect(repository.load()).resolves.toEqual(defaultSettings)
    })
    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Current window' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Markdown' })).toBeChecked()
  })

  it('reflects persisted values across close and reopen', async () => {
    const user = userEvent.setup()
    const { rerender, storage } = renderDialogControlled()
    await screen.findByRole('radio', { name: 'System' })

    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    await waitFor(async () => {
      await expect(storage.load()).resolves.toMatchObject({ theme: 'dark' })
    })

    rerender(false)
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument()

    rerender(true)
    expect(await screen.findByRole('radio', { name: 'Dark' })).toBeChecked()
  })

  it('opens the repository README with Help & documentation', async () => {
    const user = userEvent.setup()
    const openUrl = vi.fn().mockResolvedValue(undefined)
    renderDialog({ gateway: createStubBrowserGateway({ openUrl }) })

    await user.click(await screen.findByRole('button', { name: 'Help & documentation' }))

    expect(openUrl).toHaveBeenCalledExactlyOnceWith('https://github.com/JR0210/tab-toolkit')
  })

  it('shows the manifest version in the About section', async () => {
    const gateway = createStubBrowserGateway({
      getManifestVersion: vi.fn().mockReturnValue('7.8.9'),
    })
    renderDialog({ gateway })

    expect(await screen.findByText(/7\.8\.9/)).toBeVisible()
  })
})

function renderDialog({
  gateway = createStubBrowserGateway(),
}: {
  gateway?: BrowserGateway
} = {}) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(createStubMediaQueryList()))
  const storage = createInMemoryStorage()
  const repository = createSettingsRepository(storage)

  render(
    <BrowserProvider gateway={gateway}>
      <SettingsProvider repository={repository}>
        <ShortcutHandlersProvider>
          <SettingsDialog open onOpenChange={() => {}} />
        </ShortcutHandlersProvider>
      </SettingsProvider>
    </BrowserProvider>,
  )

  return { repository }
}

function renderDialogControlled() {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(createStubMediaQueryList()))
  const storage = createInMemoryStorage()
  const repository = createSettingsRepository(storage)

  function Wrapper({ open }: { open: boolean }) {
    return (
      <BrowserProvider gateway={createStubBrowserGateway()}>
        <SettingsProvider repository={repository}>
          <ShortcutHandlersProvider>
            <SettingsDialog open={open} onOpenChange={() => {}} />
          </ShortcutHandlersProvider>
        </SettingsProvider>
      </BrowserProvider>
    )
  }

  const view = render(<Wrapper open />)

  return {
    storage: repository,
    rerender: (open: boolean) => view.rerender(<Wrapper open={open} />),
  }
}

function createInMemoryStorage(): SettingsStorageArea {
  const persisted: Record<string, unknown> = { settings: defaultSettings }

  return {
    async get() {
      return persisted
    },
    async set(items) {
      Object.assign(persisted, items)
    },
    async remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete persisted[key]
      }
    },
  }
}

function createStubMediaQueryList(): MediaQueryList {
  return {
    matches: false,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn().mockReturnValue(true),
  }
}
