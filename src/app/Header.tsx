import { MoonIcon, MoreHorizontalIcon, SettingsIcon, SunIcon } from 'lucide-react'
import { useSettings } from '../shared/settings/use-settings'
import { Button } from '../shared/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../shared/ui/tooltip'
import { PrimaryNav } from './PrimaryNav'
import type { PrimaryView } from './PrimaryNav'

interface HeaderProps {
  view: PrimaryView
  onViewChange: (view: PrimaryView) => void
}

export function Header({ view, onViewChange }: HeaderProps) {
  const { resolvedTheme, persistenceError, updateSettings } = useSettings()
  const isDark = resolvedTheme === 'dark'

  return (
    <header className="flex flex-col border-b border-border bg-card">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <ExtensionMark />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold text-foreground">Tab Toolkit</span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            Local tab management
          </span>
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          {persistenceError && (
            <span role="alert" className="mr-1 text-xs font-medium text-destructive">
              {persistenceError}
            </span>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
                  onClick={() => {
                    void updateSettings({ theme: isDark ? 'light' : 'dark' }).catch(() => undefined)
                  }}
                />
              }
            >
              {isDark ? <MoonIcon /> : <SunIcon />}
            </TooltipTrigger>
            <TooltipContent>{isDark ? 'Light theme' : 'Dark theme'}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label="Settings" />}
            >
              <SettingsIcon />
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label="More options" />}
            >
              <MoreHorizontalIcon />
            </TooltipTrigger>
            <TooltipContent>More options</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <PrimaryNav view={view} onViewChange={onViewChange} />
    </header>
  )
}

function ExtensionMark() {
  return (
    <span
      className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-primary text-primary-foreground"
      aria-hidden="true"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M2 7.5C2 6.4 2.9 5.5 4 5.5H8L9.4 4H14C15.1 4 16 4.9 16 6V7.5H2Z"
          fill="currentColor"
          opacity="0.55"
        />
        <path
          d="M2 9C2 7.9 2.9 7 4 7H7.2L8.6 5.5H14C15.1 5.5 16 6.4 16 7.5V12C16 13.1 15.1 14 14 14H4C2.9 14 2 13.1 2 12V9Z"
          fill="currentColor"
        />
      </svg>
    </span>
  )
}
