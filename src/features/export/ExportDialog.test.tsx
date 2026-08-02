import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TabGroupRecord, TabRecord } from '../../domain/browser'
import type { DownloadGateway, DownloadRequest } from '../../platform/download-gateway'
import { Toaster } from '../../shared/ui/toaster'
import { SettingsContext } from '../../shared/settings/settings-context'
import type { SettingsContextValue } from '../../shared/settings/settings-context'
import { ExportDialog } from './ExportDialog'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-02T12:00:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ExportDialog', () => {
  it('disables the export button when no fields remain selected', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderDialog({})

    for (const label of ['Title', 'URL', 'Domain', 'Window', 'Group', 'Position', 'Pinned']) {
      await user.click(screen.getByRole('checkbox', { name: label }))
    }

    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled()
  })

  it('exports a CSV with unchecked fields removed, in tab order, using CRLF rows', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const download = createDownload()
    renderDialog({ download })

    await user.click(screen.getByRole('checkbox', { name: 'Domain' }))
    await user.click(screen.getByRole('button', { name: 'Export' }))

    expect(download.download).toHaveBeenCalledExactlyOnceWith({
      filename: 'tab-toolkit-2026-08-02.csv',
      mimeType: 'text/csv;charset=utf-8',
      contents:
        'title,url,window,group,position,pinned\r\n' +
        'First,https://first.test,1,,1,false\r\n' +
        'Second,https://second.test,1,,2,false',
    })
  })

  it('exports JSON with the application/json mime type', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const download = createDownload()
    renderDialog({ download })

    await user.click(screen.getByRole('radio', { name: 'JSON' }))
    await user.click(screen.getByRole('button', { name: 'Export' }))

    const request = download.download.mock.calls[0]?.[0] as DownloadRequest
    expect(request.filename).toBe('tab-toolkit-2026-08-02.json')
    expect(request.mimeType).toBe('application/json;charset=utf-8')
    expect(JSON.parse(request.contents)).toEqual([
      {
        title: 'First',
        url: 'https://first.test',
        domain: 'first.test',
        window: 1,
        group: '',
        position: 1,
        pinned: false,
      },
      {
        title: 'Second',
        url: 'https://second.test',
        domain: 'second.test',
        window: 1,
        group: '',
        position: 2,
        pinned: false,
      },
    ])
  })

  it('closes the dialog after a successful export', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const download = createDownload()
    const onOpenChange = vi.fn()
    renderDialog({ download, onOpenChange })

    await user.click(screen.getByRole('button', { name: 'Export' }))

    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('keeps the dialog open and shows an error toast when the download gateway throws', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const download: DownloadGateway = {
      download: vi.fn(() => {
        throw new Error('disk full')
      }),
    }
    const onOpenChange = vi.fn()
    renderDialog({ download, onOpenChange })

    await user.click(screen.getByRole('button', { name: 'Export' }))

    expect(onOpenChange).not.toHaveBeenCalled()
    expect(await screen.findByText(/could not export/i)).toBeInTheDocument()
  })
})

function renderDialog({
  download = createDownload(),
  onOpenChange = vi.fn(),
  tabs = [
    createTab({ id: 1, index: 0, title: 'First', url: 'https://first.test', domain: 'first.test' }),
    createTab({
      id: 2,
      index: 1,
      title: 'Second',
      url: 'https://second.test',
      domain: 'second.test',
    }),
  ],
  groups = [],
}: {
  download?: DownloadGateway
  onOpenChange?: (open: boolean) => void
  tabs?: TabRecord[]
  groups?: TabGroupRecord[]
}) {
  return render(
    <SettingsContext value={createSettingsContext()}>
      <ExportDialog
        open
        onOpenChange={onOpenChange}
        tabs={tabs}
        groups={groups}
        download={download}
      />
      <Toaster />
    </SettingsContext>,
  )
}

function createDownload(): DownloadGateway & {
  download: ReturnType<typeof vi.fn<(request: DownloadRequest) => void>>
} {
  return { download: vi.fn() }
}

function createSettingsContext(): SettingsContextValue {
  return {
    settings: { theme: 'light', scope: 'current', copyFormat: 'markdown' },
    resolvedTheme: 'light',
    persistenceError: null,
    async updateSettings() {},
  }
}

function createTab(overrides: Partial<TabRecord> & Pick<TabRecord, 'id'>): TabRecord {
  return {
    windowId: 1,
    index: 0,
    title: 'Tab',
    url: 'https://example.test',
    domain: 'example.test',
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
