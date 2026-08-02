import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import App from './App'
import type { BrowserGateway } from './chrome/browser-gateway'
import type { TabSnapshot } from './domain/browser'
import type { CloseRepository, CloseSnapshot } from './features/tabs/close-repository'
import { createSettingsRepository } from './shared/settings/settings-repository'
import type { SettingsStorageArea } from './shared/settings/settings-repository'
import { createStubBrowserGateway } from './test/browser-gateway-mock'

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

it('opens Settings from the header and can reach the shortcuts reference from inside it', async () => {
  // Catches the Settings button never being wired to open anything, and the
  // Keyboard shortcuts entry point going missing from Settings.
  const user = userEvent.setup()
  renderApp()

  await user.click(await screen.findByRole('button', { name: 'Settings' }))
  expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }))
  expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible()
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
    'Settings could not be saved. Try again.',
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

it('Settings Reset clears an active filter while staying on the Tabs view', async () => {
  // Catches Reset only persisting settings.copyFormat/scope/theme while
  // leaving a stale filter in place -- the cross-tree reach documented in
  // TabsToolbar.tsx's 'reset-filters' registration. Deliberately stays on
  // the Tabs view throughout so TabsView/TabInteractionProvider never
  // unmounts -- switching away and back would clear the filter on its own
  // and the test wouldn't actually exercise the reset wiring.
  const user = userEvent.setup()
  renderApp({ gateway: createPinnedTabGateway() })

  await user.click(await screen.findByRole('button', { name: 'Filter tabs' }))
  await user.click(await screen.findByRole('checkbox', { name: 'Pinned' }))
  expect(screen.getByRole('button', { name: /Filter tabs/ })).toHaveAccessibleName(
    'Filter tabs, 1 active',
  )

  await user.click(screen.getByRole('button', { name: 'Settings' }))
  await screen.findByRole('dialog', { name: 'Settings' })
  await user.click(screen.getByRole('button', { name: 'Reset to defaults' }))

  // The background is inert/aria-hidden while the Settings dialog is open
  // (Base UI's modal behaviour), so close it before inspecting it.
  await user.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument(),
  )
  expect(screen.getByRole('button', { name: 'Filter tabs' })).toHaveAccessibleName('Filter tabs')
})

it('Settings Reset switches back to the Tabs view when reset from Workspaces', async () => {
  // Catches the AppShell-level 'reset-view' registration going missing.
  const user = userEvent.setup()
  renderApp()
  await screen.findByRole('button', { name: 'Tabs' })

  await user.click(screen.getByRole('button', { name: 'Workspaces' }))
  expect(screen.getByRole('button', { name: 'Workspaces' })).toHaveAttribute('aria-current', 'page')

  await user.click(screen.getByRole('button', { name: 'Settings' }))
  await screen.findByRole('dialog', { name: 'Settings' })
  await user.click(screen.getByRole('button', { name: 'Reset to defaults' }))

  await user.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument(),
  )
  expect(screen.getByRole('button', { name: 'Tabs' })).toHaveAttribute('aria-current', 'page')
})

function createPinnedTabGateway(): BrowserGateway {
  return createStubBrowserGateway({
    async getSnapshot() {
      return {
        tabs: [
          {
            id: 1,
            windowId: 1,
            index: 0,
            title: 'Pinned tab',
            url: 'https://example.com/pinned',
            domain: 'example.com',
            faviconUrl: null,
            pinned: true,
            muted: false,
            audible: false,
            active: false,
            discarded: false,
            groupId: null,
          },
        ],
        groups: [],
        currentWindowId: 1,
        capturedAt: 1,
      }
    },
  })
}

it('switches views with the show-tabs/show-workspaces keyboard shortcuts', async () => {
  // Catches view-switch shortcuts wired to stale state or not wired at all.
  renderApp()
  await screen.findByRole('button', { name: 'Tabs' })

  fireKeydown({ key: '2', ctrlKey: true })
  expect(screen.getByRole('button', { name: 'Workspaces' })).toHaveAttribute('aria-current', 'page')

  fireKeydown({ key: '1', ctrlKey: true })
  expect(screen.getByRole('button', { name: 'Tabs' })).toHaveAttribute('aria-current', 'page')
})

it('restores the last closed tabs with the undo-close keyboard shortcut', async () => {
  // Catches undo-close either not being wired at the popup level or requiring
  // a specific close toast to still be visible.
  const snapshot: CloseSnapshot = {
    closedAt: 1,
    tabs: [{ url: 'https://example.com', title: 'Example', pinned: false, windowId: 1, index: 0 }],
  }
  const load = vi.fn().mockResolvedValue(snapshot)
  const clear = vi.fn().mockResolvedValue(undefined)
  const closeRepository: CloseRepository = { load, save: vi.fn(), clear }
  const gateway = createStubBrowserGateway({
    windowExists: vi.fn().mockResolvedValue(true),
    createTab: vi.fn().mockResolvedValue(99),
  })
  renderApp({ gateway, closeRepository })
  await screen.findByRole('button', { name: 'Tabs' })

  fireKeydown({ key: 'z', ctrlKey: true })

  await waitFor(() => expect(load).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(clear).toHaveBeenCalledTimes(1))
})

function fireKeydown(overrides: {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
}) {
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: overrides.key,
        metaKey: overrides.metaKey ?? false,
        ctrlKey: overrides.ctrlKey ?? false,
        altKey: overrides.altKey ?? false,
        shiftKey: overrides.shiftKey ?? false,
        cancelable: true,
        bubbles: true,
      }),
    )
  })
}

function renderApp({
  theme = 'light',
  mediaQuery = createMediaQueryList(false),
  repository,
  gateway,
  closeRepository,
}: {
  theme?: 'light' | 'dark' | 'system'
  mediaQuery?: TestMediaQueryList
  repository?: ReturnType<typeof createSettingsRepository>
  gateway?: BrowserGateway
  closeRepository?: CloseRepository
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

  return render(
    <App
      repository={repository ?? createSettingsRepository(storage)}
      gateway={gateway ?? createPendingBrowserGateway()}
      closeRepository={closeRepository}
    />,
  )
}

function createPendingBrowserGateway(): BrowserGateway {
  return createStubBrowserGateway({
    getSnapshot() {
      return new Promise<TabSnapshot>(() => undefined)
    },
  })
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
