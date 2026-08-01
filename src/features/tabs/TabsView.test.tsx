import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import type { BrowserGateway } from '../../chrome/browser-gateway'
import type { TabGroupRecord, TabRecord, TabSnapshot } from '../../domain/browser'
import { createSettingsRepository } from '../../shared/settings/settings-repository'
import type { SettingsStorageArea } from '../../shared/settings/settings-repository'

afterEach(() => {
  document.documentElement.classList.remove('dark')
  vi.unstubAllGlobals()
})

describe('TabsView', () => {
  it('renders the ordered live inventory and activates the exact browser tab', async () => {
    // Catches stale mock data, string-based window ordering, lost Chrome tab
    // order, missing state metadata, and activation with the wrong identifiers.
    const snapshot = createInventorySnapshot()
    const activateTab = vi.fn<BrowserGateway['activateTab']>().mockResolvedValue(undefined)
    const gateway = createGateway({ snapshots: [snapshot, snapshot], activateTab })
    const user = userEvent.setup()

    renderApp(gateway)

    expect(await screen.findByText('4 tabs · 2 windows')).toBeVisible()

    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Window 2 · 2 tabs',
      'Window 12 · 2 tabs',
    ])

    const firstWindow = headings[0].closest('section')
    const secondWindow = headings[1].closest('section')
    expect(firstWindow).not.toBeNull()
    expect(secondWindow).not.toBeNull()
    expect(
      within(firstWindow!)
        .getAllByRole('heading', { level: 3 })
        .map((row) => row.textContent),
    ).toEqual(['Pinned research', 'Muted issue'])
    expect(
      within(secondWindow!)
        .getAllByRole('heading', { level: 3 })
        .map((row) => row.textContent),
    ).toEqual(['Study music', 'Design notes'])

    expect(screen.getByLabelText('Pinned')).toBeVisible()
    expect(screen.getByLabelText('Muted')).toBeVisible()
    expect(screen.getByLabelText('Playing audio')).toBeVisible()
    expect(screen.getByLabelText('Active tab')).toBeVisible()
    expect(screen.getByText('Research')).toBeVisible()
    expect(screen.getByText('Issues')).toBeVisible()
    expect(screen.getByText('Design')).toBeVisible()
    expect(screen.getByText('current')).toBeVisible()

    const pinnedRow = document.querySelector('[data-tab-id="7"]')
    const musicRow = document.querySelector('[data-tab-id="42"]')
    expect(pinnedRow).not.toBeNull()
    expect(musicRow).not.toBeNull()

    const chromeFavicon = pinnedRow!.querySelector('img')
    expect(chromeFavicon).not.toBeNull()
    expect(chromeFavicon).toHaveAttribute('src', 'chrome-extension://fixture/pinned.png')
    expect(document.querySelector('[data-tab-id="54"]')).toHaveTextContent('F')

    const brokenRow = document.querySelector('[data-tab-id="9"]')
    const brokenFavicon = brokenRow!.querySelector('img')
    expect(brokenFavicon).not.toBeNull()
    expect(document.querySelectorAll('img')).toHaveLength(2)
    fireEvent.error(brokenFavicon!)
    expect(brokenRow).toHaveTextContent('G')
    expect(document.querySelectorAll('img')).toHaveLength(1)
    expect(document.querySelector('img')).toHaveAttribute(
      'src',
      'chrome-extension://fixture/pinned.png',
    )
    expect(screen.queryAllByLabelText(/favicon$/)).toHaveLength(0)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Activate Study music (tab 42, window 12)' }),
    )

    expect(activateTab).toHaveBeenCalledExactlyOnceWith(42, 12)
  })

  it('uniquely names activation controls when tabs share a title', async () => {
    // Catches title-only accessible names that leave duplicate tabs
    // indistinguishable to assistive technology.
    const snapshot = createDuplicateTitleSnapshot()
    const activateTab = vi.fn<BrowserGateway['activateTab']>().mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderApp(createGateway({ snapshots: [snapshot, snapshot], activateTab }))

    const firstInbox = await screen.findByRole('button', {
      name: 'Activate Inbox (tab 100, window 2)',
    })
    const secondInbox = screen.getByRole('button', {
      name: 'Activate Inbox (tab 200, window 12)',
    })

    expect(firstInbox).toBeVisible()
    expect(secondInbox).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Activate Inbox' })).not.toBeInTheDocument()
    expect(screen.queryAllByLabelText(/favicon$/)).toHaveLength(0)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    await user.click(secondInbox)

    expect(activateTab).toHaveBeenCalledExactlyOnceWith(200, 12)
  })

  it('derives a fallback initial from valid non-HTTP tab URLs', async () => {
    // Catches file:, about:, and similar tabs collapsing to an unhelpful
    // question mark merely because they have no HTTP hostname.
    const snapshot: TabSnapshot = {
      tabs: [
        createTab({
          id: 300,
          windowId: 2,
          title: 'Local notes',
          url: 'file:///C:/notes.html',
          domain: '',
        }),
      ],
      groups: [],
      currentWindowId: 2,
      capturedAt: 3,
    }

    renderApp(createGateway({ snapshots: [snapshot] }))

    await screen.findByText('1 tab · 1 window')
    const row = document.querySelector('[data-tab-id="300"]')
    expect(row).not.toBeNull()
    expect(row!.firstElementChild).toHaveTextContent('F')
  })

  it('announces loading while the live snapshot is pending', () => {
    // Catches an empty-looking popup while Chrome is still returning windows.
    const pendingSnapshot = createDeferred<TabSnapshot>()

    renderApp(createGateway({ snapshots: [pendingSnapshot.promise] }))

    expect(screen.getByRole('status')).toHaveTextContent('Loading tabs…')
  })

  it('shows the original failure and retries the live snapshot request', async () => {
    // Catches swallowed Chrome failures and Retry controls that never reach
    // the provider's refresh operation.
    const gateway = createGateway({
      snapshots: [new Error('Chrome denied tab access'), createInventorySnapshot()],
    })
    const user = userEvent.setup()

    renderApp(gateway)

    expect(await screen.findByRole('alert')).toHaveTextContent('Chrome denied tab access')

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('4 tabs · 2 windows')).toBeVisible()
  })

  it('distinguishes a loaded browser with no open normal-window tabs', async () => {
    // Catches an empty result being presented as an indefinite load or error.
    renderApp(
      createGateway({
        snapshots: [{ tabs: [], groups: [], currentWindowId: null, capturedAt: 1 }],
      }),
    )

    expect(await screen.findByText('No open tabs')).toBeVisible()
    expect(screen.getByText('Open a normal Chrome window to see its tabs here.')).toBeVisible()
  })
})

function renderApp(gateway: BrowserGateway) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(createMediaQueryList()))

  return render(
    <App repository={createSettingsRepository(createSettingsStorage())} gateway={gateway} />,
  )
}

function createGateway({
  snapshots,
  activateTab = vi.fn<BrowserGateway['activateTab']>().mockResolvedValue(undefined),
}: {
  snapshots: Array<TabSnapshot | Error | Promise<TabSnapshot>>
  activateTab?: BrowserGateway['activateTab']
}): BrowserGateway {
  let snapshotIndex = 0

  return {
    getSnapshot() {
      const snapshot = snapshots[snapshotIndex]
      snapshotIndex += 1

      if (!snapshot) {
        return Promise.reject(new Error('Unexpected snapshot request'))
      }

      if (snapshot instanceof Error) {
        return Promise.reject(snapshot)
      }

      return Promise.resolve(snapshot)
    },
    activateTab,
  }
}

function createInventorySnapshot(): TabSnapshot {
  const groups: TabGroupRecord[] = [
    { id: 23, windowId: 2, title: 'Issues', color: 'red' },
    { id: 31, windowId: 12, title: 'Design', color: 'purple' },
    { id: 19, windowId: 2, title: 'Research', color: 'yellow' },
  ]
  const tabs: TabRecord[] = [
    createTab({
      id: 54,
      windowId: 12,
      index: 4,
      title: 'Design notes',
      url: 'https://figma.com/design',
      domain: 'figma.com',
      groupId: 31,
    }),
    createTab({
      id: 9,
      windowId: 2,
      index: 5,
      title: 'Muted issue',
      url: 'https://github.com/example/issues/1',
      domain: 'github.com',
      faviconUrl: 'chrome-extension://fixture/broken.png',
      muted: true,
      groupId: 23,
    }),
    createTab({
      id: 42,
      windowId: 12,
      index: 1,
      title: 'Study music',
      url: 'https://music.example/study',
      domain: 'music.example',
      audible: true,
      active: true,
    }),
    createTab({
      id: 7,
      windowId: 2,
      index: 0,
      title: 'Pinned research',
      url: 'https://developer.chrome.com/docs/extensions',
      domain: 'developer.chrome.com',
      faviconUrl: 'chrome-extension://fixture/pinned.png',
      pinned: true,
      groupId: 19,
    }),
  ]

  return { tabs, groups, currentWindowId: 2, capturedAt: 1 }
}

function createDuplicateTitleSnapshot(): TabSnapshot {
  return {
    tabs: [
      createTab({
        id: 200,
        windowId: 12,
        title: 'Inbox',
        domain: 'mail.example',
      }),
      createTab({
        id: 100,
        windowId: 2,
        title: 'Inbox',
        domain: 'mail.example',
        faviconUrl: 'chrome-extension://fixture/mail.png',
      }),
    ],
    groups: [],
    currentWindowId: 2,
    capturedAt: 2,
  }
}

function createTab({
  id,
  windowId,
  ...overrides
}: Partial<TabRecord> & Pick<TabRecord, 'id' | 'windowId'>): TabRecord {
  return {
    id,
    windowId,
    index: 0,
    title: 'Untitled tab',
    url: '',
    domain: '',
    faviconUrl: null,
    pinned: false,
    muted: false,
    audible: false,
    active: false,
    discarded: false,
    groupId: null,
    ...overrides,
  }
}

function createSettingsStorage(): SettingsStorageArea {
  return {
    async get() {
      return {
        settings: {
          theme: 'light',
          scope: 'current',
          copyFormat: 'markdown',
        },
      }
    },
    async set() {},
    async remove() {},
  }
}

function createMediaQueryList(): MediaQueryList {
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

function createDeferred<Value>() {
  let resolve: (value: Value) => void = () => {
    throw new Error('Deferred promise is not initialized')
  }
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}
