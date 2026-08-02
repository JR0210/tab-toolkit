import { ExternalLinkIcon, PinIcon, Volume2Icon, VolumeXIcon } from 'lucide-react'
import type { TabGroupRecord, TabRecord } from '../../domain/browser'
import { cn } from '../../shared/lib/cn'
import { Button } from '../../shared/ui/button'
import { TabActionsMenu } from './TabActionsMenu'
import { TabFavicon } from './TabFavicon'

interface TabRowProps {
  tab: TabRecord
  group?: TabGroupRecord
  selected: boolean
  onToggleSelected: () => void
  onActivate: (tabId: number, windowId: number) => void
}

const groupColors: Record<TabGroupRecord['color'], string> = {
  grey: 'var(--muted-foreground)',
  blue: 'var(--group-blue)',
  red: 'var(--destructive)',
  yellow: 'var(--group-amber)',
  green: 'var(--success)',
  pink: 'var(--group-rose)',
  purple: 'var(--group-violet)',
  cyan: 'var(--group-teal)',
  orange: 'var(--group-amber)',
}

export function TabRow({ tab, group, selected, onToggleSelected, onActivate }: TabRowProps) {
  return (
    <article
      data-tab-id={tab.id}
      className={cn(
        'group/row relative flex min-h-11 items-center gap-2.5 rounded-md py-1 pr-1.5 pl-2 transition-colors',
        selected ? 'bg-accent/70' : 'hover:bg-secondary/60 focus-within:bg-secondary/60',
      )}
    >
      {group ? (
        <span
          className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-full"
          style={{ backgroundColor: groupColors[group.color] }}
          aria-hidden="true"
        />
      ) : null}

      <input
        type="checkbox"
        checked={selected}
        aria-label={`Select ${tab.title} (tab ${tab.id}, window ${tab.windowId})`}
        onChange={onToggleSelected}
        className="size-4 shrink-0 cursor-pointer accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />

      <TabFavicon faviconUrl={tab.faviconUrl} fallbackLabel={tab.domain || tab.url} />

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex min-w-0 items-center gap-1.5">
          <h3 className="truncate text-[13px] leading-tight font-medium text-foreground">
            {tab.title}
          </h3>
          {tab.pinned ? (
            <span aria-label="Pinned" title="Pinned" className="shrink-0 text-muted-foreground">
              <PinIcon aria-hidden="true" className="size-3" />
            </span>
          ) : null}
          {tab.audible ? (
            <span
              aria-label="Playing audio"
              title="Playing audio"
              className="shrink-0 text-success"
            >
              <Volume2Icon aria-hidden="true" className="size-3" />
            </span>
          ) : null}
          {tab.muted ? (
            <span aria-label="Muted" title="Muted" className="shrink-0 text-muted-foreground">
              <VolumeXIcon aria-hidden="true" className="size-3" />
            </span>
          ) : null}
          {tab.active ? (
            <span
              aria-label="Active tab"
              className="shrink-0 rounded-full bg-success/12 px-1.5 font-mono text-[10px] font-medium text-success"
            >
              active
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-mono text-[11px] leading-tight text-muted-foreground">
            {tab.domain || tab.url || 'No URL'}
          </span>
          {group ? (
            <span
              className="shrink-0 rounded-full px-1.5 text-[10px] font-medium"
              style={{
                color: groupColors[group.color],
                backgroundColor: `color-mix(in oklch, ${groupColors[group.color]} 14%, transparent)`,
              }}
            >
              {group.title || 'Unnamed group'}
            </span>
          ) : null}
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Activate ${tab.title} (tab ${tab.id}, window ${tab.windowId})`}
        title="Activate tab"
        onClick={() => onActivate(tab.id, tab.windowId)}
      >
        <ExternalLinkIcon />
      </Button>

      <TabActionsMenu tab={tab} />
    </article>
  )
}
