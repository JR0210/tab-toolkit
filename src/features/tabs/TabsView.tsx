import { AlertCircleIcon, LoaderCircleIcon, PanelsTopLeftIcon } from 'lucide-react'
import { Button } from '../../shared/ui/button'
import { useTabs } from './use-tabs'
import { WindowSection } from './WindowSection'

export function TabsView() {
  const { activateTab, error, refresh, snapshot, status } = useTabs()

  if (status === 'loading') {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-canvas px-6 text-center">
        <div role="status" className="flex flex-col items-center gap-2 text-muted-foreground">
          <LoaderCircleIcon aria-hidden="true" className="size-5 animate-spin" />
          <span className="text-sm">Loading tabs…</span>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    const message = error instanceof Error ? error.message : 'Chrome could not return your tabs.'

    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-canvas px-6 text-center">
        <div role="alert" className="flex max-w-sm flex-col items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircleIcon aria-hidden="true" className="size-4" />
          </span>
          <h2 className="text-sm font-semibold text-foreground">Couldn’t load tabs</h2>
          <p className="text-xs text-muted-foreground">{message}</p>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!snapshot || snapshot.tabs.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-canvas px-6 text-center">
        <div className="flex max-w-sm flex-col items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <PanelsTopLeftIcon aria-hidden="true" className="size-4" />
          </span>
          <h2 className="text-sm font-semibold text-foreground">No open tabs</h2>
          <p className="text-xs text-muted-foreground">
            Open a normal Chrome window to see its tabs here.
          </p>
        </div>
      </div>
    )
  }

  const groupsById = new Map(snapshot.groups.map((group) => [group.id, group]))
  const windowIds = [...new Set(snapshot.tabs.map((tab) => tab.windowId))].sort(
    (left, right) => left - right,
  )

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-canvas px-2 py-2">
      <div className="flex flex-col gap-3">
        {windowIds.map((windowId) => (
          <WindowSection
            key={windowId}
            windowId={windowId}
            tabs={snapshot.tabs
              .filter((tab) => tab.windowId === windowId)
              .sort((left, right) => left.index - right.index)}
            groupsById={groupsById}
            current={windowId === snapshot.currentWindowId}
            onActivate={(tabId, containingWindowId) => {
              void activateTab(tabId, containingWindowId)
            }}
          />
        ))}
      </div>
    </div>
  )
}
