import { useEffect, useRef } from 'react'
import type { ComponentProps } from 'react'
import { ArrowDownUpIcon, SearchIcon, XIcon } from 'lucide-react'
import { cn } from '../../shared/lib/cn'
import { Button } from '../../shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../shared/ui/dropdown-menu'
import { FilterPopover } from './FilterPopover'
import type { SortKey } from './tab-query'
import { useTabInteractions } from './use-tab-interactions'

const SORT_LABELS: Record<SortKey, string> = {
  position: 'Tab order',
  title: 'Title (A–Z)',
  domain: 'Domain (A–Z)',
}

export function TabsToolbar() {
  const { query, setScope, setSearch, setSort, selectedIds, setManySelected, visibleIds } =
    useTabInteractions()
  const selectedVisibleCount = visibleIds.filter((tabId) => selectedIds.has(tabId)).length
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected

  return (
    <div className="flex flex-col gap-2 border-b border-border bg-card px-3 py-2.5">
      <div
        className="inline-flex h-8 w-fit items-center rounded-lg bg-secondary p-0.5"
        role="tablist"
        aria-label="Tab scope"
      >
        <ScopeButton
          active={query.scope === 'current'}
          label="Current window"
          onClick={() => setScope('current')}
        />
        <ScopeButton
          active={query.scope === 'all'}
          label="All windows"
          onClick={() => setScope('all')}
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={query.search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search tabs"
            placeholder="Search titles, URLs, or domains"
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 pr-8 pl-8 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          {query.search ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Clear search"
              className="absolute top-1/2 right-1 -translate-y-1/2"
              onClick={() => setSearch('')}
            >
              <XIcon />
            </Button>
          ) : null}
        </div>

        <FilterPopover />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" aria-label="Sort tabs" />}
          >
            <ArrowDownUpIcon />
            {SORT_LABELS[query.sort]}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuRadioGroup
              value={query.sort}
              onValueChange={(value) => setSort(value as SortKey)}
            >
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((sortKey) => (
                <DropdownMenuRadioItem key={sortKey} value={sortKey}>
                  {SORT_LABELS[sortKey]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex h-6 items-center gap-2.5 pl-0.5">
        <TriStateCheckbox
          checked={allVisibleSelected}
          indeterminate={someVisibleSelected}
          disabled={visibleIds.length === 0}
          aria-label="Select all visible tabs"
          onChange={(event) => setManySelected(visibleIds, event.currentTarget.checked)}
        />
        <span className="font-mono text-[11px] text-muted-foreground">
          {selectedVisibleCount > 0
            ? `${selectedVisibleCount} of ${visibleIds.length} selected`
            : `${visibleIds.length} tabs`}
        </span>
      </div>
    </div>
  )
}

function ScopeButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center rounded-[7px] px-2.5 text-[12px] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        active
          ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}

function TriStateCheckbox({
  indeterminate = false,
  ...props
}: ComponentProps<'input'> & { indeterminate?: boolean }) {
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
      className="size-4 shrink-0 cursor-pointer accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      {...props}
    />
  )
}
