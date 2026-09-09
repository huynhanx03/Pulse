import { LocalStorageAdapter } from '@/lib/persistence/local-storage'
import type { StorageAdapter } from '@/lib/persistence/types'
import { MockExecutionClient } from '@/mocks/mock-execution-client'
import { createDemoWorkspace, demoWorkspaceDirectory } from '@/mocks/fixtures/demo-workspace'
import type { WorkspaceData, WorkspaceInfo } from '@/domain/types'
import type { ExecutionClient } from '@/services/execution-client'

export interface AppDependencies {
  executionClient: ExecutionClient
  storage: StorageAdapter
  createWorkspace: (workspaceId?: string) => WorkspaceData
  workspaceDirectory: WorkspaceInfo[]
}

export const createAppDependencies = (
  overrides: Partial<AppDependencies> = {},
): AppDependencies => ({
  executionClient: overrides.executionClient ?? new MockExecutionClient(),
  storage: overrides.storage ?? new LocalStorageAdapter(),
  createWorkspace: overrides.createWorkspace ?? createDemoWorkspace,
  workspaceDirectory: overrides.workspaceDirectory ?? demoWorkspaceDirectory,
})

/** The browser composition root; tests call the factory with memory/fake implementations. */
export const appDependencies = createAppDependencies()
