import { MemoryStorageAdapter } from '@/lib/persistence/memory-storage'
import { MockExecutionClient } from '@/mocks/mock-execution-client'
import type { ExecutionClient } from '@/services/execution-client'
import { createTestPulseStore as createPulseStore } from '@/test/create-test-pulse-store'

describe('runner orchestration', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('redacts structured secrets from reports and persisted runner inputs', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    store.getState().updateRunConfig({ mode: 'functional' })
    store
      .getState()
      .updateRequest('req-create-order', { body: '{"password":"runner-private-Q7","quantity":1}' })
    await store.getState().startRun()
    await vi.advanceTimersByTimeAsync(4_000)
    expect(JSON.stringify(store.getState().activeRunResult)).not.toContain('runner-private-Q7')
    expect(JSON.stringify(store.getState().data.runs)).not.toContain('runner-private-Q7')
  })

  it('uses dataset rows and the selected target scenario', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    store.getState().updateRunConfig({ mode: 'data' })
    store.getState().updateRunConfig({ iterations: 3 })
    store.getState().setMockProfile('req-create-order', { httpScenario: 'server-error' })
    await store.getState().startRun()
    await vi.advanceTimersByTimeAsync(4_000)
    expect(store.getState().activeRunResult?.metrics).toMatchObject({ total: 3, failures: 3 })
    expect(store.getState().activeRunResult?.iterations[0]?.input).toContain('customer_1')
  })

  it('records the start configuration even if draft settings change mid-run', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    store.getState().updateRunConfig({ mode: 'functional', workers: 3 })
    await store.getState().startRun()
    store.getState().updateRunConfig({ mode: 'arrival-rate', workers: 99 })
    await vi.advanceTimersByTimeAsync(4_000)
    expect(store.getState().data.runs[0]).toMatchObject({ mode: 'functional', workers: 3 })
  })

  it('captures trace context and evidence for every runner mode', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    const modes = [
      'functional',
      'data',
      'race',
      'constant-vus',
      'ramping-vus',
      'arrival-rate',
    ] as const

    for (const mode of modes) {
      store.getState().updateRunConfig({ mode, iterations: 3 })
      await store.getState().startRun()
      await vi.advanceTimersByTimeAsync(4_000)
    }

    expect(store.getState().data.runs).toHaveLength(modes.length)
    expect(
      store
        .getState()
        .data.runs.map((run) => run.mode)
        .sort(),
    ).toEqual([...modes].sort())
    for (const run of store.getState().data.runs) {
      expect(run.trace).toMatchObject({
        target: { name: 'Create order', protocol: 'http', operation: 'POST' },
      })
      expect(run.trace?.estimatedIterations).toBeGreaterThan(0)
      expect(run.result.series.length).toBeGreaterThan(0)
      expect(run.result.metrics.total + run.result.metrics.dropped).toBeGreaterThan(0)
    }

    const dataRun = store.getState().data.runs.find((run) => run.mode === 'data')
    const raceRun = store.getState().data.runs.find((run) => run.mode === 'race')
    expect(dataRun?.trace?.dataset).toMatchObject({ name: 'Order matrix' })
    expect(raceRun?.result.collisions[0]).toMatchObject({ attempts: 64 })
  })

  it('pauses without advancing and resumes the same snapshot', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    await store.getState().startRun()
    await vi.advanceTimersByTimeAsync(600)
    store.getState().pauseRun()
    const progress = store.getState().runProgress
    await vi.advanceTimersByTimeAsync(1_000)
    expect(store.getState().runProgress).toBe(progress)
    store.getState().resumeRun()
    await vi.advanceTimersByTimeAsync(4_000)
    expect(store.getState().runState).toBe('complete')
    expect(store.getState().data.runs).toHaveLength(1)
  })

  it('stops cleanly and rejects invalid configuration before simulation', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    store.getState().updateRunConfig({ workers: 0 })
    await store.getState().startRun()
    expect(store.getState().runState).toBe('idle')
    expect(store.getState().getRunPreflight().valid).toBe(false)
  })

  it('half-closes client-stream targets so a Test Lab run reaches a terminal result', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    store.getState().updateRequest('req-grpc-profile', {
      grpcMethodId: 'grpc-user-import',
      grpcType: 'client-stream',
    })
    store.getState().updateRunConfig({ mode: 'functional', requestId: 'req-grpc-profile' })

    await store.getState().startRun()
    await vi.advanceTimersByTimeAsync(4_000)

    expect(store.getState().runState).toBe('complete')
    expect(store.getState().activeRunResult?.metrics.total).toBe(1)
  })

  it('uses a distinct failed state when the execution boundary rejects a run', async () => {
    const base = new MockExecutionClient()
    const failingClient: ExecutionClient = {
      executeHttp: base.executeHttp.bind(base),
      openGrpc: base.openGrpc.bind(base),
      startRun: () => Promise.reject(new Error('mock run unavailable')),
    }
    const store = createPulseStore(new MemoryStorageAdapter(), failingClient)
    store.getState().updateRunConfig({ mode: 'functional' })

    await store.getState().startRun()

    expect(store.getState().runState).toBe('failed')
    expect(store.getState().toastMessage).toBeTruthy()
  })
})
