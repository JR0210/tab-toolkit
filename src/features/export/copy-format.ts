import type { TabRecord } from '../../domain/browser'
import type { CopyFormat } from '../../shared/settings/settings'
import { serializeCsv, serializeJson } from './export-format'

const UNTITLED_LABEL = 'Untitled tab'

export function formatTabsForClipboard(tabs: readonly TabRecord[], format: CopyFormat): string {
  switch (format) {
    case 'urls':
      return tabs.map((tab) => tab.url).join('\n')
    case 'title-url':
      return tabs.map((tab) => `${tabLabel(tab)}\n${tab.url}`).join('\n\n')
    case 'markdown':
      return tabs.map((tab) => formatMarkdownLink(tab)).join('\n')
    case 'html':
      return tabs.map((tab) => formatHtmlLink(tab)).join('\n')
    case 'csv':
      return serializeCsv(toTitleUrlRows(tabs), ['title', 'url'])
    case 'json':
      return serializeJson(toTitleUrlRows(tabs), ['title', 'url'])
  }
}

function toTitleUrlRows(tabs: readonly TabRecord[]) {
  return tabs.map((tab) => ({ title: tab.title, url: tab.url }))
}

function tabLabel(tab: TabRecord): string {
  return tab.title || UNTITLED_LABEL
}

function formatMarkdownLink(tab: TabRecord): string {
  const label = escapeMarkdownLabel(tabLabel(tab))
  const destination = markdownDestination(tab.url)

  return `[${label}](${destination})`
}

function escapeMarkdownLabel(label: string): string {
  return label.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]')
}

function markdownDestination(url: string): string {
  if (url === '') {
    return ''
  }

  return /[\s()]/.test(url) ? `<${url}>` : url
}

function formatHtmlLink(tab: TabRecord): string {
  const href = escapeHtmlAttribute(tab.url)
  const text = escapeHtmlText(tabLabel(tab))

  return `<a href="${href}">${text}</a>`
}

function escapeHtmlText(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function escapeHtmlAttribute(text: string): string {
  return escapeHtmlText(text).replaceAll('"', '&quot;')
}
