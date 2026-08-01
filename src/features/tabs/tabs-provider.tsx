import { useCallback, useEffect, useRef, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { useBrowserGateway } from '../../chrome/use-browser-gateway'
import type { TabSnapshot } from '../../domain/browser'
import { TabsContext } from './tabs-context'
import type { TabsStatus } from './tabs-context'

export function TabsProvider({ children }: PropsWithChildren) {
  const gateway = useBrowserGateway()
  const [snapshot, setSnapshot] = useState<TabSnapshot | null>(null)
  const [status, setStatus] = useState<TabsStatus>('loading')
  const [error, setError] = useState<unknown>(null)
  const latestRequest = useRef(0)

  const refresh = useCallback(async (): Promise<void> => {
    const request = latestRequest.current + 1
    latestRequest.current = request
    setStatus('loading')
    setError(null)

    try {
      const nextSnapshot = await gateway.getSnapshot()

      if (request === latestRequest.current) {
        setSnapshot(nextSnapshot)
        setStatus('ready')
      }
    } catch (refreshError: unknown) {
      if (request === latestRequest.current) {
        setError(refreshError)
        setStatus('error')
      }
    }
  }, [gateway])

  const activateTab = useCallback(
    async (tabId: number, windowId: number): Promise<void> => {
      const request = latestRequest.current + 1
      latestRequest.current = request
      setStatus('loading')
      setError(null)

      try {
        await gateway.activateTab(tabId, windowId)
      } catch (activationError: unknown) {
        if (request === latestRequest.current) {
          setError(activationError)
          setStatus('error')
        }
        return
      }

      if (request !== latestRequest.current) {
        return
      }

      await refresh()
    },
    [gateway, refresh],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <TabsContext value={{ snapshot, status, error, refresh, activateTab }}>{children}</TabsContext>
  )
}
