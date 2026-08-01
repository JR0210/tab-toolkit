import { useCallback, useEffect, useRef, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { SettingsContext } from './settings-context'
import { defaultSettings } from './settings'
import type { Settings, Theme } from './settings'
import type { SettingsRepository } from './settings-repository'

export function SettingsProvider({
  children,
  repository,
}: PropsWithChildren<{ repository: SettingsRepository }>) {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [resolvedTheme, setResolvedTheme] = useState<Exclude<Theme, 'system'>>('light')
  const [persistenceError, setPersistenceError] = useState<string | null>(null)
  const hydration = useRef<Promise<void> | null>(null)
  const isHydrated = useRef(false)
  const pendingChanges = useRef<Partial<Settings>>({})
  const latestSettings = useRef<Settings>(defaultSettings)
  const saveChain = useRef(Promise.resolve())

  const enqueueSave = useCallback(
    (nextSettings: Settings): Promise<void> => {
      const save = saveChain.current.then(() => repository.save(nextSettings))
      const monitoredSave = save.then(
        () => {
          setPersistenceError(null)
        },
        (error: unknown) => {
          setPersistenceError('Settings could not be saved. Try again.')
          throw error
        },
      )
      saveChain.current = monitoredSave.catch(() => undefined)

      return monitoredSave
    },
    [repository],
  )

  const hydrate = useCallback((): Promise<void> => {
    if (!hydration.current) {
      hydration.current = repository
        .load()
        .catch(() => defaultSettings)
        .then((loadedSettings) => {
          const changes = pendingChanges.current
          const nextSettings = { ...loadedSettings, ...changes }
          const shouldPersistChanges = Object.keys(changes).length > 0

          isHydrated.current = true
          latestSettings.current = nextSettings
          setSettings(nextSettings)

          if (shouldPersistChanges) {
            return enqueueSave(nextSettings)
          }
        })
    }

    return hydration.current
  }, [enqueueSave, repository])

  function updateSettings(changes: Partial<Settings>): Promise<void> {
    const nextSettings = { ...latestSettings.current, ...changes }
    latestSettings.current = nextSettings
    setSettings(nextSettings)

    if (!isHydrated.current) {
      pendingChanges.current = { ...pendingChanges.current, ...changes }
      return hydrate()
    }

    return enqueueSave(nextSettings)
  }

  useEffect(() => {
    void hydrate().catch(() => undefined)
  }, [hydrate])

  useEffect(() => {
    const applyTheme = (isDark: boolean) => {
      document.documentElement.classList.toggle('dark', isDark)
      setResolvedTheme(isDark ? 'dark' : 'light')
    }

    if (settings.theme !== 'system') {
      applyTheme(settings.theme === 'dark')
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event: MediaQueryListEvent) => {
      applyTheme(event.matches)
    }

    applyTheme(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [settings.theme])

  return (
    <SettingsContext value={{ settings, resolvedTheme, persistenceError, updateSettings }}>
      {children}
    </SettingsContext>
  )
}
