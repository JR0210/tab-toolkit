import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDownloadGateway } from './download-gateway'

describe('createDownloadGateway', () => {
  let createObjectURL: ReturnType<typeof vi.fn<(obj: Blob | MediaSource) => string>>
  let revokeObjectURL: ReturnType<typeof vi.fn<(url: string) => void>>

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:mock-url')
    revokeObjectURL = vi.fn()
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(URL, 'createObjectURL')
    Reflect.deleteProperty(URL, 'revokeObjectURL')
  })

  it('creates exactly one blob with the given contents and mime type', () => {
    const gateway = createDownloadGateway()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const blobSpy = vi.spyOn(globalThis, 'Blob')

    gateway.download({
      filename: 'tab-toolkit-2026-08-02.csv',
      mimeType: 'text/csv;charset=utf-8',
      contents: 'title,url\r\nA,https://a.test',
    })

    expect(blobSpy).toHaveBeenCalledTimes(1)
    expect(blobSpy).toHaveBeenCalledWith(['title,url\r\nA,https://a.test'], {
      type: 'text/csv;charset=utf-8',
    })
  })

  it('clicks a temporary anchor carrying the requested filename', () => {
    const gateway = createDownloadGateway()
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const appendSpy = vi.spyOn(document.body, 'appendChild')

    gateway.download({
      filename: 'tab-toolkit-2026-08-02.json',
      mimeType: 'application/json;charset=utf-8',
      contents: '[]',
    })

    expect(clickSpy).toHaveBeenCalledTimes(1)
    const anchor = appendSpy.mock.results[0]?.value as HTMLAnchorElement
    expect(anchor.download).toBe('tab-toolkit-2026-08-02.json')
    expect(anchor.href).toBe('blob:mock-url')
  })

  it('removes the anchor from the DOM after clicking', () => {
    const gateway = createDownloadGateway()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const appendSpy = vi.spyOn(document.body, 'appendChild')

    gateway.download({
      filename: 'tab-toolkit-2026-08-02.csv',
      mimeType: 'text/csv;charset=utf-8',
      contents: 'a',
    })

    const anchor = appendSpy.mock.results[0]?.value as HTMLAnchorElement
    expect(anchor.isConnected).toBe(false)
  })

  it('revokes the object URL after the download completes', () => {
    const gateway = createDownloadGateway()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    gateway.download({
      filename: 'tab-toolkit-2026-08-02.csv',
      mimeType: 'text/csv;charset=utf-8',
      contents: 'a',
    })

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('removes the anchor and revokes the object URL even if the click throws', () => {
    const gateway = createDownloadGateway()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('boom')
    })
    const appendSpy = vi.spyOn(document.body, 'appendChild')

    expect(() =>
      gateway.download({
        filename: 'tab-toolkit-2026-08-02.csv',
        mimeType: 'text/csv;charset=utf-8',
        contents: 'a',
      }),
    ).toThrow('boom')

    const anchor = appendSpy.mock.results[0]?.value as HTMLAnchorElement
    expect(anchor.isConnected).toBe(false)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})
