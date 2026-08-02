import type { TabDescriptor, TabGroupColor } from '../../domain/browser'

const MAX_NAME_LENGTH = 80

const GROUP_COLORS: ReadonlySet<TabGroupColor> = new Set([
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
])

export interface Workspace {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  tabs: TabDescriptor[]
}

/**
 * Validates AND normalizes an unknown value into a Workspace. Used both to
 * validate a record read back from storage and to normalize a workspace
 * being freshly created/renamed (trims/truncates `name`). Returns null for
 * anything genuinely invalid -- a malformed workspace's tabs can't be safely
 * invented, so (unlike normalizeSettings) there is no silent defaulting.
 */
export function validateWorkspace(value: unknown): Workspace | null {
  if (!isRecord(value)) {
    return null
  }

  const { id, name, createdAt, updatedAt, tabs } = value

  if (typeof id !== 'string' || id.length === 0) {
    return null
  }

  if (typeof name !== 'string') {
    return null
  }

  const normalizedName = truncateName(name.trim())

  if (normalizedName.length === 0) {
    return null
  }

  if (!isIsoTimestamp(createdAt) || !isIsoTimestamp(updatedAt)) {
    return null
  }

  if (!Array.isArray(tabs) || tabs.length === 0) {
    return null
  }

  const validatedTabs: TabDescriptor[] = []

  for (const tab of tabs) {
    const descriptor = validateTabDescriptor(tab)

    if (!descriptor) {
      return null
    }

    validatedTabs.push(descriptor)
  }

  return {
    id,
    name: normalizedName,
    createdAt,
    updatedAt,
    tabs: validatedTabs,
  }
}

function validateTabDescriptor(value: unknown): TabDescriptor | null {
  if (!isRecord(value)) {
    return null
  }

  const { url, title, pinned, group } = value

  if (typeof url !== 'string' || !isSafeUrl(url)) {
    return null
  }

  if (typeof title !== 'string') {
    return null
  }

  if (typeof pinned !== 'boolean') {
    return null
  }

  if (group === undefined) {
    return { url, title, pinned }
  }

  const validatedGroup = validateGroup(group)

  if (!validatedGroup) {
    return null
  }

  return { url, title, pinned, group: validatedGroup }
}

function validateGroup(value: unknown): NonNullable<TabDescriptor['group']> | null {
  if (!isRecord(value)) {
    return null
  }

  const { title, color } = value

  if (typeof title !== 'string') {
    return null
  }

  if (typeof color !== 'string' || !GROUP_COLORS.has(color as TabGroupColor)) {
    return null
  }

  return { title, color: color as TabGroupColor }
}

function isSafeUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

function truncateName(name: string): string {
  return name.length > MAX_NAME_LENGTH ? name.slice(0, MAX_NAME_LENGTH) : name
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  const date = new Date(value)

  return !Number.isNaN(date.getTime()) && date.toISOString() === value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
