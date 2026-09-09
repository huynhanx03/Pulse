import type { ExecutionClient } from '@/services/execution-client'

import { createAppDependencies } from '@/app/dependencies'

describe('application dependencies', () => {
  it('keeps the execution boundary injectable at the composition root', () => {
    const fakeClient: ExecutionClient = {
      executeHttp: vi.fn(() => Promise.reject(new Error('not exercised'))),
      openGrpc: vi.fn(() => Promise.reject(new Error('not exercised'))),
      startRun: vi.fn(() => Promise.reject(new Error('not exercised'))),
    }

    expect(createAppDependencies({ executionClient: fakeClient }).executionClient).toBe(fakeClient)
  })
})
