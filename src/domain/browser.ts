export type TabGroupColor =
  | 'grey'
  | 'blue'
  | 'red'
  | 'yellow'
  | 'green'
  | 'pink'
  | 'purple'
  | 'cyan'
  | 'orange'

export interface TabRecord {
  id: number
  windowId: number
  index: number
  title: string
  url: string
  domain: string
  faviconUrl: string | null
  pinned: boolean
  muted: boolean
  audible: boolean
  active: boolean
  discarded: boolean
  groupId: number | null
}

export interface TabGroupRecord {
  id: number
  windowId: number
  title: string
  color: TabGroupColor
}

export interface TabSnapshot {
  tabs: TabRecord[]
  groups: TabGroupRecord[]
  currentWindowId: number | null
  capturedAt: number
}

export interface TabDescriptor {
  url: string
  title: string
  pinned: boolean
  group?: {
    title: string
    color: TabGroupColor
  }
}

export interface OperationFailure {
  id: number
  message: string
}

export interface BulkResult {
  succeeded: number[]
  failed: OperationFailure[]
}
