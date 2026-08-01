import { StrictMode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSettingsRepository } from './settings-repository'
import type { SettingsStorageArea } from './settings-repository'
import { SettingsProvider } from './settings-provider'
import { useSettings } from './use-settings'

describe('SettingsProvider theme behavior', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark')
    vi.unstubAllGlobals()
  })

  it('adds the dark class for a stored dark preference', async () => {
    // Catches a provider that loads settings but does not apply an explicit
    // dark preference to the document root.
    const storage = createStorage({
      settings: { theme: 'dark', scope: 'current', copyFormat: 'markdown' },
    })
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(createMediaQueryList(false)))

    render(
      <SettingsProvider repository={createSettingsRepository(storage)}>
        <SettingsProbe />
      </SettingsProvider>,
    )

    await screen.findByText('dark')
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'))
  })

  it('removes the dark class for a stored light preference', async () => {
    // Catches a provider that adds dark mode but leaves a stale dark class
    // after a user explicitly selects light mode.
    document.documentElement.classList.add('dark')
    const storage = createStorage({
      settings: { theme: 'light', scope: 'current', copyFormat: 'markdown' },
    })
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(createMediaQueryList(true)))

    render(
      <SettingsProvider repository={createSettingsRepository(storage)}>
        <SettingsProbe />
      </SettingsProvider>,
    )

    await screen.findByText('light')
    await waitFor(() => expect(document.documentElement).not.toHaveClass('dark'))
  })

  it('uses the current system color scheme for a stored system preference', async () => {
    // Catches a provider that treats system mode as light instead of applying
    // the current dark system preference.
    const storage = createStorage({
      settings: { theme: 'system', scope: 'current', copyFormat: 'markdown' },
    })
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(createMediaQueryList(true)))

    render(
      <SettingsProvider repository={createSettingsRepository(storage)}>
        <SettingsProbe />
      </SettingsProvider>,
    )

    await screen.findByText('system')
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'))
  })

  it('follows system color-scheme changes without overwriting the saved system preference', async () => {
    // Catches a provider that does not react to OS changes, or persists the
    // resolved dark/light value instead of retaining the user's system choice.
    const storage = createStorage({
      settings: { theme: 'system', scope: 'all', copyFormat: 'json' },
    })
    const repository = createSettingsRepository(storage)
    const mediaQuery = createMediaQueryList(false)
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mediaQuery))

    render(
      <SettingsProvider repository={repository}>
        <SettingsProbe />
      </SettingsProvider>,
    )

    await screen.findByText('system')
    expect(document.documentElement).not.toHaveClass('dark')

    mediaQuery.emitChange(true)
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'))
    expect(screen.getByText('system')).toBeVisible()
    await expect(repository.load()).resolves.toEqual({
      theme: 'system',
      scope: 'all',
      copyFormat: 'json',
    })

    mediaQuery.emitChange(false)
    await waitFor(() => expect(document.documentElement).not.toHaveClass('dark'))
  })

  it('persists an explicit settings change from the context hook', async () => {
    // Catches a provider that updates visible settings but fails to save the
    // complete new settings value to local storage.
    const storage = createStorage({
      settings: { theme: 'system', scope: 'current', copyFormat: 'markdown' },
    })
    const repository = createSettingsRepository(storage)
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(createMediaQueryList(false)))
    const user = userEvent.setup()

    render(
      <SettingsProvider repository={repository}>
        <SettingsControls />
      </SettingsProvider>,
    )

    await screen.findByText('system')
    await user.click(screen.getByRole('button', { name: 'Use dark theme' }))

    await screen.findByText('dark')
    await expect(repository.load()).resolves.toEqual({
      theme: 'dark',
      scope: 'current',
      copyFormat: 'markdown',
    })
  })

  it('stops following system color-scheme changes after choosing an explicit theme', async () => {
    // Catches a stale system listener that can override an explicit dark
    // setting after the OS color scheme changes.
    const storage = createStorage({
      settings: { theme: 'system', scope: 'current', copyFormat: 'markdown' },
    })
    const mediaQuery = createMediaQueryList(false)
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mediaQuery))
    const user = userEvent.setup()

    render(
      <SettingsProvider repository={createSettingsRepository(storage)}>
        <SettingsControls />
      </SettingsProvider>,
    )

    await screen.findByText('system')
    await user.click(screen.getByRole('button', { name: 'Use dark theme' }))
    await screen.findByText('dark')
    expect(document.documentElement).toHaveClass('dark')

    mediaQuery.emitChange(false)

    expect(document.documentElement).toHaveClass('dark')
  })

  it('loads persisted settings once in Strict Mode', async () => {
    // Catches a provider that performs duplicate local-storage reads when
    // React repeats effects in development Strict Mode.
    const storage = createStorage({
      settings: { theme: 'light', scope: 'all', copyFormat: 'html' },
    })
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(createMediaQueryList(false)))

    render(
      <StrictMode>
        <SettingsProvider repository={createSettingsRepository(storage)}>
          <SettingsProbe />
        </SettingsProvider>
      </StrictMode>,
    )

    await screen.findByText('light')
    expect(storage.getCalls()).toBe(1)
  })

  it('preserves rapid independent explicit updates in the latest persisted settings', async () => {
    // Catches closure-based updates that merge each patch into the same stale
    // render-time settings value, losing the first field in local storage.
    const storage = createStorage({
      settings: { theme: 'system', scope: 'current', copyFormat: 'markdown' },
    })
    const repository = createSettingsRepository(storage)
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(createMediaQueryList(false)))
    const user = userEvent.setup()

    render(
      <SettingsProvider repository={repository}>
        <SettingsRaceControls />
      </SettingsProvider>,
    )

    await screen.findByText('system/current/markdown')
    await user.click(screen.getByRole('button', { name: 'Apply rapid updates' }))

    await screen.findByText('system/all/json')
    await expect(repository.load()).resolves.toEqual({
      theme: 'system',
      scope: 'all',
      copyFormat: 'json',
    })
  })

  it('merges a pre-hydration patch with stored settings before persisting', async () => {
    // Catches a pending initial load whose untouched stored fields are replaced
    // by defaults when a user changes one setting before hydration completes.
    const storage = createDeferredStorage({
      settings: { theme: 'dark', scope: 'current', copyFormat: 'csv' },
    })
    const repository = createSettingsRepository(storage)
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(createMediaQueryList(false)))
    const user = userEvent.setup()

    render(
      <SettingsProvider repository={repository}>
        <SettingsLateLoadControls />
      </SettingsProvider>,
    )

    await screen.findByText('system/current/markdown')
    await user.click(screen.getByRole('button', { name: 'Set scope to all' }))
    await screen.findByText('system/all/markdown')

    await act(async () => {
      storage.resolveInitialLoad()
    })

    expect(await screen.findByText('dark/all/csv')).toBeVisible()
    await expect(repository.load()).resolves.toEqual({
      theme: 'dark',
      scope: 'all',
      copyFormat: 'csv',
    })
  })

  it('handles a rejected initial load while remaining usable with defaults', async () => {
    // Catches an unhandled storage-load rejection that leaves the provider
    // unstable instead of retaining defaults for an explicit user update.
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(createMediaQueryList(false)))
    const user = userEvent.setup()

    render(
      <SettingsProvider repository={createSettingsRepository(createRejectingStorage())}>
        <SettingsLateLoadControls />
      </SettingsProvider>,
    )

    await screen.findByText('system/current/markdown')
    await user.click(screen.getByRole('button', { name: 'Set scope to all' }))

    await screen.findByText('system/all/markdown')
  })
})

function SettingsProbe() {
  const { settings } = useSettings()
  return <output>{settings.theme}</output>
}

function SettingsControls() {
  const { settings, updateSettings } = useSettings()

  return (
    <>
      <output>{settings.theme}</output>
      <button type="button" onClick={() => void updateSettings({ theme: 'dark' })}>
        Use dark theme
      </button>
    </>
  )
}

function SettingsRaceControls() {
  const { settings, updateSettings } = useSettings()

  return (
    <>
      <output>{`${settings.theme}/${settings.scope}/${settings.copyFormat}`}</output>
      <button
        type="button"
        onClick={() => {
          void updateSettings({ scope: 'all' })
          void updateSettings({ copyFormat: 'json' })
        }}
      >
        Apply rapid updates
      </button>
    </>
  )
}

function SettingsLateLoadControls() {
  const { settings, updateSettings } = useSettings()

  return (
    <>
      <output>{`${settings.theme}/${settings.scope}/${settings.copyFormat}`}</output>
      <button type="button" onClick={() => void updateSettings({ scope: 'all' })}>
        Set scope to all
      </button>
    </>
  )
}

function createStorage(
  initial: Record<string, unknown>,
): SettingsStorageArea & { getCalls(): number } {
  const persisted = { ...initial }
  let getCalls = 0

  return {
    async get(
      _keys?: string | string[] | Record<string, unknown> | null,
    ): Promise<Record<string, unknown>> {
      getCalls += 1
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
    getCalls() {
      return getCalls
    },
  }
}

function createDeferredStorage(initial: Record<string, unknown>): SettingsStorageArea & {
  resolveInitialLoad(): void
} {
  const persisted: Record<string, unknown> = { ...initial }
  let isInitialLoad = true
  let resolveLoad: (value: Record<string, unknown>) => void
  const initialLoad = new Promise<Record<string, unknown>>((resolve) => {
    resolveLoad = resolve
  })

  return {
    get(): Promise<Record<string, unknown>> {
      if (isInitialLoad) {
        isInitialLoad = false
        return initialLoad
      }

      return Promise.resolve(persisted)
    },
    async set(items: Record<string, unknown>): Promise<void> {
      Object.assign(persisted, items)
    },
    async remove(keys: string | string[]): Promise<void> {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete persisted[key]
      }
    },
    resolveInitialLoad() {
      resolveLoad(initial)
    },
  }
}

function createRejectingStorage(): SettingsStorageArea {
  const persisted: Record<string, unknown> = {}

  return {
    async get(): Promise<Record<string, unknown>> {
      throw new Error('local storage is unavailable')
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

interface TestMediaQueryList extends MediaQueryList {
  emitChange(matches: boolean): void
}

function createMediaQueryList(initialMatches: boolean): TestMediaQueryList {
  let matches = initialMatches
  const changeListeners = new Set<(event: MediaQueryListEvent) => void>()
  const mediaQuery = {
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
    dispatchEvent() {
      return true
    },
    emitChange(nextMatches: boolean) {
      matches = nextMatches
      const event = { matches, media: this.media } as MediaQueryListEvent

      for (const listener of changeListeners) {
        listener(event)
      }
    },
  } satisfies TestMediaQueryList

  return mediaQuery
}
