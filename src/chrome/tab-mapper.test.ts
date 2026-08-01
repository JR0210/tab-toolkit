import { describe, expect, it } from 'vitest'
import {
  createChromeBrowserApiMock,
  createChromeTab,
  createChromeTabGroup,
  createChromeWindow,
} from '../test/chrome-mocks'
import { createChromeBrowserGateway } from './browser-gateway'
import { mapChromeTab } from './tab-mapper'

describe('mapChromeTab', () => {
  it('uses safe defaults for unavailable tab metadata', () => {
    // Catches missing permission-protected tab fields leaking undefined into
    // the domain model instead of remaining usable by the extension UI.
    expect(mapChromeTab({ id: 4, windowId: 2, index: 0 })).toMatchObject({
      id: 4,
      title: 'Untitled tab',
      url: '',
      domain: '',
      faviconUrl: null,
      groupId: null,
    })
  })

  it('normalizes Chrome favIconUrl values to the domain favicon field', () => {
    // Catches a Chrome-bound property name or loading-time empty value leaking
    // into the domain record, where consumers expect a usable URL or null.
    expect(
      mapChromeTab({
        id: 7,
        windowId: 2,
        index: 2,
        favIconUrl: 'https://example.com/favicon.ico',
      }).faviconUrl,
    ).toBe('https://example.com/favicon.ico')
    expect(mapChromeTab({ id: 8, windowId: 2, index: 3, favIconUrl: '' }).faviconUrl).toBeNull()
  })

  it('keeps a Chrome internal page identifiable when deriving its domain', () => {
    // Catches URL parsing that turns non-web Chrome pages into an empty or
    // misleading hostname, making settings tabs indistinguishable in the UI.
    expect(
      mapChromeTab({
        id: 5,
        windowId: 2,
        index: 1,
        url: 'chrome://settings/',
      }),
    ).toMatchObject({ domain: 'chrome://settings' })
  })
})

describe('Chrome browser gateway', () => {
  it('reads normal-window tabs and maps the current snapshot safely', async () => {
    // Catches a live snapshot that includes popup windows, malformed tabs, or
    // raw Chrome values the domain model cannot safely render.
    const chrome = createChromeBrowserApiMock()
    chrome.getAll.mockResolvedValue([
      createChromeWindow({
        id: 2,
        tabs: [
          createChromeTab({
            id: 4,
            windowId: 2,
            index: 0,
            title: 'Tab Toolkit',
            url: 'https://example.com/path',
            favIconUrl: 'https://example.com/icon.png',
            mutedInfo: { muted: true },
            audible: true,
            active: true,
            discarded: true,
            groupId: 8,
          }),
          createChromeTab({ id: undefined, windowId: 2 }),
          createChromeTab({ id: 6, windowId: undefined }),
        ],
      }),
    ])
    chrome.getCurrent.mockResolvedValue(createChromeWindow({ id: 2 }))
    chrome.queryTabGroups.mockResolvedValue([
      createChromeTabGroup({ id: 8, windowId: 2, title: undefined, color: 'orange' }),
    ])

    const snapshot = await createChromeBrowserGateway(chrome.api).getSnapshot()

    expect(snapshot.tabs).toEqual([
      {
        id: 4,
        windowId: 2,
        index: 0,
        title: 'Tab Toolkit',
        url: 'https://example.com/path',
        domain: 'example.com',
        faviconUrl: 'https://example.com/icon.png',
        pinned: false,
        muted: true,
        audible: true,
        active: true,
        discarded: true,
        groupId: 8,
      },
    ])
    expect(snapshot.groups).toEqual([{ id: 8, windowId: 2, title: '', color: 'orange' }])
    expect(snapshot.currentWindowId).toBe(2)
    expect(snapshot.capturedAt).toEqual(expect.any(Number))
    expect(chrome.getAll).toHaveBeenCalledWith({ populate: true, windowTypes: ['normal'] })
  })

  it('activates a tab before focusing its window', async () => {
    // Catches focus occurring before tab activation, which can surface the
    // wrong tab when the target window is restored.
    const chrome = createChromeBrowserApiMock()
    const callOrder: string[] = []
    let resolveTabUpdate: (() => void) | undefined
    const tabUpdate = new Promise<void>((resolve) => {
      resolveTabUpdate = resolve
    })
    chrome.updateTab.mockImplementationOnce(async () => {
      callOrder.push('tab update started')
      await tabUpdate
      callOrder.push('tab update finished')
      return createChromeTab({ id: 12, windowId: 3, active: true })
    })
    chrome.updateWindow.mockImplementationOnce(async () => {
      callOrder.push('window focus')
      return createChromeWindow({ id: 3 })
    })

    const activation = createChromeBrowserGateway(chrome.api).activateTab(12, 3)
    void activation.catch(() => {})

    await Promise.resolve()
    expect(callOrder).toEqual(['tab update started'])
    resolveTabUpdate?.()
    await activation

    expect(callOrder).toEqual(['tab update started', 'tab update finished', 'window focus'])
    expect(chrome.updateTab).toHaveBeenCalledWith(12, { active: true })
    expect(chrome.updateWindow).toHaveBeenCalledWith(3, { focused: true })
  })

  it('preserves Chrome activation errors', async () => {
    // Catches wrapping a disappearing-tab error, which would remove the
    // actionable Chrome message the UI needs to display.
    const chrome = createChromeBrowserApiMock()
    const chromeError = new Error('No tab with id: 12.')
    chrome.updateTab.mockRejectedValueOnce(chromeError)

    await expect(createChromeBrowserGateway(chrome.api).activateTab(12, 3)).rejects.toBe(
      chromeError,
    )
    expect(chrome.updateWindow).not.toHaveBeenCalled()
  })
})
