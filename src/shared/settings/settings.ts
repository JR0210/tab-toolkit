export type Theme = 'light' | 'dark' | 'system'
export type Scope = 'current' | 'all'
export type CopyFormat = 'urls' | 'title-url' | 'markdown' | 'html' | 'csv' | 'json'

export interface Settings {
  theme: Theme
  scope: Scope
  copyFormat: CopyFormat
}

export const defaultSettings: Settings = {
  theme: 'system',
  scope: 'current',
  copyFormat: 'markdown',
}

const themes = new Set<Theme>(['light', 'dark', 'system'])
const scopes = new Set<Scope>(['current', 'all'])
const copyFormats = new Set<CopyFormat>(['urls', 'title-url', 'markdown', 'html', 'csv', 'json'])

export function normalizeSettings(value: unknown): Settings {
  const stored = isRecord(value) ? value : {}

  return {
    theme: isTheme(stored.theme) ? stored.theme : defaultSettings.theme,
    scope: isScope(stored.scope) ? stored.scope : defaultSettings.scope,
    copyFormat: isCopyFormat(stored.copyFormat) ? stored.copyFormat : defaultSettings.copyFormat,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && themes.has(value as Theme)
}

function isScope(value: unknown): value is Scope {
  return typeof value === 'string' && scopes.has(value as Scope)
}

function isCopyFormat(value: unknown): value is CopyFormat {
  return typeof value === 'string' && copyFormats.has(value as CopyFormat)
}
