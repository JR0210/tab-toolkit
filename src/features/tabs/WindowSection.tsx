import { MonitorIcon } from 'lucide-react'
import type { TabGroupRecord, TabRecord } from '../../domain/browser'
import { TabRow } from './TabRow'

interface WindowSectionProps {
  windowId: number
  tabs: TabRecord[]
  groupsById: ReadonlyMap<number, TabGroupRecord>
  current: boolean
  onActivate: (tabId: number, windowId: number) => void
}

export function WindowSection({
  windowId,
  tabs,
  groupsById,
  current,
  onActivate,
}: WindowSectionProps) {
  const headingId = `window-${windowId}-heading`

  return (
    <section className="flex flex-col" aria-labelledby={headingId}>
      <div className="flex h-8 items-center gap-1.5 rounded-md px-2">
        <MonitorIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        <h2
          id={headingId}
          className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
        >
          Window {windowId} · {tabs.length} {tabs.length === 1 ? 'tab' : 'tabs'}
        </h2>
        {current ? (
          <span className="rounded-full bg-success/12 px-1.5 font-mono text-[10px] font-medium text-success">
            current
          </span>
        ) : null}
      </div>

      <div className="flex flex-col pl-1">
        {tabs.map((tab) => (
          <TabRow
            key={tab.id}
            tab={tab}
            group={tab.groupId === null ? undefined : groupsById.get(tab.groupId)}
            onActivate={onActivate}
          />
        ))}
      </div>
    </section>
  )
}
