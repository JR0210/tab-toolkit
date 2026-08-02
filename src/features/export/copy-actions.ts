import type { TabRecord } from '../../domain/browser'
import type { ClipboardGateway } from '../../platform/clipboard-gateway'
import type { CopyFormat } from '../../shared/settings/settings'
import { formatTabsForClipboard } from './copy-format'

export const COPY_FORMAT_LABELS: Record<CopyFormat, string> = {
  urls: 'URLs only',
  'title-url': 'Title and URL',
  markdown: 'Markdown',
  html: 'HTML',
  csv: 'CSV',
  json: 'JSON',
}

export const COPY_FORMATS = Object.keys(COPY_FORMAT_LABELS) as CopyFormat[]

/**
 * Copies an explicit, ordered list of tabs. Takes tabs as a parameter rather
 * than reading selection state so future row-level copy actions cannot
 * accidentally copy the whole selection instead of a single row.
 */
export async function copyTabsToClipboard(
  tabs: readonly TabRecord[],
  format: CopyFormat,
  clipboard: ClipboardGateway,
): Promise<void> {
  return clipboard.writeText(formatTabsForClipboard(tabs, format))
}
