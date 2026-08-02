import type { TabGroupRecord, TabRecord } from '../../domain/browser'
import { tabLabel } from './tab-label'

export type ExportField = 'title' | 'url' | 'domain' | 'window' | 'group' | 'position' | 'pinned'

export interface ExportRow {
  title: string
  url: string
  domain: string
  window: number
  group: string
  position: number
  pinned: boolean
}

export const EXPORT_FIELDS: readonly ExportField[] = [
  'title',
  'url',
  'domain',
  'window',
  'group',
  'position',
  'pinned',
]

export const EXPORT_FIELD_LABELS: Record<ExportField, string> = {
  title: 'Title',
  url: 'URL',
  domain: 'Domain',
  window: 'Window',
  group: 'Group',
  position: 'Position',
  pinned: 'Pinned',
}

const LEADING_WHITESPACE = /^[ \t]+/
const FORMULA_PREFIX = /^[=+\-@]/
const NEEDS_QUOTING = /[",\r\n]/

export function csvCell(value: unknown): string {
  const raw = String(value)
  const isFormulaLike = FORMULA_PREFIX.test(raw.replace(LEADING_WHITESPACE, ''))
  const neutralized = isFormulaLike ? `'${raw}` : raw
  const needsQuoting = NEEDS_QUOTING.test(raw) || isFormulaLike

  return needsQuoting ? `"${neutralized.replaceAll('"', '""')}"` : neutralized
}

export function serializeCsv<T extends object>(
  rows: readonly T[],
  fields: readonly (keyof T & string)[],
): string {
  const header = fields.join(',')
  const body = rows.map((row) => fields.map((field) => csvCell(row[field])).join(','))

  return [header, ...body].join('\r\n')
}

export function serializeJson<T extends object>(
  rows: readonly T[],
  fields: readonly (keyof T & string)[],
): string {
  const projected = rows.map((row) => {
    const entry: Record<string, unknown> = {}

    for (const field of fields) {
      entry[field] = row[field]
    }

    return entry
  })

  return JSON.stringify(projected, null, 2)
}

export function buildExportRows(
  tabs: readonly TabRecord[],
  groups: readonly TabGroupRecord[],
): ExportRow[] {
  const groupsById = new Map(groups.map((group) => [group.id, group]))

  return tabs.map((tab) => ({
    title: tabLabel(tab),
    url: tab.url,
    domain: tab.domain,
    window: tab.windowId,
    group: resolveGroupName(tab.groupId, groupsById),
    position: tab.index + 1,
    pinned: tab.pinned,
  }))
}

function resolveGroupName(
  groupId: number | null,
  groupsById: ReadonlyMap<number, TabGroupRecord>,
): string {
  if (groupId === null) {
    return ''
  }

  const group = groupsById.get(groupId)

  if (!group) {
    return ''
  }

  return group.title.trim() || 'Unnamed group'
}
