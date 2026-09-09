import type { GrpcCallType, GrpcResult } from '@/domain/execution/grpc'
import type { HttpExecutionResult } from '@/domain/execution/http'
import type { RunnerMode, SimulatedRun } from '@/domain/runner/types'

export type {
  GrpcCallType,
  GrpcExecutionEvent,
  GrpcExecutionInput,
  GrpcResult,
  GrpcScenario,
  JsonValue,
} from '@/domain/execution/grpc'
export type {
  HttpExecutionInput,
  HttpExecutionResult,
  HttpScenario,
  HttpTiming,
} from '@/domain/execution/http'
export type {
  RunnerMode,
  RunnerSample,
  SimulatedRun,
  TestRunEvent,
  TestRunPlan,
} from '@/domain/runner/types'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'
export type Locale = 'vi' | 'en'
export type Density = 'comfortable' | 'compact'
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
export type BodyMode = 'none' | 'json' | 'text' | 'form' | 'graphql'
export type RequestProtocol = 'http' | 'grpc'

export interface Preferences {
  theme: ThemeMode
  locale: Locale
  density: Density
  editorFontSize: number
}

export interface WorkspaceInfo {
  id: string
  name: string
  description: string
}

export interface KeyValueRow {
  id: string
  enabled: boolean
  key: string
  value: string
  description: string
  secret?: boolean
}

export interface RequestAuth {
  type: 'inherit' | 'none' | 'bearer' | 'basic' | 'api-key' | 'oauth2'
  token: string
  username: string
  password: string
  key: string
  value: string
  location: 'header' | 'query'
}

/** User-authored hooks. The browser stores source only; execution belongs to a future sandbox. */
export interface RequestScripts {
  preRequest: string
  postResponse: string
}

export interface ApiRequest {
  id: string
  collectionId: string
  folderId: string
  name: string
  description: string
  protocol: RequestProtocol
  method: HttpMethod
  url: string
  bodyMode: BodyMode
  body: string
  query: KeyValueRow[]
  headers: KeyValueRow[]
  cookies: KeyValueRow[]
  auth: RequestAuth
  grpcMethodId: string
  /** The contract that owns grpcMethodId. Optional for workspaces saved before definition management. */
  grpcDefinitionId?: string
  grpcType: GrpcCallType
  metadata: KeyValueRow[]
  scripts: RequestScripts
  timeoutMs: number
  followRedirects: boolean
  verifyTls: boolean
  dirty?: boolean
}

export interface FolderNode {
  id: string
  name: string
  collapsed?: boolean
}

export interface CollectionNode {
  id: string
  name: string
  description: string
  accent: 'emerald' | 'blue' | 'amber' | 'violet'
  folders: FolderNode[]
  collapsed: boolean
}

export interface EnvironmentVariable {
  id: string
  key: string
  value: string
  enabled: boolean
  secret: boolean
  description: string
}

export interface EnvironmentAuthSession {
  profileId: string
  lastCapturedAt: string | null
  expiresAt: string | null
  refreshCount: number
  tokenVersion: number
}

export interface Environment {
  id: string
  name: string
  color: 'emerald' | 'blue' | 'amber'
  variables: EnvironmentVariable[]
  authSessions: EnvironmentAuthSession[]
  updatedAt: string
}

export interface DatasetColumn {
  id: string
  key: string
  valueType?: 'string' | 'number' | 'boolean'
  mode: 'fixed' | 'sequence' | 'random-email' | 'random-uuid' | 'random-int' | 'pick'
  value: string
}

export interface Dataset {
  id: string
  name: string
  description: string
  /** Internal deterministic fallback for the local runner; not user-facing configuration. */
  seed: number
  columns: DatasetColumn[]
}

/** A workspace-owned recurring operation for a saved request. */
export interface WorkspaceSchedule {
  id: string
  name: string
  operationId: string
  enabled: boolean
  intervalSeconds: number
  lastRunAt: string | null
  lastRunStatus: 'idle' | 'success' | 'failed'
}

export type AuthExpiryFormat =
  'expires-in-seconds' | 'iso-8601' | 'unix-seconds' | 'unix-milliseconds'

export interface AuthProfile {
  id: string
  name: string
  loginRequestId: string
  refreshRequestId: string
  accessTokenPath: string
  refreshTokenPath: string
  expiresInPath: string
  expiryFormat: AuthExpiryFormat
  accessVariable: string
  refreshVariable: string
  refreshWindowSeconds: number
  autoRefresh: boolean
}

export interface GrpcMethodDefinition {
  id: string
  service: string
  name: string
  packageName: string
  type: GrpcCallType
  requestType: string
  responseType: string
  description: string
}

export interface GrpcDefinition {
  id: string
  name: string
  source: 'reflection' | 'proto'
  endpoint: string
  secure: boolean
  methods: GrpcMethodDefinition[]
}

export interface RequestExecution {
  id: string
  requestId: string
  requestName: string
  protocol: RequestProtocol
  scenario: string
  startedAt: string
  duration: number
  status: number
  statusText: string
  environmentId: string
  environmentName: string
  /** Redacted effective request context captured at send time. */
  trace?: {
    endpoint: string
    body: string
    headers: Array<{ key: string; value: string }>
  }
  requestSnapshot?: ApiRequest
  http?: HttpExecutionResult
  grpc?: GrpcResult
}

export interface RunRecord {
  id: string
  name: string
  requestId: string
  mode: RunnerMode
  startedAt: string
  durationSeconds: number
  workers: number
  targetRate: number
  seed?: number
  datasetId?: string
  iterations?: number
  rampUpSeconds?: number
  holdSeconds?: number
  rampDownSeconds?: number
  environmentId?: string
  environmentName?: string
  result: SimulatedRun
  status: 'passed' | 'failed' | 'stopped'
  /** Immutable, redacted context captured when the run began, so history stays useful after edits. */
  trace?: {
    target: {
      name: string
      protocol: RequestProtocol
      operation: string
      endpoint: string
    }
    dataset?: {
      id: string
      name: string
      columnCount: number
    }
    estimatedIterations: number
  }
}

export interface OpenTab {
  requestId: string
  pinned: boolean
}

export interface WorkspaceData {
  schemaVersion: 1
  workspace: WorkspaceInfo
  collections: CollectionNode[]
  requests: ApiRequest[]
  environments: Environment[]
  datasets: Dataset[]
  schedules: WorkspaceSchedule[]
  authProfiles: AuthProfile[]
  grpcDefinitions: GrpcDefinition[]
  executions: RequestExecution[]
  runs: RunRecord[]
  openTabs: OpenTab[]
  activeRequestId: string
  activeEnvironmentId: string
}

export interface ResolvedVariableRow {
  key: string
  value: string
  scope: string
  secret: boolean
}
