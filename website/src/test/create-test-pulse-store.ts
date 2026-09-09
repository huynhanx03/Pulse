import { MemoryStorageAdapter } from '@/lib/persistence/memory-storage'
import type { StorageAdapter } from '@/lib/persistence/types'
import { createPulseStore } from '@/state/create-pulse-store'
import { MockExecutionClient } from '@/mocks/mock-execution-client'
import { createDemoWorkspace, demoWorkspaceDirectory } from '@/mocks/fixtures/demo-workspace'
import type { ExecutionClient } from '@/services/execution-client'

export const createTestPulseStore = (
  storage: StorageAdapter = new MemoryStorageAdapter(),
  executionClient: ExecutionClient = new MockExecutionClient(),
) =>
  createPulseStore({
    storage,
    executionClient,
    createWorkspace: createDemoWorkspace,
    workspaceDirectory: demoWorkspaceDirectory,
  })
