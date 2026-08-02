import { createContext, useContext } from 'react'
import type { Workspace } from './workspace'

export type WorkspacesStatus = 'loading' | 'ready' | 'error'

export interface WorkspacesContextValue {
  workspaces: Workspace[]
  status: WorkspacesStatus
  error: unknown
  saveCurrentWindow: (name: string) => Promise<void>
  renameWorkspace: (id: string, newName: string) => Promise<void>
  deleteWorkspace: (id: string) => Promise<void>
  undoDelete: () => Promise<void>
}

export const WorkspacesContext = createContext<WorkspacesContextValue | null>(null)

export function useWorkspaces(): WorkspacesContextValue {
  const context = useContext(WorkspacesContext)

  if (!context) {
    throw new Error('useWorkspaces must be used within WorkspacesProvider')
  }

  return context
}
