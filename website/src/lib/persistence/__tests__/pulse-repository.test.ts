import { MemoryStorageAdapter } from '@/lib/persistence/memory-storage'
import { PulseRepository } from '@/lib/persistence/pulse-repository'
import { createDemoWorkspace } from '@/mocks/fixtures/demo-workspace'

const createRepository = (storage: MemoryStorageAdapter) =>
  new PulseRepository(storage, createDemoWorkspace)

describe('PulseRepository', () => {
  it('seeds once, persists edits, and resets to the canonical workspace', () => {
    const storage = new MemoryStorageAdapter()
    const repository = createRepository(storage)

    const seeded = repository.load()
    expect(seeded.requests).toHaveLength(4)

    repository.save({ ...seeded, activeEnvironmentId: 'env-local' })
    expect(createRepository(storage).load().activeEnvironmentId).toBe('env-local')

    const reset = repository.reset()
    expect(reset.activeEnvironmentId).toBe('env-staging')
  })

  it('recovers from malformed persisted data without throwing', () => {
    const storage = new MemoryStorageAdapter({ 'pulse:workspace:v1:ws-core': '{broken' })
    const repository = createRepository(storage)

    expect(repository.load().workspace.id).toBe('ws-core')
    expect(repository.lastRecoveryReason).toBe('malformed-json')
  })

  it('migrates auth profiles saved before explicit expiry formats existed', () => {
    const workspace = createDemoWorkspace()
    const legacyWorkspace = structuredClone(workspace) as typeof workspace & {
      authProfiles: Array<Record<string, unknown>>
    }
    Reflect.deleteProperty(
      legacyWorkspace.authProfiles[0] as unknown as Record<string, unknown>,
      'expiryFormat',
    )
    Reflect.deleteProperty(
      legacyWorkspace.authProfiles[0] as unknown as Record<string, unknown>,
      'tokenVersion',
    )
    const storage = new MemoryStorageAdapter({
      'pulse:workspace:v1:ws-core': JSON.stringify(legacyWorkspace),
    })

    expect(createRepository(storage).load().authProfiles[0]?.expiryFormat).toBe(
      'expires-in-seconds',
    )
    expect(createRepository(storage).load().environments[0]?.authSessions[0]?.tokenVersion).toBe(0)
  })

  it('rejects structurally incomplete saved workspaces before the UI renders', () => {
    const storage = new MemoryStorageAdapter({
      'pulse:workspace:v1:ws-core': JSON.stringify({
        schemaVersion: 1,
        requests: [{}],
        environments: [],
      }),
    })
    const repository = createRepository(storage)
    expect(repository.load().workspace.id).toBe('ws-core')
    expect(repository.lastRecoveryReason).toBe('invalid-schema')
  })

  it.each(['authProfiles', 'executions', 'runs', 'openTabs'] as const)(
    'rejects malformed nested %s entries before feature pages receive them',
    (field) => {
      const workspace = createDemoWorkspace()
      const malformed = { ...workspace, [field]: [{}] }
      const storage = new MemoryStorageAdapter({
        'pulse:workspace:v1:ws-core': JSON.stringify(malformed),
      })
      const repository = createRepository(storage)

      expect(repository.load().workspace.id).toBe('ws-core')
      expect(repository.lastRecoveryReason).toBe('invalid-schema')
    },
  )

  it('never persists secret variables, request credentials, or response tokens', () => {
    const storage = new MemoryStorageAdapter()
    const write = vi.spyOn(storage, 'write')
    const repository = createRepository(storage)
    const workspace = repository.load()

    repository.save(workspace)

    const serialized = write.mock.calls.at(-1)?.[1] ?? ''
    expect(serialized).not.toContain('internal-demo-only')
    expect(serialized).not.toContain('eyJhbGciOiJQUzI1NiJ9.demo-access.signature')
    expect(serialized).not.toContain('pulse-refresh-demo-internal')
    const persisted = JSON.parse(serialized) as typeof workspace
    const secretVariables = persisted.environments.flatMap((environment) =>
      environment.variables.filter((variable) => variable.secret),
    )
    expect(secretVariables.every((variable) => !variable.value)).toBe(true)
    expect(persisted.requests.every((request) => request.auth.token === '')).toBe(true)
    expect(persisted.requests.every((request) => request.auth.password === '')).toBe(true)
  })

  it('scrubs environment secrets without mutating live data', () => {
    const storage = new MemoryStorageAdapter()
    const repository = createRepository(storage)
    const workspace = repository.load()
    const secret = 'environment-secret-current'
    workspace.environments[0]!.variables.push({
      id: 'secret-environment',
      key: 'secret_environment',
      value: secret,
      enabled: true,
      secret: true,
      description: '',
    })

    repository.save(workspace)

    const serialized = storage.read('pulse:workspace:v1:ws-core') ?? ''
    expect(serialized).not.toContain('secret-initial')
    expect(serialized).not.toContain('secret-current')
    const persisted = JSON.parse(serialized) as typeof workspace
    const persistedSecrets = [
      persisted.environments[0]!.variables.find(({ id }) => id === 'secret-environment'),
    ]
    expect(persistedSecrets).toEqual([expect.objectContaining({ value: '' })])
    expect(workspace.environments[0]!.variables.at(-1)?.value).toBe(secret)
  })
})
