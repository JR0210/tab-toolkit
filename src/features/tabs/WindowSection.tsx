import { useEffect, useRef } from 'react'
import { ChevronDownIcon, MonitorIcon } from 'lucide-react'
import type { TabGroupRecord, TabRecord } from '../../domain/browser'
import { cn } from '../../shared/lib/cn'
import { TabRow } from './TabRow'
import { useTabInteractions } from './use-tab-interactions'

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
  const {
    collapsedWindowIds,
    selectedIds,
    setManySelected,
    toggleSelected,
    toggleWindowCollapsed,
  } = useTabInteractions()
  const headingId = `window-${windowId}-heading`
  const tabIds = tabs.map((tab) => tab.id)
  const selectedCount = tabIds.filter((tabId) => selectedIds.has(tabId)).length
  const allSelected = tabIds.length > 0 && selectedCount === tabIds.length
  const someSelected = selectedCount > 0 && !allSelected
  const collapsed = collapsedWindowIds.has(windowId)

  return (
    <section className="flex flex-col" aria-labelledby={headingId}>
      <div className="flex h-8 items-center gap-2.5 rounded-md px-2">
        <WindowCheckbox
          checked={allSelected}
          indeterminate={someSelected}
          aria-label={`Select all tabs in window ${windowId}`}
          onChange={(event) => setManySelected(tabIds, event.currentTarget.checked)}
        />
        <h2
          id={headingId}
          className="min-w-0 flex-1 font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
        >
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={`window-${windowId}-tabs`}
            onClick={() => toggleWindowCollapsed(windowId)}
            className="flex w-full items-center gap-1.5 rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ChevronDownIcon
              aria-hidden="true"
              className={cn(
                'size-3.5 shrink-0 text-muted-foreground transition-transform',
                collapsed && '-rotate-90',
              )}
            />
            <MonitorIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
            Window {windowId} · {tabs.length} {tabs.length === 1 ? 'tab' : 'tabs'}
          </button>
        </h2>
        {current ? (
          <span className="rounded-full bg-success/12 px-1.5 font-mono text-[10px] font-medium text-success">
            current
          </span>
        ) : null}
      </div>

      {!collapsed ? (
        <div id={`window-${windowId}-tabs`} className="flex flex-col pl-1">
          {tabs.map((tab) => (
            <TabRow
              key={tab.id}
              tab={tab}
              group={tab.groupId === null ? undefined : groupsById.get(tab.groupId)}
              selected={selectedIds.has(tab.id)}
              onToggleSelected={() => toggleSelected(tab.id)}
              onActivate={onActivate}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}

function WindowCheckbox({
  indeterminate,
  ...props
}: React.ComponentProps<'input'> & { indeterminate: boolean }) {
  const checkboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <input
      ref={checkboxRef}
      type="checkbox"
      className="size-4 shrink-0 cursor-pointer accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      {...props}
    />
  )
}
