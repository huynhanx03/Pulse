import type { AuthExpiryFormat, Dataset, WorkspaceData } from '@/domain/types'
import type { StorageAdapter } from '@/lib/persistence/types'
import { createSafeRequestSnapshot, redactSensitiveData } from '@/lib/security/redaction'

const workspaceKey = (workspaceId: string) => `pulse:workspace:v1:${workspaceId}`
const LEGACY_WORKSPACE_KEY = 'pulse:workspace:v1'
const DEFAULT_WORKSPACE_ID = 'ws-core'

const clone = <T>(value: T): T => structuredClone(value)
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isString = (value: unknown): value is string => typeof value === 'string'
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'
const isArrayOf = <T>(value: unknown, predicate: (entry: unknown) => boolean): value is T[] =>
  Array.isArray(value) && value.every(predicate)

const isKeyValueRow = (value: unknown): boolean =>
  isRecord(value) &&
  isString(value.id) &&
  isBoolean(value.enabled) &&
  isString(value.key) &&
  isString(value.value) &&
  isString(value.description) &&
  (value.secret === undefined || isBoolean(value.secret))

const isRequestAuth = (value: unknown): boolean =>
  isRecord(value) &&
  ['inherit', 'none', 'bearer', 'basic', 'api-key', 'oauth2'].includes(String(value.type)) &&
  [value.token, value.username, value.password, value.key, value.value].every(isString) &&
  ['header', 'query'].includes(String(value.location))

const isApiRequest = (value: unknown): boolean =>
  isRecord(value) &&
  [
    value.id,
    value.collectionId,
    value.folderId,
    value.name,
    value.description,
    value.url,
    value.body,
    value.grpcMethodId,
  ].every(isString) &&
  ['http', 'grpc'].includes(String(value.protocol)) &&
  ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(String(value.method)) &&
  ['none', 'json', 'text', 'form', 'graphql'].includes(String(value.bodyMode)) &&
  ['unary', 'server-stream', 'client-stream', 'bidi-stream'].includes(String(value.grpcType)) &&
  isArrayOf(value.query, isKeyValueRow) &&
  isArrayOf(value.headers, isKeyValueRow) &&
  (value.cookies === undefined || isArrayOf(value.cookies, isKeyValueRow)) &&
  isRequestAuth(value.auth) &&
  isArrayOf(value.metadata, isKeyValueRow) &&
  (value.scripts === undefined ||
    (isRecord(value.scripts) &&
      isString(value.scripts.preRequest) &&
      isString(value.scripts.postResponse))) &&
  isNumber(value.timeoutMs) &&
  isBoolean(value.followRedirects) &&
  isBoolean(value.verifyTls) &&
  (value.dirty === undefined || isBoolean(value.dirty))

const isEnvironmentVariable = (value: unknown): boolean =>
  isRecord(value) &&
  [value.id, value.key, value.description].every(isString) &&
  (isString(value.value) || isString(value.currentValue) || isString(value.initialValue)) &&
  isBoolean(value.enabled) &&
  isBoolean(value.secret)

const isEnvironment = (value: unknown): boolean =>
  isRecord(value) &&
  [value.id, value.name, value.updatedAt].every(isString) &&
  ['emerald', 'blue', 'amber'].includes(String(value.color)) &&
  isArrayOf(value.variables, isEnvironmentVariable) &&
  (value.authSessions === undefined ||
    isArrayOf(value.authSessions, (session) =>
      Boolean(
        isRecord(session) &&
        isString(session.profileId) &&
        (session.lastCapturedAt === null || isString(session.lastCapturedAt)) &&
        (session.expiresAt === null || isString(session.expiresAt)) &&
        isNumber(session.refreshCount) &&
        isNumber(session.tokenVersion),
      ),
    ))

const isCollection = (value: unknown): boolean =>
  isRecord(value) &&
  [value.id, value.name, value.description].every(isString) &&
  ['emerald', 'blue', 'amber', 'violet'].includes(String(value.accent)) &&
  isBoolean(value.collapsed) &&
  isArrayOf(value.folders, (folder): folder is Record<string, unknown> =>
    Boolean(isRecord(folder) && isString(folder.id) && isString(folder.name)),
  )

const isDataset = (value: unknown): boolean =>
  isRecord(value) &&
  [value.id, value.name, value.description].every(isString) &&
  isNumber(value.seed) &&
  isArrayOf(value.columns, (column): column is Record<string, unknown> =>
    Boolean(
      isRecord(column) &&
      [column.id, column.key, column.value].every(isString) &&
      ['fixed', 'sequence', 'random-email', 'random-uuid', 'random-int', 'pick'].includes(
        String(column.mode),
      ) &&
      (column.valueType === undefined ||
        ['string', 'number', 'boolean'].includes(String(column.valueType))),
    ),
  )

const isAuthProfile = (value: unknown): boolean =>
  isRecord(value) &&
  [
    value.id,
    value.name,
    value.loginRequestId,
    value.refreshRequestId,
    value.accessTokenPath,
    value.refreshTokenPath,
    value.expiresInPath,
    value.accessVariable,
    value.refreshVariable,
  ].every(isString) &&
  (value.expiryFormat === undefined ||
    ['expires-in-seconds', 'iso-8601', 'unix-seconds', 'unix-milliseconds'].includes(
      String(value.expiryFormat),
    )) &&
  isNumber(value.refreshWindowSeconds) &&
  isBoolean(value.autoRefresh)

const isMetadataRow = (value: unknown): boolean =>
  isRecord(value) && isString(value.key) && isString(value.value)

const isGrpcResult = (value: unknown): boolean =>
  isRecord(value) &&
  isNumber(value.status) &&
  isString(value.statusName) &&
  isNumber(value.duration) &&
  isArrayOf(value.messages, (message): message is Record<string, unknown> =>
    Boolean(
      isRecord(message) &&
      isString(message.id) &&
      ['outbound', 'inbound', 'system'].includes(String(message.direction)) &&
      isNumber(message.atMs) &&
      isString(message.payload),
    ),
  ) &&
  isArrayOf(value.headers, (entry): entry is Record<string, unknown> =>
    Boolean(isMetadataRow(entry)),
  ) &&
  isArrayOf(value.trailers, (entry): entry is Record<string, unknown> =>
    Boolean(isMetadataRow(entry)),
  )

const isSchedule = (value: unknown): boolean =>
  isRecord(value) &&
  [value.id, value.name, value.operationId].every(isString) &&
  isBoolean(value.enabled) &&
  isNumber(value.intervalSeconds) &&
  (value.lastRunAt === null || isString(value.lastRunAt)) &&
  ['idle', 'success', 'failed'].includes(String(value.lastRunStatus))

const isHttpResult = (value: unknown): boolean =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.requestId) &&
  isNumber(value.status) &&
  isString(value.statusText) &&
  isNumber(value.size) &&
  isString(value.rawBody) &&
  isArrayOf(value.headers, (entry): entry is Record<string, unknown> =>
    Boolean(isMetadataRow(entry)),
  ) &&
  Array.isArray(value.cookies) &&
  Array.isArray(value.tests) &&
  Array.isArray(value.console) &&
  isRecord(value.timings) &&
  ['queued', 'dns', 'connect', 'tls', 'upload', 'ttfb', 'download', 'total'].every((key) =>
    isNumber((value.timings as Record<string, unknown>)[key]),
  ) &&
  isArrayOf(value.redirects, isString)

const isExecutionTrace = (value: unknown): boolean =>
  isRecord(value) &&
  [value.endpoint, value.body].every(isString) &&
  isArrayOf(value.headers, (entry): entry is Record<string, unknown> =>
    Boolean(isMetadataRow(entry)),
  )

const isExecution = (value: unknown): boolean =>
  isRecord(value) &&
  [
    value.id,
    value.requestId,
    value.requestName,
    value.scenario,
    value.startedAt,
    value.statusText,
  ].every(isString) &&
  ['http', 'grpc'].includes(String(value.protocol)) &&
  isNumber(value.duration) &&
  isNumber(value.status) &&
  (value.environmentId === undefined || isString(value.environmentId)) &&
  (value.environmentName === undefined || isString(value.environmentName)) &&
  (value.trace === undefined || isExecutionTrace(value.trace)) &&
  (value.requestSnapshot === undefined || isApiRequest(value.requestSnapshot)) &&
  (value.http === undefined || isHttpResult(value.http)) &&
  (value.grpc === undefined || isGrpcResult(value.grpc))

const isSimulatedRun = (value: unknown): boolean =>
  isRecord(value) &&
  isRecord(value.metrics) &&
  [
    'total',
    'passed',
    'failures',
    'dropped',
    'throughput',
    'p50',
    'p95',
    'p99',
    'collisionRate',
  ].every((key) => isNumber((value.metrics as Record<string, unknown>)[key])) &&
  isArrayOf(value.series, (point): point is Record<string, unknown> =>
    Boolean(
      isRecord(point) &&
      ['second', 'throughput', 'p95', 'errors', 'active', 'dropped'].every((key) =>
        isNumber(point[key]),
      ),
    ),
  ) &&
  isArrayOf(value.checks, (check): check is Record<string, unknown> =>
    Boolean(
      isRecord(check) && isString(check.name) && isNumber(check.passed) && isNumber(check.failed),
    ),
  ) &&
  isArrayOf(value.collisions, (collision): collision is Record<string, unknown> =>
    Boolean(
      isRecord(collision) &&
      isString(collision.resource) &&
      ['attempts', 'winners', 'conflicts'].every((key) => isNumber(collision[key])),
    ),
  ) &&
  Array.isArray(value.iterations)

const isRunTrace = (value: unknown): boolean =>
  isRecord(value) &&
  isRecord(value.target) &&
  [value.target.name, value.target.operation, value.target.endpoint].every(isString) &&
  ['http', 'grpc'].includes(String(value.target.protocol)) &&
  isNumber(value.estimatedIterations) &&
  (value.dataset === undefined ||
    (isRecord(value.dataset) &&
      [value.dataset.id, value.dataset.name].every(isString) &&
      isNumber(value.dataset.columnCount)))

const isRunRecord = (value: unknown): boolean =>
  isRecord(value) &&
  [value.id, value.name, value.requestId, value.startedAt].every(isString) &&
  ['functional', 'data', 'race', 'constant-vus', 'ramping-vus', 'arrival-rate'].includes(
    String(value.mode),
  ) &&
  [value.durationSeconds, value.workers, value.targetRate].every(isNumber) &&
  ['passed', 'failed', 'stopped'].includes(String(value.status)) &&
  isSimulatedRun(value.result) &&
  (value.trace === undefined || isRunTrace(value.trace))

const isGrpcDefinition = (value: unknown): boolean =>
  isRecord(value) &&
  [value.id, value.name, value.endpoint].every(isString) &&
  ['reflection', 'proto'].includes(String(value.source)) &&
  isBoolean(value.secure) &&
  isArrayOf(value.methods, (method): method is Record<string, unknown> =>
    Boolean(
      isRecord(method) &&
      [
        method.id,
        method.service,
        method.name,
        method.packageName,
        method.requestType,
        method.responseType,
        method.description,
      ].every(isString) &&
      ['unary', 'server-stream', 'client-stream', 'bidi-stream'].includes(String(method.type)),
    ),
  )

const isOpenTab = (value: unknown): boolean =>
  isRecord(value) && isString(value.requestId) && isBoolean(value.pinned)

const normalizeRequest = (request: WorkspaceData['requests'][number]) => {
  const legacy = clone(request) as WorkspaceData['requests'][number] & {
    scenario?: unknown
    grpcScenario?: unknown
    testCases?: unknown
    dataBindings?: unknown
    preActions?: unknown
    postActions?: unknown
  }
  const {
    scenario: _scenario,
    grpcScenario: _grpcScenario,
    testCases: _testCases,
    dataBindings: _dataBindings,
    preActions: _preActions,
    postActions: _postActions,
    ...normalized
  } = legacy
  return {
    ...normalized,
    cookies: Array.isArray(request.cookies) ? request.cookies : [],
  }
}

const AUTH_EXPIRY_FORMATS = new Set<AuthExpiryFormat>([
  'expires-in-seconds',
  'iso-8601',
  'unix-seconds',
  'unix-milliseconds',
])

const normalizeAuthProfile = (profile: WorkspaceData['authProfiles'][number]) => {
  const legacy = clone(profile) as WorkspaceData['authProfiles'][number] & Record<string, unknown>
  const {
    lastCapturedAt: _lastCapturedAt,
    expiresAt: _expiresAt,
    refreshCount: _refreshCount,
    tokenVersion: _tokenVersion,
    ...normalized
  } = legacy
  return {
    ...normalized,
    expiryFormat: AUTH_EXPIRY_FORMATS.has(profile.expiryFormat)
      ? profile.expiryFormat
      : ('expires-in-seconds' as const),
  }
}

type LegacyEnvironmentVariable = {
  initialValue?: unknown
  currentValue?: unknown
  value?: unknown
}

type LegacyAuthRuntime = {
  lastCapturedAt?: unknown
  expiresAt?: unknown
  refreshCount?: unknown
  tokenVersion?: unknown
}

const legacyAuthSession = (profile: WorkspaceData['authProfiles'][number]): LegacyAuthRuntime =>
  clone(profile) as WorkspaceData['authProfiles'][number] & LegacyAuthRuntime

const normalizeWorkspace = (data: WorkspaceData): WorkspaceData => {
  const profiles = data.authProfiles.map(normalizeAuthProfile)
  const legacySessions = new Map(
    profiles.map((profile, index) => [profile.id, legacyAuthSession(data.authProfiles[index]!)]),
  )
  return {
    ...clone(data),
    datasets: data.datasets.map((dataset) => {
      const {
        source: _source,
        importedRows: _importedRows,
        rows: _rows,
        ...normalized
      } = dataset as Dataset & {
        source?: unknown
        importedRows?: unknown
        rows?: unknown
      }
      return {
        ...normalized,
        columns: normalized.columns.map((column) => ({
          ...column,
          valueType: column.valueType ?? (column.mode === 'random-int' ? 'number' : 'string'),
        })),
      }
    }),
    requests: data.requests.map(normalizeRequest),
    environments: data.environments.map((environment) => {
      const existingSessions = Array.isArray(environment.authSessions)
        ? clone(environment.authSessions)
        : []
      const migratedSessions = existingSessions.length
        ? existingSessions
        : profiles.flatMap((profile) => {
            const legacy = legacySessions.get(profile.id)
            if (!legacy) return []
            const hasLegacyRuntime = [
              legacy.lastCapturedAt,
              legacy.expiresAt,
              legacy.refreshCount,
              legacy.tokenVersion,
            ].some((value) => value !== undefined)
            return hasLegacyRuntime
              ? [
                  {
                    profileId: profile.id,
                    lastCapturedAt: isString(legacy.lastCapturedAt) ? legacy.lastCapturedAt : null,
                    expiresAt: isString(legacy.expiresAt) ? legacy.expiresAt : null,
                    refreshCount: isNumber(legacy.refreshCount) ? legacy.refreshCount : 0,
                    tokenVersion: isNumber(legacy.tokenVersion) ? legacy.tokenVersion : 0,
                  },
                ]
              : []
          })
      return {
        ...clone(environment),
        authSessions: migratedSessions,
        variables: environment.variables.map((variable) => {
          const legacy = variable as typeof variable & LegacyEnvironmentVariable
          const { initialValue: _initialValue, currentValue: _currentValue, ...normalized } = legacy
          return {
            ...normalized,
            value: isString(legacy.value)
              ? legacy.value
              : isString(legacy.currentValue)
                ? legacy.currentValue
                : isString(legacy.initialValue)
                  ? legacy.initialValue
                  : '',
          }
        }),
      }
    }),
    authProfiles: profiles,
    schedules: Array.isArray(data.schedules)
      ? clone(data.schedules)
      : profiles.slice(0, 1).map((profile) => ({
          id: `schedule-${profile.id}`,
          name: 'Token refresh',
          operationId: '',
          enabled: false,
          intervalSeconds: 600,
          lastRunAt: null,
          lastRunStatus: 'idle' as const,
        })),
    executions: data.executions.map((execution) => ({
      ...clone(execution),
      environmentId: execution.environmentId ?? data.activeEnvironmentId,
      environmentName:
        execution.environmentName ??
        data.environments.find((environment) => environment.id === data.activeEnvironmentId)
          ?.name ??
        '',
      ...(execution.requestSnapshot
        ? { requestSnapshot: normalizeRequest(execution.requestSnapshot) }
        : {}),
    })),
  }
}

const sanitizeForPersistence = (data: WorkspaceData): WorkspaceData => ({
  ...clone(data),
  requests: data.requests.map((request) => ({
    ...normalizeRequest(request),
    auth: {
      ...request.auth,
      token: '',
      password: '',
      value: request.auth.type === 'api-key' ? '' : request.auth.value,
    },
  })),
  environments: data.environments.map((environment) => ({
    ...clone(environment),
    variables: environment.variables.map((entry) => {
      const { initialValue: _initialValue, ...variable } = entry as typeof entry &
        LegacyEnvironmentVariable
      return variable.secret ? { ...variable, value: '' } : variable
    }),
  })),
  executions: data.executions.slice(0, 200).map((execution) => {
    const { requestSnapshot, ...result } = execution
    return {
      ...(redactSensitiveData(result) as Omit<typeof execution, 'requestSnapshot'>),
      ...(requestSnapshot ? { requestSnapshot: createSafeRequestSnapshot(requestSnapshot) } : {}),
    }
  }),
  runs: redactSensitiveData(data.runs.slice(0, 100)) as WorkspaceData['runs'],
})

const isWorkspaceData = (value: unknown): value is WorkspaceData => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<WorkspaceData>
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.workspace?.id === 'string' &&
    typeof candidate.workspace?.name === 'string' &&
    typeof candidate.workspace?.description === 'string' &&
    typeof candidate.activeEnvironmentId === 'string' &&
    typeof candidate.activeRequestId === 'string' &&
    isArrayOf(candidate.requests, (entry): entry is WorkspaceData['requests'][number] =>
      isApiRequest(entry),
    ) &&
    isArrayOf(candidate.environments, (entry): entry is WorkspaceData['environments'][number] =>
      isEnvironment(entry),
    ) &&
    isArrayOf(candidate.collections, (entry): entry is WorkspaceData['collections'][number] =>
      isCollection(entry),
    ) &&
    isArrayOf(candidate.datasets, (entry): entry is WorkspaceData['datasets'][number] =>
      isDataset(entry),
    ) &&
    (candidate.schedules === undefined ||
      isArrayOf(candidate.schedules, (entry): entry is WorkspaceData['schedules'][number] =>
        isSchedule(entry),
      )) &&
    isArrayOf(
      candidate.grpcDefinitions,
      (entry): entry is WorkspaceData['grpcDefinitions'][number] => isGrpcDefinition(entry),
    ) &&
    isArrayOf(candidate.authProfiles, (entry): entry is WorkspaceData['authProfiles'][number] =>
      isAuthProfile(entry),
    ) &&
    isArrayOf(candidate.executions, (entry): entry is WorkspaceData['executions'][number] =>
      isExecution(entry),
    ) &&
    isArrayOf(candidate.runs, (entry): entry is WorkspaceData['runs'][number] =>
      isRunRecord(entry),
    ) &&
    isArrayOf(candidate.openTabs, (entry): entry is WorkspaceData['openTabs'][number] =>
      isOpenTab(entry),
    )
  )
}

export class PulseRepository {
  lastRecoveryReason: 'malformed-json' | 'invalid-schema' | null = null
  readonly #storage: StorageAdapter
  readonly #createWorkspace: (workspaceId?: string) => WorkspaceData

  constructor(storage: StorageAdapter, createWorkspace: (workspaceId?: string) => WorkspaceData) {
    this.#storage = storage
    this.#createWorkspace = createWorkspace
  }

  load(workspaceId = DEFAULT_WORKSPACE_ID): WorkspaceData {
    const scopedKey = workspaceKey(workspaceId)
    const stored =
      this.#storage.read(scopedKey) ??
      (workspaceId === DEFAULT_WORKSPACE_ID ? this.#storage.read(LEGACY_WORKSPACE_KEY) : null)
    if (!stored) return this.#seed(workspaceId)

    try {
      const parsed: unknown = JSON.parse(stored)
      if (!isWorkspaceData(parsed)) {
        this.lastRecoveryReason = 'invalid-schema'
        return this.#seed(workspaceId)
      }
      const normalized = normalizeWorkspace(parsed)
      if (this.#storage.read(scopedKey) === null) this.save(normalized)
      return normalized
    } catch {
      this.lastRecoveryReason = 'malformed-json'
      return this.#seed(workspaceId)
    }
  }

  save(data: WorkspaceData): void {
    this.#storage.write(
      workspaceKey(data.workspace.id),
      JSON.stringify(sanitizeForPersistence(data)),
    )
  }

  reset(workspaceId = DEFAULT_WORKSPACE_ID): WorkspaceData {
    this.#storage.remove(workspaceKey(workspaceId))
    return this.#seed(workspaceId)
  }

  #seed(workspaceId: string): WorkspaceData {
    const seeded = this.#createWorkspace(workspaceId)
    this.save(seeded)
    return clone(seeded)
  }
}
