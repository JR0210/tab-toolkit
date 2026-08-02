import { useCallback, useEffect, useRef, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { toast } from 'sonner'
import { useTabs } from '../tabs/use-tabs'
import { WorkspacesContext } from './use-workspaces'
import type { WorkspacesStatus } from './use-workspaces'
import { validateWorkspace } from './workspace'
import type { Workspace } from './workspace'
import { tabsToDescriptors } from './workspace-mapper'
import { createChromeWorkspaceRepository } from './workspace-repository'
import type { WorkspaceRepository } from './workspace-repository'

interface WorkspacesProviderProps {
  repository?: WorkspaceRepository
}

export function WorkspacesProvider({
  children,
  repository = createChromeWorkspaceRepository(),
}: PropsWithChildren<WorkspacesProviderProps>) {
  const { snapshot } = useTabs()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [status, setStatus] = useState<WorkspacesStatus>('loading')
  const [error, setError] = useState<unknown>(null)
  // Single-slot "last deleted" record kept only in memory (one level of
  // undo, not a stack) -- storage never keeps a soft-deleted copy.
  const lastDeleted = useRef<Workspace | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    setStatus('loading')
    setError(null)

    try {
      const result = await repository.list()
      setWorkspaces(result.workspaces)
      setStatus('ready')
    } catch (refreshError: unknown) {
      setError(refreshError)
      setStatus('error')
    }
  }, [repository])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const saveCurrentWindow = useCallback(
    async (name: string): Promise<void> => {
      const currentWindowId = snapshot?.currentWindowId ?? null
      const windowTabs = (snapshot?.tabs ?? []).filter((tab) => tab.windowId === currentWindowId)
      const { descriptors, skippedCount } = tabsToDescriptors(windowTabs, snapshot?.groups ?? [])

      if (descriptors.length === 0) {
        const message = 'No tabs in this window could be saved.'
        toast.error(message)
        throw new Error(message)
      }

      const now = new Date().toISOString()
      const candidate = validateWorkspace({
        id: crypto.randomUUID(),
        name,
        createdAt: now,
        updatedAt: now,
        tabs: descriptors,
      })

      if (!candidate) {
        const message = 'Enter a workspace name to save.'
        toast.error(message)
        throw new Error(message)
      }

      await repository.put(candidate)
      await refresh()

      if (skippedCount > 0) {
        toast.success(
          `Saved ${descriptors.length} tabs; ${skippedCount} tabs could not be restored and were omitted.`,
        )
      } else {
        toast.success(descriptors.length === 1 ? 'Saved 1 tab' : `Saved ${descriptors.length} tabs`)
      }
    },
    [snapshot, repository, refresh],
  )

  const renameWorkspace = useCallback(
    async (id: string, newName: string): Promise<void> => {
      const target = workspaces.find((workspace) => workspace.id === id)

      if (!target) {
        toast.error('That workspace no longer exists.')
        throw new Error('Workspace not found')
      }

      const candidate = validateWorkspace({
        ...target,
        name: newName,
        updatedAt: new Date().toISOString(),
      })

      if (!candidate) {
        toast.error('Enter a workspace name.')
        throw new Error('Enter a workspace name.')
      }

      await repository.put(candidate)
      await refresh()
      toast.success('Workspace renamed.')
    },
    [workspaces, repository, refresh],
  )

  const deleteWorkspace = useCallback(
    async (id: string): Promise<void> => {
      const target = workspaces.find((workspace) => workspace.id === id)

      if (!target) {
        return
      }

      // Write-before-report: storage must confirm the delete before the
      // workspace disappears from the UI.
      await repository.delete(id)
      lastDeleted.current = target
      await refresh()
    },
    [workspaces, repository, refresh],
  )

  const undoDelete = useCallback(async (): Promise<void> => {
    const record = lastDeleted.current

    if (!record) {
      return
    }

    await repository.put(record)
    lastDeleted.current = null
    await refresh()
  }, [repository, refresh])

  return (
    <WorkspacesContext
      value={{
        workspaces,
        status,
        error,
        saveCurrentWindow,
        renameWorkspace,
        deleteWorkspace,
        undoDelete,
      }}
    >
      {children}
    </WorkspacesContext>
  )
}
