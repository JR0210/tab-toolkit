import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import App from './App'
import { createSettingsRepository } from './shared/settings/settings-repository'
import type { SettingsStorageArea } from './shared/settings/settings-repository'

afterEach(() => {
  document.documentElement.classList.remove('dark')
  vi.unstubAllGlobals()
})

it('renders the popup at the fixed Chrome surface size', () => {
  // Catches a return to the responsive web-preview canvas, which can overflow
  // the extension popup instead of owning its exact viewport.
  renderApp()

  expect(screen.getByTestId('popup-root')).toHaveStyle({
    width: '760px',
    height: '580px',
    overflow: 'hidden',
  })
})

it('exposes Tabs as the current primary view and can switch to Workspaces', async () => {
  // Catches nav markup that loses current-page semantics or omits the second
  // product view while later loops are still being implemented.
  renderApp()

  expect(screen.getByText('Tab Toolkit')).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Primary views' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Tabs' })).toHaveAttribute('aria-current', 'page')
  const workspaces = screen.getByRole('button', { name: 'Workspaces' })
  expect(workspaces).not.toHaveAttribute('aria-current')

  await userEvent.click(workspaces)

  expect(workspaces).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('button', { name: 'Tabs' })).not.toHaveAttribute('aria-current')
})

it('gives every header icon button an accessible name', () => {
  // Catches icon-only controls that become unlabeled when their visible icons
  // or tooltip implementation changes.
  renderApp()

  expect(screen.getByRole('button', { name: /Switch to (?:dark|light) theme/ })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Settings' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'More options' })).toBeVisible()
})

it('applies an explicit theme choice from the header', async () => {
  // Catches a shell that renders the theme control but does not connect it to
  // the injected settings provider.
  renderApp()

  await userEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }))

  expect(await screen.findByRole('button', { name: 'Switch to light theme' })).toBeVisible()
  expect(document.documentElement).toHaveClass('dark')
})

it('reacts to system theme changes throughout the app shell', async () => {
  // Catches a provider that updates the root class for an OS theme change but
  // leaves Header's icon, accessible label, and next toggle target stale.
  const mediaQuery = createMediaQueryList(false)
  renderApp({ theme: 'system', mediaQuery })

  expect(await screen.findByRole('button', { name: 'Switch to dark theme' })).toBeVisible()

  await act(async () => {
    mediaQuery.emitChange(true)
  })

  expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeVisible()
  expect(document.documentElement).toHaveClass('dark')

  await act(async () => {
    mediaQuery.emitChange(false)
  })

  expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible()
  expect(document.documentElement).not.toHaveClass('dark')
})

it('reports a rejected theme save and recovers for a later write', async () => {
  // Catches a discarded persistence rejection and a poisoned write queue that
  // prevents later theme changes from reaching storage.
  const storage = createFlakyStorage()
  const repository = createSettingsRepository(storage)
  const user = userEvent.setup()
  renderApp({ repository })

  await user.click(await screen.findByRole('button', { name: 'Switch to dark theme' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Theme preference could not be saved. Try again.',
  )

  await user.click(screen.getByRole('button', { name: 'Switch to light theme' }))
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())

  await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }))
  await waitFor(async () => {
    await expect(repository.load()).resolves.toEqual({
      theme: 'dark',
      scope: 'current',
      copyFormat: 'markdown',
    })
  })
})

function renderApp({
  theme = 'light',
  mediaQuery = createMediaQueryList(false),
  repository,
}: {
  theme?: 'light' | 'dark' | 'system'
  mediaQuery?: TestMediaQueryList
  repository?: ReturnType<typeof createSettingsRepository>
} = {}) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mediaQuery))
  const storage: SettingsStorageArea = {
    async get() {
      return {
        settings: { theme, scope: 'current', copyFormat: 'markdown' },
      }
    },
    async set() {},
    async remove() {},
  }

  return render(<App repository={repository ?? createSettingsRepository(storage)} />)
}

function createFlakyStorage(): SettingsStorageArea {
  const persisted: Record<string, unknown> = {
    settings: { theme: 'light', scope: 'current', copyFormat: 'markdown' },
  }
  let shouldReject = true

  return {
    async get() {
      return persisted
    },
    async set(items: Record<string, unknown>) {
      if (shouldReject) {
        shouldReject = false
        throw new Error('local storage is unavailable')
      }

      Object.assign(persisted, items)
    },
    async remove() {},
  }
}

interface TestMediaQueryList extends MediaQueryList {
  emitChange(matches: boolean): void
}

function createMediaQueryList(initialMatches: boolean): TestMediaQueryList {
  let matches = initialMatches
  const changeListeners = new Set<(event: MediaQueryListEvent) => void>()

  return {
    get matches() {
      return matches
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addListener(listener: (event: MediaQueryListEvent) => void) {
      changeListeners.add(listener)
    },
    removeListener(listener: (event: MediaQueryListEvent) => void) {
      changeListeners.delete(listener)
    },
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type === 'change' && typeof listener === 'function') {
        changeListeners.add(listener as (event: MediaQueryListEvent) => void)
      }
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type === 'change' && typeof listener === 'function') {
        changeListeners.delete(listener as (event: MediaQueryListEvent) => void)
      }
    },
    dispatchEvent: vi.fn().mockReturnValue(true),
    emitChange(nextMatches: boolean) {
      matches = nextMatches
      const event = { matches, media: this.media } as MediaQueryListEvent

      for (const listener of changeListeners) {
        listener(event)
      }
    },
  }
}
