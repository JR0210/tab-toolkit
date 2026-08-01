import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { BrowserProvider } from '../../chrome/browser-context'
import type { BrowserGateway } from '../../chrome/browser-gateway'
import type { TabSnapshot } from '../../domain/browser'
import { TabsProvider } from './tabs-provider'
import { useTabs } from './use-tabs'

describe('TabsProvider', () => {
  it('replaces the loaded snapshot when manually refreshed and after activating a tab', async () => {
    // Catches a provider that only loads once, or ignores the post-activation
    // refresh needed to reflect the browser's current state.
    const gateway = createGateway({
      snapshots: [createSnapshot(100), createSnapshot(200), createSnapshot(300)],
    })
    const user = userEvent.setup()

    renderTabs(gateway)

    expect(await screen.findByText('100')).toBeVisible()
    expect(screen.getByTestId('status')).toHaveTextContent('ready')

    await user.click(screen.getByRole('button', { name: 'Refresh tabs' }))

    expect(await screen.findByText('200')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Activate tab' }))

    expect(await screen.findByText('300')).toBeVisible()
    expect(screen.getByTestId('error')).toHaveTextContent('none')
  })

  it('keeps the visible snapshot and exposes the original activation failure', async () => {
    // Catches activation error handling that clears useful data or replaces
    // the gateway's failure with a generic error.
    const activationFailure = new Error('The tab no longer exists')
    const gateway = createGateway({
      snapshots: [createSnapshot(100)],
      activationFailure,
    })
    const user = userEvent.setup()

    renderTabs(gateway)

    expect(await screen.findByText('100')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Activate tab' }))

    expect(screen.getByText('100')).toBeVisible()
    expect(screen.getByTestId('status')).toHaveTextContent('error')
    expect(screen.getByTestId('error')).toHaveTextContent('The tab no longer exists')
    expect(readError()).toBe(activationFailure)
  })

  it('retains a newer refresh snapshot when an earlier request resolves afterwards', async () => {
    // Catches a slower first load overwriting a newer refresh with stale tab data.
    const first = createDeferred<TabSnapshot>()
    const gateway = createGateway({
      snapshots: [first.promise, createSnapshot(200)],
    })
    const user = userEvent.setup()

    renderTabs(gateway)

    await user.click(screen.getByRole('button', { name: 'Refresh tabs' }))

    expect(await screen.findByText('200')).toBeVisible()

    await act(async () => {
      first.resolve(createSnapshot(100))
    })

    await waitFor(() => expect(screen.getByTestId('snapshot')).toHaveTextContent('200'))
  })

  it('keeps an activation failure visible when an earlier refresh resolves afterwards', async () => {
    // Catches a pending refresh overwriting the error state from a later
    // failed activation and replacing the stable snapshot.
    const pendingRefresh = createDeferred<TabSnapshot>()
    const activationFailure = new Error('The tab no longer exists')
    const gateway = createGateway({
      snapshots: [createSnapshot(100), pendingRefresh.promise],
      activationFailure,
    })
    const user = userEvent.setup()

    renderTabs(gateway)

    expect(await screen.findByText('100')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Refresh tabs' }))
    await user.click(screen.getByRole('button', { name: 'Activate tab' }))

    await act(async () => {
      pendingRefresh.resolve(createSnapshot(200))
    })

    expect(screen.getByTestId('snapshot')).toHaveTextContent('100')
    expect(screen.getByTestId('status')).toHaveTextContent('error')
    expect(readError()).toBe(activationFailure)
  })

  it('keeps a newer manual refresh ready when an earlier activation fails afterwards', async () => {
    // Catches a delayed activation failure publishing over a refresh that
    // started later and already has the browser's newest snapshot.
    const firstActivation = createDeferred<void>()
    const activationFailure = new Error('The tab no longer exists')
    const gateway = createGateway({
      snapshots: [createSnapshot(100), createSnapshot(200)],
      activations: [firstActivation.promise],
    })
    const user = userEvent.setup()

    renderTabs(gateway)

    expect(await screen.findByText('100')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Activate tab' }))
    await user.click(screen.getByRole('button', { name: 'Refresh tabs' }))
    expect(await screen.findByText('200')).toBeVisible()

    await act(async () => {
      firstActivation.reject(activationFailure)
    })

    expect(screen.getByTestId('snapshot')).toHaveTextContent('200')
    expect(screen.getByTestId('status')).toHaveTextContent('ready')
    expect(readError()).toBeNull()
  })

  it('keeps a later successful activation ready when an earlier activation fails afterwards', async () => {
    // Catches the first of two overlapping activations overwriting the
    // completed later operation when its gateway call eventually rejects.
    const firstActivation = createDeferred<void>()
    const activationFailure = new Error('The first tab no longer exists')
    const gateway = createGateway({
      snapshots: [createSnapshot(100), createSnapshot(200)],
      activations: [firstActivation.promise, undefined],
    })
    const user = userEvent.setup()

    renderTabs(gateway)

    expect(await screen.findByText('100')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Activate tab' }))
    await user.click(screen.getByRole('button', { name: 'Activate tab' }))
    expect(await screen.findByText('200')).toBeVisible()

    await act(async () => {
      firstActivation.reject(activationFailure)
    })

    expect(screen.getByTestId('snapshot')).toHaveTextContent('200')
    expect(screen.getByTestId('status')).toHaveTextContent('ready')
    expect(readError()).toBeNull()
  })
})

let latestError: unknown = null

function renderTabs(gateway: BrowserGateway) {
  latestError = null

  return render(
    <BrowserProvider gateway={gateway}>
      <TabsProvider>
        <TabsControls />
      </TabsProvider>
    </BrowserProvider>,
  )
}

function TabsControls() {
  const { activateTab, error, refresh, snapshot, status } = useTabs()
  latestError = error

  return (
    <>
      <output data-testid="status">{status}</output>
      <output data-testid="snapshot">{snapshot?.capturedAt ?? 'empty'}</output>
      <output data-testid="error">{error instanceof Error ? error.message : 'none'}</output>
      <button type="button" onClick={() => void refresh()}>
        Refresh tabs
      </button>
      <button type="button" onClick={() => void activateTab(7, 9)}>
        Activate tab
      </button>
    </>
  )
}

function readError(): unknown {
  return latestError
}

function createGateway({
  snapshots,
  activations,
  activationFailure,
}: {
  snapshots: Array<TabSnapshot | Promise<TabSnapshot>>
  activations?: Array<void | Promise<void>>
  activationFailure?: Error
}): BrowserGateway {
  let snapshotIndex = 0
  let activationIndex = 0

  return {
    getSnapshot(): Promise<TabSnapshot> {
      const snapshot = snapshots[snapshotIndex]
      snapshotIndex += 1

      if (!snapshot) {
        throw new Error('Unexpected snapshot request')
      }

      return Promise.resolve(snapshot)
    },
    activateTab(): Promise<void> {
      if (activations) {
        const activation = activations[activationIndex]
        activationIndex += 1

        if (activation === undefined && activationIndex > activations.length) {
          throw new Error('Unexpected activation request')
        }

        return Promise.resolve(activation)
      }

      if (activationFailure) {
        return Promise.reject(activationFailure)
      }

      return Promise.resolve()
    },
  }
}

function createSnapshot(capturedAt: number): TabSnapshot {
  return {
    tabs: [
      {
        id: 7,
        windowId: 9,
        index: 0,
        title: `Tab ${capturedAt}`,
        url: 'https://example.com',
        domain: 'example.com',
        faviconUrl: null,
        pinned: false,
        muted: false,
        audible: false,
        active: true,
        discarded: false,
        groupId: null,
      },
    ],
    groups: [],
    currentWindowId: 9,
    capturedAt,
  }
}

function createDeferred<Value>() {
  let resolve: (value: Value) => void = () => {
    throw new Error('Deferred promise is not initialized')
  }
  let reject: (reason?: unknown) => void = () => {
    throw new Error('Deferred promise is not initialized')
  }
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}
