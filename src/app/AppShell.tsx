import { useState } from 'react'
import { TabsView } from '../features/tabs/TabsView'
import { Header } from './Header'
import type { PrimaryView } from './PrimaryNav'

export function AppShell() {
  const [view, setView] = useState<PrimaryView>('tabs')

  return (
    <div
      data-testid="popup-root"
      className="flex flex-col overflow-hidden bg-card text-card-foreground"
      style={{ width: '760px', height: '580px', overflow: 'hidden' }}
    >
      <Header view={view} onViewChange={setView} />
      <main className="relative flex min-h-0 flex-1 flex-col" aria-label={`${view} view`}>
        <h1 className="sr-only">{view === 'tabs' ? 'Tabs' : 'Workspaces'}</h1>
        {view === 'tabs' ? <TabsView /> : null}
      </main>
    </div>
  )
}
