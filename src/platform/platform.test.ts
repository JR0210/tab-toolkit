import { describe, expect, it, vi } from 'vitest'
import { createChromeBrowserGateway } from '../chrome/browser-gateway'
import { createChromeBrowserApiMock } from '../test/chrome-mocks'
import { destructiveKeyLabel, getPlatformFamily, modifierLabel, toPlatformFamily } from './platform'

describe('toPlatformFamily', () => {
  it('maps mac to the mac family', () => {
    expect(toPlatformFamily({ os: 'mac', arch: 'arm' })).toBe('mac')
  })

  it('maps win to the non-mac family', () => {
    expect(toPlatformFamily({ os: 'win', arch: 'x86-64' })).toBe('non-mac')
  })

  it('maps cros to the non-mac family', () => {
    expect(toPlatformFamily({ os: 'cros', arch: 'x86-64' })).toBe('non-mac')
  })

  it('maps linux to the non-mac family', () => {
    expect(toPlatformFamily({ os: 'linux', arch: 'x86-64' })).toBe('non-mac')
  })

  it('falls back to non-mac for an unrecognised os string', () => {
    expect(toPlatformFamily({ os: 'openbsd', arch: 'x86-64' })).toBe('non-mac')
  })
})

describe('modifierLabel', () => {
  it('shows the command glyph on mac', () => {
    expect(modifierLabel('mac')).toBe('⌘')
  })

  it('shows Ctrl on non-mac', () => {
    expect(modifierLabel('non-mac')).toBe('Ctrl')
  })
})

describe('destructiveKeyLabel', () => {
  it('shows the backspace glyph on mac', () => {
    expect(destructiveKeyLabel('mac')).toBe('⌫')
  })

  it('shows Delete on non-mac', () => {
    expect(destructiveKeyLabel('non-mac')).toBe('Delete')
  })
})

describe('BrowserGateway getPlatformInfo', () => {
  it('resolves the mapped family from chrome.runtime.getPlatformInfo', async () => {
    const { api, getPlatformInfo } = createChromeBrowserApiMock()
    getPlatformInfo.mockResolvedValue({ os: 'mac', arch: 'arm', nacl_arch: 'arm' })
    const gateway = createChromeBrowserGateway(api)

    await expect(gateway.getPlatformInfo()).resolves.toBe('mac')
  })

  it('resolves non-mac for a Windows platform', async () => {
    const { api, getPlatformInfo } = createChromeBrowserApiMock()
    getPlatformInfo.mockResolvedValue({ os: 'win', arch: 'x86-64', nacl_arch: 'x86-64' })
    const gateway = createChromeBrowserGateway(api)

    await expect(gateway.getPlatformInfo()).resolves.toBe('non-mac')
  })

  it('falls back to non-mac when chrome.runtime.getPlatformInfo rejects', async () => {
    const { api, getPlatformInfo } = createChromeBrowserApiMock()
    getPlatformInfo.mockRejectedValue(new Error('unavailable'))
    const gateway = createChromeBrowserGateway(api)

    await expect(gateway.getPlatformInfo()).resolves.toBe('non-mac')
  })
})

describe('getPlatformFamily', () => {
  it('memoizes the resolved family per gateway instance', async () => {
    const getPlatformInfo = vi.fn().mockResolvedValue('mac' as const)
    const gateway = { getPlatformInfo }

    await getPlatformFamily(gateway)
    await getPlatformFamily(gateway)

    expect(getPlatformInfo).toHaveBeenCalledTimes(1)
  })

  it('resolves independently for a different gateway instance', async () => {
    const gatewayA = { getPlatformInfo: vi.fn().mockResolvedValue('mac' as const) }
    const gatewayB = { getPlatformInfo: vi.fn().mockResolvedValue('non-mac' as const) }

    await expect(getPlatformFamily(gatewayA)).resolves.toBe('mac')
    await expect(getPlatformFamily(gatewayB)).resolves.toBe('non-mac')
  })
})
