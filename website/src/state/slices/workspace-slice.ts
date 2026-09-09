import type { GrpcScenario } from '@/domain/execution/grpc'
import type { HttpScenario } from '@/domain/execution/http'
import type {
  ApiRequest,
  Dataset,
  Environment,
  EnvironmentVariable,
  OpenTab,
  WorkspaceSchedule,
} from '@/domain/types'
import { generateDatasetRows } from '@/lib/datasets/dataset-engine'
import { prepareRequest } from '@/lib/http/request-resolution'
import { i18n } from '@/lib/i18n/i18n'
import type { PulseRepository } from '@/lib/persistence/pulse-repository'
import { persistWorkspace as persist } from '@/state/store-helpers'
import { initialRunConfig } from '@/state/store-helpers'
import type { MockProfile, PulseGet, PulseSet, PulseStoreActions } from '@/state/store-types'

type WorkspaceActions = Pick<
  PulseStoreActions,
  | 'selectWorkspace'
  | 'selectEnvironment'
  | 'createEnvironment'
  | 'duplicateEnvironment'
  | 'updateEnvironment'
  | 'deleteEnvironment'
  | 'selectRequest'
  | 'closeTab'
  | 'pinTab'
  | 'reorderTab'
  | 'toggleCollection'
  | 'toggleFolder'
  | 'createCollection'
  | 'renameCollection'
  | 'deleteCollection'
  | 'moveCollection'
  | 'createFolder'
  | 'renameFolder'
  | 'deleteFolder'
  | 'moveFolder'
  | 'moveRequest'
  | 'createRequest'
  | 'duplicateRequest'
  | 'reopenExecution'
  | 'deleteRequest'
  | 'updateRequest'
  | 'upsertGrpcDefinition'
  | 'saveRequest'
  | 'previewRequest'
  | 'updateEnvironmentVariable'
  | 'replaceEnvironmentVariables'
  | 'addEnvironmentVariable'
  | 'removeEnvironmentVariable'
  | 'updateDataset'
  | 'createDataset'
  | 'duplicateDataset'
  | 'deleteDataset'
  | 'getDatasetRows'
  | 'generateDatasetSample'
  | 'createSchedule'
  | 'updateSchedule'
  | 'deleteSchedule'
  | 'runScheduleNow'
>

interface WorkspaceSliceContext {
  repository: PulseRepository
  set: PulseSet
  get: PulseGet
  invalidateRequest(): void
}

const HTTP_SCENARIOS = new Set<HttpScenario>([
  'success',
  'unauthorized',
  'validation',
  'timeout',
  'tls-error',
  'redirect',
  'malformed',
  'empty',
  'binary',
  'oversized',
  'server-error',
])
const GRPC_SCENARIOS = new Set<GrpcScenario>(['success', 'not-found', 'deadline', 'unavailable'])
export const createWorkspaceSlice = ({
  repository,
  set,
  get,
  invalidateRequest,
}: WorkspaceSliceContext): WorkspaceActions => ({
  selectWorkspace: (workspaceId) => {
    const state = get()
    const workspace = state.workspaceDirectory.find((entry) => entry.id === workspaceId)
    if (!workspace || workspace.id === state.data.workspace.id) return

    invalidateRequest()
    const data = repository.load(workspace.id)
    set({
      data,
      lastHttpResponse: null,
      lastGrpcResult: null,
      grpcSessionState: 'idle',
      lastResolution: null,
      requestError: null,
      executionState: 'idle',
      explorerOpen: false,
      runConfig: initialRunConfig,
      runState: 'idle',
      runProgress: 0,
      activeRunResult: null,
      activeRunConfig: null,
    })
  },

  selectEnvironment: (activeEnvironmentId) => {
    if (!get().data.environments.some((environment) => environment.id === activeEnvironmentId))
      return
    const data = persist(repository, { ...get().data, activeEnvironmentId })
    set({ data })
  },

  createEnvironment: (name) => {
    const state = get()
    const id = `env-${crypto.randomUUID()}`
    const environment: Environment = {
      id,
      name: name.trim() || i18n.t('variables.newEnvironment'),
      color: 'blue',
      variables: [],
      authSessions: [],
      updatedAt: new Date().toISOString(),
    }
    const data = persist(repository, {
      ...state.data,
      environments: [...state.data.environments, environment],
    })
    set({ data })
    return id
  },

  duplicateEnvironment: (environmentId, name) => {
    const state = get()
    const source = state.data.environments.find((environment) => environment.id === environmentId)
    if (!source) return ''
    const id = `env-${crypto.randomUUID()}`
    const environment: Environment = {
      ...structuredClone(source),
      id,
      name: name.trim() || `${source.name} copy`,
      variables: source.variables.map((variable) => ({
        ...structuredClone(variable),
        id: `var-${crypto.randomUUID()}`,
        value: variable.secret ? '' : variable.value,
      })),
      authSessions: [],
      updatedAt: new Date().toISOString(),
    }
    const data = persist(repository, {
      ...state.data,
      environments: [...state.data.environments, environment],
    })
    set({ data })
    return id
  },

  updateEnvironment: (environmentId, patch) => {
    const state = get()
    const environments = state.data.environments.map((environment) =>
      environment.id === environmentId
        ? { ...environment, ...patch, updatedAt: new Date().toISOString() }
        : environment,
    )
    set({ data: persist(repository, { ...state.data, environments }) })
  },

  deleteEnvironment: (environmentId) => {
    const state = get()
    if (state.data.environments.length <= 1) return
    const environments = state.data.environments.filter(
      (environment) => environment.id !== environmentId,
    )
    if (environments.length === state.data.environments.length) return
    const activeEnvironmentId =
      state.data.activeEnvironmentId === environmentId
        ? (environments[0]?.id ?? '')
        : state.data.activeEnvironmentId
    set({ data: persist(repository, { ...state.data, environments, activeEnvironmentId }) })
  },

  selectRequest: (requestId) => {
    const state = get()
    if (!state.data.requests.some((request) => request.id === requestId)) return
    if (
      requestId === state.data.activeRequestId &&
      state.data.openTabs.some((tab) => tab.requestId === requestId)
    )
      return
    invalidateRequest()
    const exists = state.data.openTabs.some((tab) => tab.requestId === requestId)
    const openTabs: OpenTab[] = exists
      ? state.data.openTabs
      : [...state.data.openTabs, { requestId, pinned: false }]
    const data = persist(repository, { ...state.data, activeRequestId: requestId, openTabs })
    set({
      data,
      lastHttpResponse: null,
      lastGrpcResult: null,
      requestError: null,
      lastResolution: null,
      executionState: 'idle',
      explorerOpen: false,
    })
  },

  closeTab: (requestId) => {
    const state = get()
    if (state.data.openTabs.find((entry) => entry.requestId === requestId)?.pinned) return
    const openTabs = state.data.openTabs.filter((entry) => entry.requestId !== requestId)
    const activeRequestId =
      state.data.activeRequestId === requestId
        ? (openTabs.at(-1)?.requestId ?? state.data.requests[0]?.id ?? '')
        : state.data.activeRequestId
    const data = persist(repository, { ...state.data, openTabs, activeRequestId })
    if (state.data.activeRequestId !== requestId) {
      set({ data })
      return
    }
    invalidateRequest()
    set({
      data,
      lastHttpResponse: null,
      lastGrpcResult: null,
      requestError: null,
      executionState: 'idle',
    })
  },

  pinTab: (requestId) => {
    const state = get()
    const openTabs = state.data.openTabs.map((tab) =>
      tab.requestId === requestId ? { ...tab, pinned: !tab.pinned } : tab,
    )
    set({ data: persist(repository, { ...state.data, openTabs }) })
  },

  reorderTab: (fromIndex, toIndex) => {
    const state = get()
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= state.data.openTabs.length ||
      toIndex >= state.data.openTabs.length
    )
      return
    const openTabs = [...state.data.openTabs]
    const [moved] = openTabs.splice(fromIndex, 1)
    if (!moved) return
    openTabs.splice(toIndex, 0, moved)
    set({ data: persist(repository, { ...state.data, openTabs }) })
  },

  toggleCollection: (collectionId) => {
    const state = get()
    const collections = state.data.collections.map((collection) =>
      collection.id === collectionId
        ? { ...collection, collapsed: !collection.collapsed }
        : collection,
    )
    set({ data: persist(repository, { ...state.data, collections }) })
  },

  toggleFolder: (collectionId, folderId) => {
    const state = get()
    const collections = state.data.collections.map((collection) =>
      collection.id === collectionId
        ? {
            ...collection,
            folders: collection.folders.map((folder) =>
              folder.id === folderId ? { ...folder, collapsed: !folder.collapsed } : folder,
            ),
          }
        : collection,
    )
    set({ data: persist(repository, { ...state.data, collections }) })
  },

  createCollection: (name) => {
    const state = get()
    const id = `col-${crypto.randomUUID()}`
    const folderId = `fld-${crypto.randomUUID()}`
    set({
      data: persist(repository, {
        ...state.data,
        collections: [
          ...state.data.collections,
          {
            id,
            name: name.trim() || i18n.t('workbench.untitledCollection'),
            description: '',
            accent: 'emerald',
            folders: [{ id: folderId, name: i18n.t('workbench.defaultFolder'), collapsed: false }],
            collapsed: false,
          },
        ],
      }),
    })
    return id
  },

  renameCollection: (collectionId, name) => {
    const nextName = name.trim()
    if (!nextName) return
    const state = get()
    const collections = state.data.collections.map((collection) =>
      collection.id === collectionId ? { ...collection, name: nextName } : collection,
    )
    set({ data: persist(repository, { ...state.data, collections }) })
  },

  deleteCollection: (collectionId) => {
    const state = get()
    if (state.data.collections.length <= 1) return
    const source = state.data.collections.find((collection) => collection.id === collectionId)
    const destination = state.data.collections.find((collection) => collection.id !== collectionId)
    const destinationFolder = destination?.folders[0]
    if (!source || !destination || !destinationFolder) return
    const requests = state.data.requests.map((request) =>
      request.collectionId === collectionId
        ? {
            ...request,
            collectionId: destination.id,
            folderId: destinationFolder.id,
            dirty: true,
          }
        : request,
    )
    const collections = state.data.collections.filter(
      (collection) => collection.id !== collectionId,
    )
    set({ data: persist(repository, { ...state.data, collections, requests }) })
  },

  moveCollection: (collectionId, direction) => {
    const state = get()
    const index = state.data.collections.findIndex((collection) => collection.id === collectionId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= state.data.collections.length) return
    const collections = [...state.data.collections]
    ;[collections[index], collections[target]] = [collections[target]!, collections[index]!]
    set({ data: persist(repository, { ...state.data, collections }) })
  },

  createFolder: (collectionId, name) => {
    const state = get()
    const id = `fld-${crypto.randomUUID()}`
    let created = false
    const collections = state.data.collections.map((collection) => {
      if (collection.id !== collectionId) return collection
      created = true
      return {
        ...collection,
        collapsed: false,
        folders: [
          ...collection.folders,
          { id, name: name.trim() || i18n.t('workbench.untitledFolder'), collapsed: false },
        ],
      }
    })
    if (!created) return ''
    set({ data: persist(repository, { ...state.data, collections }) })
    return id
  },

  renameFolder: (collectionId, folderId, name) => {
    const nextName = name.trim()
    if (!nextName) return
    const state = get()
    const collections = state.data.collections.map((collection) =>
      collection.id === collectionId
        ? {
            ...collection,
            folders: collection.folders.map((folder) =>
              folder.id === folderId ? { ...folder, name: nextName } : folder,
            ),
          }
        : collection,
    )
    set({ data: persist(repository, { ...state.data, collections }) })
  },

  deleteFolder: (collectionId, folderId) => {
    const state = get()
    const collection = state.data.collections.find((entry) => entry.id === collectionId)
    if (!collection || collection.folders.length <= 1) return
    const destinationFolder = collection.folders.find((folder) => folder.id !== folderId)
    if (!destinationFolder || !collection.folders.some((folder) => folder.id === folderId)) return
    const collections = state.data.collections.map((entry) =>
      entry.id === collectionId
        ? { ...entry, folders: entry.folders.filter((folder) => folder.id !== folderId) }
        : entry,
    )
    const requests = state.data.requests.map((request) =>
      request.collectionId === collectionId && request.folderId === folderId
        ? { ...request, folderId: destinationFolder.id, dirty: true }
        : request,
    )
    set({ data: persist(repository, { ...state.data, collections, requests }) })
  },

  moveFolder: (collectionId, folderId, direction) => {
    const state = get()
    const collections = state.data.collections.map((collection) => {
      if (collection.id !== collectionId) return collection
      const index = collection.folders.findIndex((folder) => folder.id === folderId)
      const target = index + direction
      if (index < 0 || target < 0 || target >= collection.folders.length) return collection
      const folders = [...collection.folders]
      ;[folders[index], folders[target]] = [folders[target]!, folders[index]!]
      return { ...collection, folders }
    })
    set({ data: persist(repository, { ...state.data, collections }) })
  },

  moveRequest: (requestId, collectionId, folderId) => {
    const state = get()
    const validDestination = state.data.collections
      .find((collection) => collection.id === collectionId)
      ?.folders.some((folder) => folder.id === folderId)
    if (!validDestination) return
    const requests = state.data.requests.map((request) =>
      request.id === requestId ? { ...request, collectionId, folderId, dirty: true } : request,
    )
    set({ data: persist(repository, { ...state.data, requests }) })
  },

  createRequest: (protocol, name, location) => {
    invalidateRequest()
    const state = get()
    const id = `req-${crypto.randomUUID()}`
    const isGrpc = protocol === 'grpc'
    const preferredCollection = location
      ? state.data.collections.find((collection) => collection.id === location.collectionId)
      : state.data.collections.find((collection) =>
          isGrpc ? collection.id === 'col-grpc' : collection.id === 'col-commerce',
        )
    const collection = preferredCollection ?? state.data.collections[0]
    const preferredFolder = location
      ? collection?.folders.find((folder) => folder.id === location.folderId)
      : collection?.folders.find((folder) =>
          isGrpc ? folder.id === 'fld-grpc-user' : folder.id === 'fld-commerce-order',
        )
    const folder = preferredFolder ?? collection?.folders[0]
    if (!collection || !folder) return ''
    const request: ApiRequest = {
      id,
      collectionId: collection.id,
      folderId: folder.id,
      name,
      description: '',
      protocol,
      method: isGrpc ? 'POST' : 'GET',
      url: isGrpc ? '{{grpc_host}}' : '{{base_url}}/v1/resource',
      bodyMode: isGrpc ? 'json' : 'none',
      body: isGrpc ? '{\n  "id": "{{$random.uuid}}"\n}' : '',
      query: [],
      headers: [],
      cookies: [],
      auth: {
        type: 'inherit',
        token: '{{access_token}}',
        username: '',
        password: '',
        key: 'x-api-key',
        value: '{{api_key}}',
        location: 'header',
      },
      grpcMethodId: isGrpc ? 'grpc-user-get' : '',
      ...(isGrpc && state.data.grpcDefinitions[0]
        ? { grpcDefinitionId: state.data.grpcDefinitions[0].id }
        : {}),
      grpcType: 'unary',
      metadata: isGrpc
        ? [
            {
              id: `metadata-${crypto.randomUUID()}`,
              enabled: true,
              key: 'authorization',
              value: 'Bearer {{access_token}}',
              description: 'RPC credentials',
              secret: true,
            },
          ]
        : [],
      scripts: { preRequest: '', postResponse: '' },
      timeoutMs: 10_000,
      followRedirects: !isGrpc,
      verifyTls: true,
      dirty: true,
    }
    set({
      data: persist(repository, {
        ...state.data,
        requests: [...state.data.requests, request],
        activeRequestId: id,
        openTabs: [...state.data.openTabs, { requestId: id, pinned: false }],
      }),
      lastHttpResponse: null,
      lastGrpcResult: null,
      executionState: 'idle',
    })
    return id
  },

  upsertGrpcDefinition: (definition) => {
    const state = get()
    const index = state.data.grpcDefinitions.findIndex((entry) => entry.id === definition.id)
    const grpcDefinitions = [...state.data.grpcDefinitions]
    if (index >= 0) grpcDefinitions[index] = definition
    else grpcDefinitions.push(definition)
    set({ data: persist(repository, { ...state.data, grpcDefinitions }) })
  },

  duplicateRequest: (requestId, name) => {
    const state = get()
    const source = state.data.requests.find((request) => request.id === requestId)
    if (!source) return ''
    invalidateRequest()
    const request = {
      ...structuredClone(source),
      id: `req-${crypto.randomUUID()}`,
      name,
      dirty: true,
    }
    set({
      data: persist(repository, {
        ...state.data,
        requests: [...state.data.requests, request],
        openTabs: [...state.data.openTabs, { requestId: request.id, pinned: false }],
        activeRequestId: request.id,
      }),
      executionState: 'idle',
      lastHttpResponse: null,
      lastGrpcResult: null,
      lastResolution: null,
      requestError: null,
    })
    return request.id
  },

  reopenExecution: (executionId, name) => {
    const state = get()
    const execution = state.data.executions.find((entry) => entry.id === executionId)
    const source =
      execution?.requestSnapshot ??
      state.data.requests.find((request) => request.id === execution?.requestId)
    if (!execution || !source) return ''
    const collection =
      state.data.collections.find((entry) => entry.id === source.collectionId) ??
      state.data.collections[0]
    const folder =
      collection?.folders.find((entry) => entry.id === source.folderId) ?? collection?.folders[0]
    if (!collection || !folder) return ''
    invalidateRequest()
    const request: ApiRequest = {
      ...structuredClone(source),
      id: `req-${crypto.randomUUID()}`,
      name,
      collectionId: collection.id,
      folderId: folder.id,
      dirty: true,
    }
    const mockProfile = {
      httpScenario:
        execution.protocol === 'http' && HTTP_SCENARIOS.has(execution.scenario as HttpScenario)
          ? (execution.scenario as HttpScenario)
          : 'success',
      grpcScenario:
        execution.protocol === 'grpc' && GRPC_SCENARIOS.has(execution.scenario as GrpcScenario)
          ? (execution.scenario as GrpcScenario)
          : 'success',
    } satisfies MockProfile
    set({
      data: persist(repository, {
        ...state.data,
        requests: [...state.data.requests, request],
        openTabs: [...state.data.openTabs, { requestId: request.id, pinned: false }],
        activeRequestId: request.id,
      }),
      mockProfiles: { ...state.mockProfiles, [request.id]: mockProfile },
      executionState: 'idle',
      lastHttpResponse: null,
      lastGrpcResult: null,
      lastResolution: null,
      requestError: null,
    })
    return request.id
  },

  deleteRequest: (requestId) => {
    const state = get()
    const requests = state.data.requests.filter((request) => request.id !== requestId)
    const openTabs = state.data.openTabs.filter((tab) => tab.requestId !== requestId)
    const activeRequestId =
      state.data.activeRequestId === requestId
        ? (openTabs.at(-1)?.requestId ?? requests[0]?.id ?? '')
        : state.data.activeRequestId
    const data = persist(repository, { ...state.data, requests, openTabs, activeRequestId })
    if (state.data.activeRequestId !== requestId) {
      set({ data })
      return
    }
    invalidateRequest()
    set({
      data,
      executionState: 'idle',
      lastHttpResponse: null,
      lastGrpcResult: null,
      lastResolution: null,
      requestError: null,
    })
  },

  updateRequest: (requestId, patch) => {
    const state = get()
    const requests = state.data.requests.map((request) =>
      request.id === requestId ? { ...request, ...patch, dirty: true } : request,
    )
    set({ data: persist(repository, { ...state.data, requests }) })
  },

  saveRequest: (requestId) => {
    const state = get()
    const requests = state.data.requests.map((request) =>
      request.id === requestId ? { ...request, dirty: false } : request,
    )
    set({ data: persist(repository, { ...state.data, requests }) })
  },

  previewRequest: (requestId) => {
    const { data, mockNow } = get()
    const request = data.requests.find((entry) => entry.id === requestId)
    const environment = data.environments.find((entry) => entry.id === data.activeEnvironmentId)
    return request && environment
      ? prepareRequest(request, environment, {
          now: new Date(mockNow),
        })
      : null
  },

  updateEnvironmentVariable: (environmentId, variableId, patch) => {
    const state = get()
    const environments = state.data.environments.map((environment) =>
      environment.id === environmentId
        ? {
            ...environment,
            variables: environment.variables.map((variable) =>
              variable.id === variableId ? { ...variable, ...patch } : variable,
            ),
            updatedAt: new Date().toISOString(),
          }
        : environment,
    )
    set({ data: persist(repository, { ...state.data, environments }) })
  },

  replaceEnvironmentVariables: (environmentId, variables) => {
    const state = get()
    const environments = state.data.environments.map((environment) =>
      environment.id === environmentId
        ? {
            ...environment,
            variables: structuredClone(variables),
            updatedAt: new Date().toISOString(),
          }
        : environment,
    )
    set({ data: persist(repository, { ...state.data, environments }) })
  },

  addEnvironmentVariable: (environmentId) => {
    const state = get()
    const nextVariable: EnvironmentVariable = {
      id: `var-${crypto.randomUUID()}`,
      key: 'new_variable',
      value: '',
      enabled: true,
      secret: false,
      description: '',
    }
    const environments = state.data.environments.map((environment) =>
      environment.id === environmentId
        ? {
            ...environment,
            variables: [...environment.variables, nextVariable],
            updatedAt: new Date().toISOString(),
          }
        : environment,
    )
    set({ data: persist(repository, { ...state.data, environments }) })
  },

  removeEnvironmentVariable: (environmentId, variableId) => {
    const state = get()
    const environments = state.data.environments.map((environment) =>
      environment.id === environmentId
        ? {
            ...environment,
            variables: environment.variables.filter((variable) => variable.id !== variableId),
            updatedAt: new Date().toISOString(),
          }
        : environment,
    )
    set({ data: persist(repository, { ...state.data, environments }) })
  },

  updateDataset: (datasetId, patch) => {
    const state = get()
    const datasets = state.data.datasets.map((dataset) =>
      dataset.id === datasetId ? { ...dataset, ...patch } : dataset,
    )
    set({ data: persist(repository, { ...state.data, datasets }) })
  },

  createDataset: (name) => {
    const state = get()
    const id = `dataset-${crypto.randomUUID()}`
    const dataset: Dataset = {
      id,
      name: name.trim() || i18n.t('datasets.newDataset'),
      description: '',
      seed: 2026,
      columns: [
        {
          id: `column-${crypto.randomUUID()}`,
          key: 'value',
          valueType: 'string',
          mode: 'fixed',
          value: '',
        },
      ],
    }
    set({
      data: persist(repository, {
        ...state.data,
        datasets: [...state.data.datasets, dataset],
      }),
    })
    return id
  },

  duplicateDataset: (datasetId, name) => {
    const state = get()
    const source = state.data.datasets.find((dataset) => dataset.id === datasetId)
    if (!source) return ''
    const id = `dataset-${crypto.randomUUID()}`
    const dataset: Dataset = {
      ...structuredClone(source),
      id,
      name: name.trim() || `${source.name} copy`,
      columns: source.columns.map((column) => ({
        ...structuredClone(column),
        id: `column-${crypto.randomUUID()}`,
      })),
    }
    set({
      data: persist(repository, {
        ...state.data,
        datasets: [...state.data.datasets, dataset],
      }),
    })
    return id
  },

  deleteDataset: (datasetId) => {
    const state = get()
    if (state.data.datasets.length <= 1) return
    const datasets = state.data.datasets.filter((dataset) => dataset.id !== datasetId)
    if (datasets.length === state.data.datasets.length) return
    set({
      data: persist(repository, { ...state.data, datasets }),
      runConfig:
        state.runConfig.datasetId === datasetId
          ? { ...state.runConfig, datasetId: datasets[0]?.id ?? '' }
          : state.runConfig,
    })
  },

  getDatasetRows: (datasetId, count = 1) => {
    const dataset = get().data.datasets.find((entry) => entry.id === datasetId)
    return dataset ? generateDatasetRows(dataset, count) : []
  },

  generateDatasetSample: (dataset) => generateDatasetRows(dataset, 1)[0] ?? null,

  createSchedule: () => {
    const state = get()
    const id = `schedule-${crypto.randomUUID()}`
    const firstOperation = state.data.requests[0]
    const schedule: WorkspaceSchedule = {
      id,
      name: i18n.t('automations.newSchedule'),
      operationId: firstOperation?.id ?? '',
      enabled: false,
      intervalSeconds: 600,
      lastRunAt: null,
      lastRunStatus: 'idle',
    }
    set({
      data: persist(repository, { ...state.data, schedules: [...state.data.schedules, schedule] }),
    })
    return id
  },

  updateSchedule: (scheduleId, patch) => {
    const state = get()
    const schedules = state.data.schedules.map((schedule) =>
      schedule.id === scheduleId ? { ...schedule, ...patch } : schedule,
    )
    set({ data: persist(repository, { ...state.data, schedules }) })
  },

  deleteSchedule: (scheduleId) => {
    const state = get()
    const schedules = state.data.schedules.filter((schedule) => schedule.id !== scheduleId)
    if (schedules.length === state.data.schedules.length) return
    set({ data: persist(repository, { ...state.data, schedules }) })
  },

  runScheduleNow: (scheduleId) => {
    const state = get()
    const schedule = state.data.schedules.find((entry) => entry.id === scheduleId)
    if (!schedule) return
    const now = new Date(state.mockNow).toISOString()
    const schedules = state.data.schedules.map((entry) =>
      entry.id === scheduleId
        ? {
            ...entry,
            lastRunAt: now,
            lastRunStatus: entry.operationId ? ('success' as const) : ('failed' as const),
          }
        : entry,
    )
    set({ data: persist(repository, { ...state.data, schedules }) })
  },
})
