import type { StoreApi } from 'zustand'

import type { GrpcResult, GrpcScenario, JsonValue } from '@/domain/execution/grpc'
import type { HttpExecutionResult, HttpScenario } from '@/domain/execution/http'
import type { RunnerMode, SimulatedRun } from '@/domain/runner/types'
import type {
  ApiRequest,
  AuthProfile,
  Dataset,
  Environment,
  EnvironmentVariable,
  Locale,
  Preferences,
  ThemeMode,
  WorkspaceData,
  WorkspaceInfo,
  WorkspaceSchedule,
  GrpcDefinition,
} from '@/domain/types'
import type { DatasetRow } from '@/lib/datasets/dataset-engine'
import type { prepareRequest } from '@/lib/http/request-resolution'
import type { StorageAdapter } from '@/lib/persistence/types'
import type { TemplateResolution } from '@/lib/variables/variable-engine'
import type { ExecutionClient } from '@/services/execution-client'

export type ExecutionState = 'idle' | 'resolving' | 'running' | 'complete' | 'cancelled' | 'error'
export type AuthOperation = 'idle' | 'login' | 'refresh'

export type GrpcSessionState =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'paused'
  | 'half-closed'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface RunConfiguration {
  requestId: string
  mode: RunnerMode
  datasetId: string
  iterations: number
  workers: number
  durationSeconds: number
  targetRate: number
  rampUpSeconds: number
  holdSeconds: number
  rampDownSeconds: number
  seed: number
}

export interface RunPreflight {
  valid: boolean
  issues: string[]
  target: string
  environment: string
  dataset: string | null
  estimatedIterations: number
}

export interface MockProfile {
  httpScenario: HttpScenario
  grpcScenario: GrpcScenario
}

export interface PulseStoreDependencies {
  storage: StorageAdapter
  executionClient: ExecutionClient
  createWorkspace: (workspaceId?: string) => WorkspaceData
  workspaceDirectory?: WorkspaceInfo[]
}

export interface PulseStoreState {
  data: WorkspaceData
  workspaceDirectory: WorkspaceInfo[]
  preferences: Preferences
  mockProfiles: Record<string, MockProfile>
  executionState: ExecutionState
  lastHttpResponse: HttpExecutionResult | null
  lastGrpcResult: GrpcResult | null
  grpcSessionState: GrpcSessionState
  lastResolution: { url: TemplateResolution; body: TemplateResolution } | null
  requestError: string | null
  authCaptureError: string | null
  authOperation: AuthOperation
  mockNow: string
  commandOpen: boolean
  explorerOpen: boolean
  inspectorOpen: boolean
  runConfig: RunConfiguration
  runState: 'idle' | 'running' | 'paused' | 'complete' | 'stopped' | 'failed'
  runProgress: number
  activeRunResult: SimulatedRun | null
  activeRunConfig: RunConfiguration | null
  toastMessage: string | null
}

export interface PulseStoreActions {
  isPersistent(): boolean
  setTheme(theme: ThemeMode): void
  setLocale(locale: Locale): void
  updatePreferences(preferences: Partial<Preferences>): void
  setCommandOpen(open: boolean): void
  setExplorerOpen(open: boolean): void
  setInspectorOpen(open: boolean): void
  selectWorkspace(workspaceId: string): void
  selectEnvironment(environmentId: string): void
  createEnvironment(name: string): string
  duplicateEnvironment(environmentId: string, name: string): string
  updateEnvironment(
    environmentId: string,
    patch: Partial<Pick<Environment, 'name' | 'color'>>,
  ): void
  deleteEnvironment(environmentId: string): void
  selectRequest(requestId: string): void
  closeTab(requestId: string): void
  pinTab(requestId: string): void
  reorderTab(fromIndex: number, toIndex: number): void
  toggleCollection(collectionId: string): void
  toggleFolder(collectionId: string, folderId: string): void
  createCollection(name: string): string
  renameCollection(collectionId: string, name: string): void
  deleteCollection(collectionId: string): void
  moveCollection(collectionId: string, direction: -1 | 1): void
  createFolder(collectionId: string, name: string): string
  renameFolder(collectionId: string, folderId: string, name: string): void
  deleteFolder(collectionId: string, folderId: string): void
  moveFolder(collectionId: string, folderId: string, direction: -1 | 1): void
  moveRequest(requestId: string, collectionId: string, folderId: string): void
  createRequest(
    protocol: 'http' | 'grpc',
    name: string,
    location?: { collectionId: string; folderId: string },
  ): string
  duplicateRequest(requestId: string, name: string): string
  reopenExecution(executionId: string, name: string): string
  deleteRequest(requestId: string): void
  updateRequest(requestId: string, patch: Partial<ApiRequest>): void
  upsertGrpcDefinition(definition: GrpcDefinition): void
  saveRequest(requestId: string): void
  previewRequest(requestId: string): ReturnType<typeof prepareRequest> | null
  sendActiveRequest(): Promise<void>
  cancelActiveRequest(): void
  sendGrpcMessage(message: JsonValue): Promise<boolean>
  pauseGrpcStream(): void
  resumeGrpcStream(): void
  halfCloseGrpcStream(): Promise<boolean>
  clearGrpcStream(): void
  setHttpResponse(response: HttpExecutionResult | null): void
  setMockProfile(requestId: string, patch: Partial<MockProfile>): void
  updateEnvironmentVariable(
    environmentId: string,
    variableId: string,
    patch: Partial<EnvironmentVariable>,
  ): void
  replaceEnvironmentVariables(environmentId: string, variables: EnvironmentVariable[]): void
  addEnvironmentVariable(environmentId: string): void
  removeEnvironmentVariable(environmentId: string, variableId: string): void
  updateDataset(datasetId: string, patch: Partial<Dataset>): void
  createDataset(name: string): string
  duplicateDataset(datasetId: string, name: string): string
  deleteDataset(datasetId: string): void
  getDatasetRows(datasetId: string, count?: number): DatasetRow[]
  generateDatasetSample(dataset: Dataset): DatasetRow | null
  createSchedule(): string
  updateSchedule(scheduleId: string, patch: Partial<WorkspaceSchedule>): void
  deleteSchedule(scheduleId: string): void
  runScheduleNow(scheduleId: string): void
  updateAuthProfile(profileId: string, patch: Partial<AuthProfile>): void
  runLoginCapture(): Promise<void>
  advanceMockClock(milliseconds: number): void
  forceRefresh(environmentId?: string): Promise<boolean>
  updateRunConfig(patch: Partial<RunConfiguration>): void
  getRunPreflight(): RunPreflight
  startRun(): Promise<void>
  pauseRun(): void
  resumeRun(): void
  stopRun(): void
  resetWorkspace(): void
  showToast(message: string): void
  clearToast(): void
}

export type PulseStore = PulseStoreState & PulseStoreActions
export type PulseSet = StoreApi<PulseStore>['setState']
export type PulseGet = StoreApi<PulseStore>['getState']
