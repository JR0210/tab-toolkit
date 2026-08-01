import { useMemo } from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { FilterIcon } from 'lucide-react'
import { Button } from '../../shared/ui/button'
import { Separator } from '../../shared/ui/separator'
import { EMPTY_FILTERS } from './tab-query'
import type { Filters } from './tab-query'
import { useTabInteractions } from './use-tab-interactions'
import { useTabs } from './use-tabs'

export function FilterPopover() {
  const { snapshot } = useTabs()
  const { activeFilterCount, query, setFilters } = useTabInteractions()
  const choices = useMemo(() => {
    const scopedTabs = (snapshot?.tabs ?? []).filter(
      (tab) => query.scope === 'all' || tab.windowId === snapshot?.currentWindowId,
    )
    const groupIds = new Set(
      scopedTabs.flatMap((tab) => (tab.groupId === null ? [] : [tab.groupId])),
    )

    return {
      windows: [...new Set(scopedTabs.map((tab) => tab.windowId))].sort(
        (left, right) => left - right,
      ),
      domains: [...new Set(scopedTabs.map((tab) => tab.domain).filter(Boolean))].sort(
        (left, right) => left.localeCompare(right),
      ),
      groups: (snapshot?.groups ?? [])
        .filter((group) => groupIds.has(group.id))
        .sort((left, right) => left.windowId - right.windowId || left.id - right.id),
    }
  }, [query.scope, snapshot])

  const toggleValue = <Key extends 'windowIds' | 'domains' | 'groupIds'>(
    key: Key,
    value: Filters[Key][number],
  ) => {
    const currentValues = query.filters[key]
    const nextValues = currentValues.includes(value as never)
      ? currentValues.filter((currentValue) => currentValue !== value)
      : [...currentValues, value]

    setFilters({ ...query.filters, [key]: nextValues })
  }

  const setFlag = (key: 'pinned' | 'audible' | 'muted' | 'duplicates', checked: boolean) => {
    setFilters({ ...query.filters, [key]: checked })
  }

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label={
              activeFilterCount > 0 ? `Filter tabs, ${activeFilterCount} active` : 'Filter tabs'
            }
          />
        }
      >
        <FilterIcon />
        Filter
        {activeFilterCount > 0 ? (
          <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-primary font-mono text-[10px] text-primary-foreground">
            {activeFilterCount}
          </span>
        ) : null}
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          side="bottom"
          align="start"
          sideOffset={4}
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup
            role="dialog"
            aria-label="Filters"
            className="z-50 flex max-h-[390px] w-72 origin-(--transform-origin) flex-col overflow-hidden rounded-lg bg-popover text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            <div className="flex items-center justify-between px-3 py-2">
              <PopoverPrimitive.Title className="text-sm font-medium">
                Filters
              </PopoverPrimitive.Title>
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground"
                disabled={activeFilterCount === 0}
                onClick={() => setFilters({ ...EMPTY_FILTERS })}
              >
                Clear all
              </Button>
            </div>
            <Separator />

            <div className="flex flex-col gap-3 overflow-y-auto p-3">
              <FilterSection label="Window">
                {choices.windows.map((windowId) => (
                  <FilterOption
                    key={windowId}
                    label={`Window ${windowId}`}
                    checked={query.filters.windowIds.includes(windowId)}
                    onChange={() => toggleValue('windowIds', windowId)}
                  />
                ))}
              </FilterSection>

              <FilterSection label="Domain">
                {choices.domains.map((domain) => (
                  <FilterOption
                    key={domain}
                    label={domain}
                    mono
                    checked={query.filters.domains.includes(domain)}
                    onChange={() => toggleValue('domains', domain)}
                  />
                ))}
              </FilterSection>

              {choices.groups.length > 0 ? (
                <FilterSection label="Tab group">
                  {choices.groups.map((group) => (
                    <FilterOption
                      key={group.id}
                      label={`${group.title || 'Unnamed group'} (group ${group.id}, window ${group.windowId})`}
                      checked={query.filters.groupIds.includes(group.id)}
                      onChange={() => toggleValue('groupIds', group.id)}
                    />
                  ))}
                </FilterSection>
              ) : null}

              <Separator />

              <FilterOption
                label="Pinned"
                checked={query.filters.pinned}
                onChange={(checked) => setFlag('pinned', checked)}
              />
              <FilterOption
                label="Playing audio"
                checked={query.filters.audible}
                onChange={(checked) => setFlag('audible', checked)}
              />
              <FilterOption
                label="Muted"
                checked={query.filters.muted}
                onChange={(checked) => setFlag('muted', checked)}
              />
              <FilterOption
                label="Duplicate URLs"
                checked={query.filters.duplicates}
                onChange={(checked) => setFlag('duplicates', checked)}
              />
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

function FilterSection({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </legend>
      {children}
    </fieldset>
  )
}

function FilterOption({
  checked,
  label,
  mono = false,
  onChange,
}: {
  checked: boolean
  label: string
  mono?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md py-0.5">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="size-4 shrink-0 cursor-pointer accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <span className={mono ? 'truncate font-mono text-[12px]' : 'text-[13px]'}>{label}</span>
    </label>
  )
}
