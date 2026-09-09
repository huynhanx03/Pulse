import type { HttpExecutionResult } from '@/domain/execution/http'
import { MemoryStorageAdapter } from '@/lib/persistence/memory-storage'
import { createDemoWorkspace } from '@/mocks/fixtures/demo-workspace'
import { createPulseStore } from '@/state/create-pulse-store'
import {
  ExecutionAbortedError,
  type ExecutionClient,
  type ExecutionOptions,
} from '@/services/execution-client'

const fakeResponse = (): HttpExecutionResult => ({
  id: 'exec-from-fake',
  requestId: 'req-create-order',
  status: 299,
  statusText: 'Fake Boundary',
  size: 44,
  body: { ok: true, data: { id: 'order-from-fake' } },
  rawBody: '{"ok":true,"data":{"id":"order-from-fake"}}',
  headers: [],
  cookies: [],
  tests: [],
  console: [],
  timings: { queued: 0, dns: 0, connect: 0, tls: 0, upload: 0, ttfb: 1, download: 0, total: 1 },
  redirects: [],
})

const tokenResponse = (accessToken: string, refreshToken: string): HttpExecutionResult => ({
  ...fakeResponse(),
  status: 200,
  statusText: 'OK',
  body: { data: { accessToken, refreshToken, expiresIn: 900 } },
  rawBody: JSON.stringify({ data: { accessToken, refreshToken, expiresIn: 900 } }),
})

const fakeClient = (executeHttp: ExecutionClient['executeHttp']): ExecutionClient => ({
  executeHttp,
  openGrpc: () => Promise.reject(new Error('gRPC not exercised')),
  startRun: () => Promise.reject(new Error('run not exercised')),
})

describe('Pulse store execution dependency', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('publishes the result returned by the injected execution client', async () => {
    const executeHttp = vi.fn(
      async (
        _input: Parameters<ExecutionClient['executeHttp']>[0],
        _options: ExecutionOptions,
        _signal: AbortSignal,
      ) => fakeResponse(),
    )
    const store = createPulseStore({
      storage: new MemoryStorageAdapter(),
      executionClient: fakeClient(executeHttp),
      createWorkspace: createDemoWorkspace,
    })
    store.getState().selectRequest('req-create-order')

    const sending = store.getState().sendActiveRequest()
    await vi.advanceTimersByTimeAsync(1_000)
    await sending

    expect(executeHttp).toHaveBeenCalledTimes(1)
    expect(store.getState().lastHttpResponse).toMatchObject({
      id: 'exec-from-fake',
      status: 299,
    })
  })

  it('aborts the exact in-flight client call when the user cancels', async () => {
    let capturedSignal: AbortSignal | undefined
    const executeHttp: ExecutionClient['executeHttp'] = (_input, _options, signal) => {
      capturedSignal = signal
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new ExecutionAbortedError()), { once: true })
      })
    }
    const store = createPulseStore({
      storage: new MemoryStorageAdapter(),
      executionClient: fakeClient(executeHttp),
      createWorkspace: createDemoWorkspace,
    })
    store.getState().selectRequest('req-create-order')

    const sending = store.getState().sendActiveRequest()
    await vi.advanceTimersByTimeAsync(1_000)
    store.getState().cancelActiveRequest()
    await sending

    expect(capturedSignal?.aborted).toBe(true)
    expect(store.getState().executionState).toBe('cancelled')
    expect(store.getState().grpcSessionState).toBe('idle')
    expect(store.getState().lastHttpResponse).toBeNull()
  })

  it('aborts the in-flight transport when navigation selects another request', async () => {
    let capturedSignal: AbortSignal | undefined
    const executeHttp: ExecutionClient['executeHttp'] = (_input, _options, signal) => {
      capturedSignal = signal
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new ExecutionAbortedError()), { once: true })
      })
    }
    const store = createPulseStore({
      storage: new MemoryStorageAdapter(),
      executionClient: fakeClient(executeHttp),
      createWorkspace: createDemoWorkspace,
    })
    store.getState().selectRequest('req-create-order')

    const sending = store.getState().sendActiveRequest()
    await vi.advanceTimersByTimeAsync(1_000)
    store.getState().selectRequest('req-profile')
    await sending

    expect(capturedSignal?.aborted).toBe(true)
    expect(store.getState().executionState).toBe('idle')
    expect(store.getState().lastHttpResponse).toBeNull()
  })

  it('does not let an older refresh overwrite a newer login token set', async () => {
    let resolveRefresh: ((response: HttpExecutionResult) => void) | undefined
    let call = 0
    const executeHttp: ExecutionClient['executeHttp'] = () => {
      call += 1
      if (call === 1) {
        return new Promise((resolve) => {
          resolveRefresh = resolve
        })
      }
      return Promise.resolve(tokenResponse('access-from-login', 'refresh-from-login'))
    }
    const store = createPulseStore({
      storage: new MemoryStorageAdapter(),
      executionClient: fakeClient(executeHttp),
      createWorkspace: createDemoWorkspace,
    })

    const refresh = store.getState().forceRefresh()
    expect(store.getState().authOperation).toBe('refresh')
    await store.getState().runLoginCapture()
    resolveRefresh?.(tokenResponse('access-from-old-refresh', 'refresh-from-old-refresh'))
    await refresh

    const environment = store
      .getState()
      .data.environments.find((candidate) => candidate.id === 'env-staging')
    expect(environment?.variables.find((variable) => variable.key === 'access_token')?.value).toBe(
      'access-from-login',
    )
    expect(store.getState().data.environments[0]?.authSessions[0]?.tokenVersion).toBe(1)
    expect(store.getState().authOperation).toBe('idle')
  })
})
