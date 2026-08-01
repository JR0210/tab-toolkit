import { BookmarkIcon, LayoutGridIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../shared/lib/cn'

export type PrimaryView = 'tabs' | 'workspaces'

interface PrimaryNavProps {
  view: PrimaryView
  onViewChange: (view: PrimaryView) => void
}

export function PrimaryNav({ view, onViewChange }: PrimaryNavProps) {
  return (
    <nav className="flex items-center gap-1 px-3 pb-2" aria-label="Primary views">
      <NavButton
        active={view === 'tabs'}
        icon={<LayoutGridIcon />}
        label="Tabs"
        onClick={() => onViewChange('tabs')}
      />
      <NavButton
        active={view === 'workspaces'}
        icon={<BookmarkIcon />}
        label="Workspaces"
        onClick={() => onViewChange('workspaces')}
      />
    </nav>
  )
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-3.5',
        active
          ? 'bg-secondary text-foreground'
          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
