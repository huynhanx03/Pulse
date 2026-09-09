import { MemoryStorageAdapter } from '@/lib/persistence/memory-storage'
import { createTestPulseStore as createPulseStore } from '@/test/create-test-pulse-store'

describe('Pulse store request execution', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates a persisted request draft without coupling the UI to fixtures', () => {
    const storage = new MemoryStorageAdapter()
    const store = createPulseStore(storage)

    const id = store.getState().createRequest('grpc', 'Untitled gRPC request')

    expect(store.getState().data.requests.find((request) => request.id === id)).toMatchObject({
      protocol: 'grpc',
      dirty: true,
    })
    expect(createPulseStore(storage).getState().data.activeRequestId).toBe(id)
  })

  it('recovers unsaved request edits as a dirty local draft after reload', () => {
    const storage = new MemoryStorageAdapter()
    const store = createPulseStore(storage)

    store.getState().updateRequest('req-login', { url: 'https://draft.internal/v2/login' })

    expect(
      createPulseStore(storage)
        .getState()
        .data.requests.find((request) => request.id === 'req-login'),
    ).toMatchObject({ url: 'https://draft.internal/v2/login', dirty: true })
  })

  it('keeps each workspace in its own persisted data boundary when switching', () => {
    const storage = new MemoryStorageAdapter()
    const store = createPulseStore(storage)
    const coreRequestId = store.getState().createRequest('http', 'Core-only request')

    store.getState().selectWorkspace('ws-reliability')
    expect(store.getState().data.workspace.id).toBe('ws-reliability')
    expect(store.getState().data.requests.some((request) => request.id === coreRequestId)).toBe(
      false,
    )
    const reliabilityRequestId = store.getState().createRequest('grpc', 'Reliability-only request')

    store.getState().selectWorkspace('ws-core')
    expect(store.getState().data.requests.some((request) => request.id === coreRequestId)).toBe(
      true,
    )
    expect(
      store.getState().data.requests.some((request) => request.id === reliabilityRequestId),
    ).toBe(false)

    store.getState().selectWorkspace('ws-reliability')
    expect(
      store.getState().data.requests.some((request) => request.id === reliabilityRequestId),
    ).toBe(true)
  })

  it('duplicates a request independently and deletes only the chosen copy', () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    const id = store.getState().duplicateRequest('req-login', 'Login copy')
    store.getState().updateRequest(id, { body: '{}' })
    expect(
      store.getState().data.requests.find((request) => request.id === 'req-login')?.body,
    ).not.toBe('{}')
    store.getState().deleteRequest(id)
    expect(store.getState().data.requests.some((request) => request.id === id)).toBe(false)
    expect(store.getState().data.requests.some((request) => request.id === 'req-login')).toBe(true)
    expect(store.getState().data.openTabs.some((tab) => tab.requestId === id)).toBe(false)
  })

  it('organizes collections and folders without orphaning requests', () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    const collectionId = store.getState().createCollection('Billing')
    const defaultFolder = store
      .getState()
      .data.collections.find((collection) => collection.id === collectionId)!.folders[0]!
    const folderId = store.getState().createFolder(collectionId, 'Invoices')
    const requestId = store
      .getState()
      .createRequest('http', 'Create invoice', { collectionId, folderId })

    store.getState().renameCollection(collectionId, 'Billing API')
    store.getState().renameFolder(collectionId, folderId, 'Invoice writes')
    store.getState().moveRequest(requestId, collectionId, defaultFolder.id)
    expect(
      store.getState().data.requests.find((request) => request.id === requestId),
    ).toMatchObject({
      collectionId,
      folderId: defaultFolder.id,
    })

    store.getState().moveRequest(requestId, collectionId, folderId)
    store.getState().deleteFolder(collectionId, folderId)
    expect(
      store.getState().data.requests.find((request) => request.id === requestId),
    ).toMatchObject({
      collectionId,
      folderId: defaultFolder.id,
    })
    store.getState().deleteCollection(collectionId)
    const moved = store.getState().data.requests.find((request) => request.id === requestId)
    expect(moved?.collectionId).not.toBe(collectionId)
    expect(
      store
        .getState()
        .data.collections.find((collection) => collection.id === moved?.collectionId)
        ?.folders.some((folder) => folder.id === moved?.folderId),
    ).toBe(true)
  })

  it('creates, duplicates, edits and safely removes environments and variables', () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    const environmentId = store.getState().createEnvironment('QA isolated')
    store.getState().addEnvironmentVariable(environmentId)
    const variable = store
      .getState()
      .data.environments.find((environment) => environment.id === environmentId)?.variables[0]
    expect(variable).toBeDefined()
    store.getState().updateEnvironmentVariable(environmentId, variable!.id, {
      key: 'tenant_id',
      value: 'tenant-b',
    })
    expect(
      store.getState().data.environments.find((environment) => environment.id === environmentId)
        ?.variables[0]?.value,
    ).toBe('tenant-b')

    const copyId = store.getState().duplicateEnvironment(environmentId, 'QA copy')
    expect(copyId).not.toBe(environmentId)
    expect(
      store.getState().data.environments.find((environment) => environment.id === copyId),
    ).toMatchObject({ name: 'QA copy', variables: [{ key: 'tenant_id' }] })
    store.getState().deleteEnvironment(copyId)
    expect(
      store.getState().data.environments.some((environment) => environment.id === copyId),
    ).toBe(false)
  })

  it('manages multiple datasets without leaving Test Lab on a deleted selection', () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    const datasetId = store.getState().createDataset('Regression rows')
    store.getState().updateRunConfig({ mode: 'data', datasetId })
    const copyId = store.getState().duplicateDataset(datasetId, 'Regression copy')

    expect(store.getState().data.datasets.find((dataset) => dataset.id === copyId)).toMatchObject({
      name: 'Regression copy',
    })
    store.getState().deleteDataset(datasetId)
    expect(store.getState().runConfig.datasetId).not.toBe(datasetId)
    expect(store.getState().data.datasets.some((dataset) => dataset.id === datasetId)).toBe(false)
  })

  it('resolves environment variables into the active request', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    store.getState().selectRequest('req-create-order')

    const sending = store.getState().sendActiveRequest()
    await vi.advanceTimersByTimeAsync(1_000)
    await sending

    expect(store.getState().lastResolution?.body.value).toContain('"quantity": 1')
  })

  it('reopens the immutable safe execution snapshot as a new draft', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    store.getState().selectRequest('req-login')
    store.getState().setMockProfile('req-login', { httpScenario: 'validation' })
    store.getState().updateRequest('req-login', {
      body: '{"email":"captured@example.test","password":"do-not-retain"}',
    })
    const sending = store.getState().sendActiveRequest()
    await vi.advanceTimersByTimeAsync(1_000)
    await sending
    const execution = store.getState().data.executions[0]!
    store.getState().updateRequest('req-login', { body: '{"changed":true}' })

    const draftId = store.getState().reopenExecution(execution.id, 'Historical login')
    const draft = store.getState().data.requests.find((request) => request.id === draftId)

    expect(draft).toMatchObject({ name: 'Historical login', dirty: true })
    expect(draft?.body).toContain('captured@example.test')
    expect(draft?.body).not.toContain('do-not-retain')
    expect(draft?.body).not.toContain('"changed"')
    expect(store.getState().mockProfiles[draftId]?.httpScenario).toBe('validation')
  })

  it('refreshes an expiring bearer token before a protected request', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    store.getState().advanceMockClock(14 * 60 * 1_000 + 40 * 1_000)
    store.getState().selectRequest('req-profile')

    const sending = store.getState().sendActiveRequest()
    await vi.advanceTimersByTimeAsync(1_000)
    await sending

    const state = store.getState()
    expect(state.data.environments[0]?.authSessions[0]?.refreshCount).toBe(1)
    const environment = state.data.environments.find((candidate) => candidate.id === 'env-staging')
    expect(environment?.variables.find((variable) => variable.key === 'access_token')?.value).toBe(
      'eyJhbGciOiJQUzI1NiJ9.demo-access.signature',
    )
  })

  it('shares one response-driven refresh across concurrent callers', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())

    const [first, second] = await Promise.all([
      store.getState().forceRefresh(),
      store.getState().forceRefresh(),
    ])

    expect(first).toBe(true)
    expect(second).toBe(true)
    expect(store.getState().data.environments[0]?.authSessions[0]?.refreshCount).toBe(1)
    const environment = store
      .getState()
      .data.environments.find((candidate) => candidate.id === 'env-staging')
    expect(environment?.variables.find((variable) => variable.key === 'refresh_token')?.value).toBe(
      'pulse-refresh-demo-internal',
    )
  })

  it('does not place a late response in another request tab', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    const sending = store.getState().sendActiveRequest()
    store.getState().selectRequest('req-create-order')
    await vi.advanceTimersByTimeAsync(1_000)
    await sending
    expect(store.getState().lastHttpResponse).toBeNull()
    expect(store.getState().executionState).toBe('idle')
  })

  it('drives a client-stream session through send and half-close', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    store.getState().selectRequest('req-grpc-profile')
    store.getState().updateRequest('req-grpc-profile', {
      grpcMethodId: 'grpc-user-import',
      grpcType: 'client-stream',
    })

    const sending = store.getState().sendActiveRequest()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(store.getState().grpcSessionState).toBe('streaming')
    expect(store.getState().lastGrpcResult?.statusName).toBe('STREAMING')
    await expect(store.getState().sendGrpcMessage({ user_id: 'usr_second' })).resolves.toBe(true)
    await expect(store.getState().halfCloseGrpcStream()).resolves.toBe(true)
    await vi.advanceTimersByTimeAsync(1_000)
    await sending

    expect(store.getState().grpcSessionState).toBe('completed')
    expect(store.getState().lastGrpcResult).toMatchObject({ status: 0, statusName: 'OK' })
    expect(
      store.getState().lastGrpcResult?.messages.some((message) => message.direction === 'outbound'),
    ).toBe(true)
  })

  it('keeps an explicit cancelled gRPC terminal result for inspection', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    store.getState().selectRequest('req-grpc-profile')
    store.getState().updateRequest('req-grpc-profile', {
      grpcMethodId: 'grpc-user-import',
      grpcType: 'client-stream',
    })

    const sending = store.getState().sendActiveRequest()
    await vi.advanceTimersByTimeAsync(500)
    store.getState().cancelActiveRequest()
    await sending

    expect(store.getState().grpcSessionState).toBe('cancelled')
    expect(store.getState().lastGrpcResult).toMatchObject({ status: 1, statusName: 'CANCELLED' })
  })

  it('captures new token variables in an environment without seed credentials', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    store.getState().selectEnvironment('env-local')
    await store.getState().runLoginCapture()
    const environment = store.getState().data.environments.find((env) => env.id === 'env-local')
    expect(
      environment?.variables.find((variable) => variable.key === 'access_token'),
    ).toMatchObject({ secret: true, value: expect.stringContaining('demo-access') })
  })

  it('always treats configured auth destinations as secrets regardless of their names', async () => {
    const storage = new MemoryStorageAdapter()
    const store = createPulseStore(storage)
    store.getState().updateAuthProfile('auth-session', {
      accessVariable: 'base_url',
      refreshVariable: 'tenant_id',
    })

    await store.getState().runLoginCapture()

    const environment = store
      .getState()
      .data.environments.find((candidate) => candidate.id === 'env-staging')
    expect(environment?.variables.find((variable) => variable.key === 'base_url')).toMatchObject({
      secret: true,
      value: expect.stringContaining('demo-access'),
    })
    expect(environment?.variables.find((variable) => variable.key === 'tenant_id')).toMatchObject({
      secret: true,
      value: 'pulse-refresh-demo-internal',
    })
    const persisted = storage.read('pulse:workspace:v1:ws-core') ?? ''
    expect(persisted).not.toContain('demo-access')
    expect(persisted).not.toContain('pulse-refresh-demo-internal')
  })

  it('handles invalid capture paths without partial environment writes', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    const before = structuredClone(store.getState().data.environments)
    store.getState().updateAuthProfile(store.getState().data.authProfiles[0]!.id, {
      accessTokenPath: '$.missing',
    })
    await expect(store.getState().runLoginCapture()).resolves.toBeUndefined()
    expect(store.getState().executionState).toBe('error')
    expect(store.getState().data.environments).toEqual(before)
    expect(store.getState().toastMessage).toBeTruthy()
    expect(store.getState().authCaptureError).toBeTruthy()
  })

  it('does not capture credentials from a failed login scenario', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    const before = structuredClone(store.getState().data.environments)
    store.getState().setMockProfile('req-login', { httpScenario: 'unauthorized' })
    await store.getState().runLoginCapture()
    expect(store.getState().executionState).toBe('error')
    expect(store.getState().data.environments).toEqual(before)
    expect(store.getState().authCaptureError).toBeTruthy()
  })

  it.each([{ url: 'not-a-url' }, { body: '{broken' }, { timeoutMs: 1 }])(
    'rejects invalid refresh requests without updating credentials: %o',
    async (patch) => {
      const store = createPulseStore(new MemoryStorageAdapter())
      store.getState().updateRequest('req-login', patch)
      const before = structuredClone(store.getState().data)
      await expect(store.getState().forceRefresh()).resolves.toBe(false)
      expect(store.getState().data.environments).toEqual(before.environments)
      expect(store.getState().data.authProfiles).toEqual(before.authProfiles)
    },
  )

  it('keeps auth capture responses out of a different active workbench request', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    store.getState().selectRequest('req-create-order')
    await store.getState().runLoginCapture()
    store.getState().selectRequest('req-create-order')
    expect(store.getState().lastHttpResponse).toBeNull()
  })

  it('redacts structured secret fields from both body and raw persisted history', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    store.getState().selectRequest('req-create-order')
    store.getState().updateRequest('req-create-order', {
      body: '{"password":"diagnostic-password-Q7","quantity":1}',
    })
    const sending = store.getState().sendActiveRequest()
    await vi.advanceTimersByTimeAsync(1_000)
    await sending
    expect(JSON.stringify(store.getState().data.executions)).not.toContain('diagnostic-password-Q7')
  })

  it('redacts arbitrary marked secret values from persisted diagnostics', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    const variable = store
      .getState()
      .data.environments[0]?.variables.find((row) => row.key === 'access_token')
    expect(variable).toBeDefined()
    store.getState().updateEnvironmentVariable('env-staging', variable!.id, {
      value: 'private-dummy-Q7',
      secret: true,
    })
    store.getState().updateRequest('req-login', {
      url: '{{base_url}}/login?secret={{access_token}}',
    })
    const sending = store.getState().sendActiveRequest()
    await vi.advanceTimersByTimeAsync(1_000)
    await sending
    expect(JSON.stringify(store.getState().data.executions)).not.toContain('private-dummy-Q7')
  })

  it('invalidates pending work when resetting the workspace', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    store.getState().selectRequest('req-create-order')
    const sending = store.getState().sendActiveRequest()
    store.getState().resetWorkspace()
    const before = structuredClone(store.getState().data)
    await vi.advanceTimersByTimeAsync(1_000)
    await sending
    expect(store.getState().data).toEqual(before)
  })

  it('refreshes and retries an unauthorized protected request only once', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    store.getState().selectRequest('req-profile')
    store.getState().setMockProfile('req-profile', { httpScenario: 'unauthorized' })
    const sending = store.getState().sendActiveRequest()
    await vi.advanceTimersByTimeAsync(1_000)
    await sending
    expect(store.getState().lastHttpResponse?.status).toBe(200)
    expect(store.getState().data.environments[0]?.authSessions[0]?.refreshCount).toBe(1)
  })

  it('keeps 401 visible when automatic refresh is disabled', async () => {
    const store = createPulseStore(new MemoryStorageAdapter())
    store.getState().selectRequest('req-profile')
    store.getState().setMockProfile('req-profile', { httpScenario: 'unauthorized' })
    store.getState().updateAuthProfile('auth-session', { autoRefresh: false })
    const sending = store.getState().sendActiveRequest()
    await vi.advanceTimersByTimeAsync(1_000)
    await sending
    expect(store.getState().lastHttpResponse?.status).toBe(401)
    expect(store.getState().data.environments[0]?.authSessions[0]?.refreshCount).toBe(0)
  })
})
