import type { GrpcResult } from '@/domain/execution/grpc'
import type { HttpExecutionResult } from '@/domain/execution/http'
import type { RequestExecution } from '@/domain/types'
import { captureTokens, shouldRefresh } from '@/lib/auth/auth-engine'
import {
  getEnvironmentAuthSession,
  updateEnvironmentAuthSession,
} from '@/lib/auth/environment-session'
import { prepareRequest } from '@/lib/http/request-resolution'
import { i18n } from '@/lib/i18n/i18n'
import type { PulseRepository } from '@/lib/persistence/pulse-repository'
import { createSafeRequestSnapshot, redactSensitiveData } from '@/lib/security/redaction'
import {
  ExecutionAbortedError,
  type ExecutionClient,
  type GrpcExecutionSession,
} from '@/services/execution-client'
import { applyEnvironmentWrites, persistWorkspace as persist } from '@/state/store-helpers'
import type { PulseGet, PulseSet, PulseStoreActions } from '@/state/store-types'

type ExecutionActions = Pick<
  PulseStoreActions,
  | 'sendActiveRequest'
  | 'cancelActiveRequest'
  | 'sendGrpcMessage'
  | 'pauseGrpcStream'
  | 'resumeGrpcStream'
  | 'halfCloseGrpcStream'
  | 'clearGrpcStream'
  | 'setHttpResponse'
  | 'setMockProfile'
  | 'updateAuthProfile'
  | 'runLoginCapture'
  | 'advanceMockClock'
  | 'forceRefresh'
>

interface ExecutionSliceContext {
  executionClient: ExecutionClient
  repository: PulseRepository
  set: PulseSet
  get: PulseGet
}

export interface ExecutionSlice {
  actions: ExecutionActions
  invalidate(): void
  reset(): void
}

export const createExecutionSlice = ({
  executionClient,
  repository,
  set,
  get,
}: ExecutionSliceContext): ExecutionSlice => {
  let requestSequence = 0
  let activeRequestController: AbortController | null = null
  let activeGrpcSession: GrpcExecutionSession | null = null
  const refreshInFlight = new Map<string, Promise<boolean>>()
  const refreshControllers = new Map<string, AbortController>()
  const captureRequestTrace = (
    prepared: ReturnType<typeof prepareRequest>,
    headers = prepared.headers,
  ): NonNullable<RequestExecution['trace']> => ({
    endpoint: redactSensitiveData(prepared.url.value, '', prepared.secrets) as string,
    body: redactSensitiveData(prepared.body.value, '', prepared.secrets) as string,
    headers: headers.map((header) => ({
      key: header.key,
      value: redactSensitiveData(header.value, header.key, prepared.secrets) as string,
    })),
  })
  const cancelRefreshes = () => {
    for (const controller of refreshControllers.values()) controller.abort()
    refreshControllers.clear()
    refreshInFlight.clear()
  }
  const getHttpScenario = (requestId: string) =>
    get().mockProfiles[requestId]?.httpScenario ?? 'success'
  const getGrpcScenario = (requestId: string) =>
    get().mockProfiles[requestId]?.grpcScenario ?? 'success'

  return {
    actions: {
      setMockProfile: (requestId, patch) =>
        set((state) => ({
          mockProfiles: {
            ...state.mockProfiles,
            [requestId]: {
              httpScenario: 'success',
              grpcScenario: 'success',
              ...state.mockProfiles[requestId],
              ...patch,
            },
          },
        })),

      sendActiveRequest: async () => {
        activeGrpcSession?.cancel()
        activeGrpcSession = null
        activeRequestController?.abort()
        set({ authOperation: 'idle' })
        const controller = new AbortController()
        activeRequestController = controller
        const sequence = ++requestSequence
        let state = get()
        const request = state.data.requests.find((entry) => entry.id === state.data.activeRequestId)
        let environment = state.data.environments.find(
          (entry) => entry.id === state.data.activeEnvironmentId,
        )
        if (!request || !environment) return

        const profile = state.data.authProfiles[0]
        const authSession = profile ? getEnvironmentAuthSession(environment, profile.id) : null
        let prepared = prepareRequest(request, environment, {
          now: new Date(state.mockNow),
        })
        const automaticRefreshRequired = Boolean(
          profile &&
          request.id !== profile.loginRequestId &&
          ['bearer', 'oauth2', 'inherit'].includes(request.auth.type) &&
          profile.autoRefresh &&
          authSession?.expiresAt &&
          shouldRefresh(
            new Date(authSession.expiresAt),
            new Date(state.mockNow),
            profile.refreshWindowSeconds,
          ),
        )
        if (automaticRefreshRequired) {
          if (!(await get().forceRefresh())) {
            if (sequence !== requestSequence) return
            set({
              executionState: 'error',
              requestError: i18n.t('auth.refreshError'),
              lastHttpResponse: null,
              lastGrpcResult: null,
            })
            return
          }
          state = get()
          environment = state.data.environments.find(
            (entry) => entry.id === state.data.activeEnvironmentId,
          )
          if (!environment) return
          prepared = prepareRequest(request, environment, {
            now: new Date(state.mockNow),
          })
        }

        const { url, body, secrets: secretValues } = prepared
        const environmentId = environment.id
        if (!prepared.valid) {
          const requestError = `${i18n.t(`errors.${prepared.problem}`)}${prepared.unresolved.length ? `: ${prepared.unresolved.join(', ')}` : ''}`
          set({
            executionState: 'error',
            lastHttpResponse: null,
            lastGrpcResult: null,
            grpcSessionState: 'idle',
            lastResolution: { url, body },
            requestError,
            toastMessage: requestError,
          })
          return
        }
        set({
          executionState: 'resolving',
          lastResolution: { url, body },
          requestError: null,
          lastHttpResponse: null,
          lastGrpcResult: null,
          grpcSessionState: request.protocol === 'grpc' ? 'connecting' : 'idle',
        })
        await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 120))
        if (sequence !== requestSequence) return
        set({ executionState: 'running' })
        await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 220))
        if (sequence !== requestSequence) return

        if (request.protocol === 'grpc') {
          let result: GrpcResult | null = null
          try {
            const session = await executionClient.openGrpc(
              {
                methodId: request.grpcMethodId,
                callType: request.grpcType,
                scenario: getGrpcScenario(request.id),
                seed: 2026,
                body: body.value,
                deadlineMs: request.timeoutMs,
                metadata: prepared.headers,
              },
              { seed: 2026 },
              controller.signal,
            )
            activeGrpcSession = session
            let liveResult: GrpcResult = {
              status: 0,
              statusName: 'STREAMING',
              duration: 0,
              messages: [],
              headers: [],
              trailers: [],
            }
            set({ lastGrpcResult: liveResult, grpcSessionState: 'streaming' })

            for await (const event of session.events) {
              if (sequence !== requestSequence) return
              if (event.type === 'headers') {
                liveResult = { ...liveResult, headers: event.headers }
                set({ lastGrpcResult: liveResult })
                continue
              }
              if (event.type === 'message') {
                liveResult = {
                  ...liveResult,
                  duration: Math.max(liveResult.duration, event.message.atMs),
                  messages: [...liveResult.messages, event.message],
                }
                set({ lastGrpcResult: liveResult })
                continue
              }
              if (event.type === 'trailers') {
                liveResult = { ...liveResult, trailers: event.trailers }
                set({ lastGrpcResult: liveResult })
                continue
              }
              if (event.outcome === 'cancelled') {
                activeGrpcSession = null
                set({
                  lastGrpcResult: liveResult,
                  grpcSessionState: 'cancelled',
                  executionState: 'cancelled',
                })
                return
              }
              result = event.result
              activeGrpcSession = null
              set({
                lastGrpcResult: result,
                grpcSessionState: event.outcome === 'failed' ? 'failed' : 'completed',
              })
            }
          } catch (error) {
            if (error instanceof ExecutionAbortedError || sequence !== requestSequence) return
            activeGrpcSession = null
            set({
              executionState: 'error',
              grpcSessionState: 'failed',
              requestError: i18n.t('errors.generic'),
            })
            return
          }
          if (sequence !== requestSequence || !result) return
          const execution: RequestExecution = {
            id: `execution-${crypto.randomUUID()}`,
            requestId: request.id,
            requestName: request.name,
            protocol: 'grpc',
            scenario: getGrpcScenario(request.id),
            startedAt: state.mockNow,
            duration: result.duration,
            status: result.status,
            statusText: result.statusName,
            environmentId: environment.id,
            environmentName: environment.name,
            trace: captureRequestTrace(prepared),
            requestSnapshot: createSafeRequestSnapshot(request),
            grpc: redactSensitiveData(result, '', secretValues) as GrpcResult,
          }
          const data = persist(repository, {
            ...get().data,
            executions: [execution, ...get().data.executions].slice(0, 200),
          })
          set({
            data,
            lastGrpcResult: result,
            lastHttpResponse: null,
            executionState: 'complete',
          })
          return
        }

        let executedHeaders = prepared.headers
        const input = {
          requestId: request.id,
          scenario: getHttpScenario(request.id),
          method: request.method,
          url: url.value,
          body: body.value,
          seed: 2026,
          timeoutMs: request.timeoutMs,
          followRedirects: request.followRedirects,
          verifyTls: request.verifyTls,
          headers: prepared.headers,
        }
        let baseResult: HttpExecutionResult
        try {
          baseResult = await executionClient.executeHttp(input, { seed: 2026 }, controller.signal)
        } catch (error) {
          if (error instanceof ExecutionAbortedError || sequence !== requestSequence) return
          set({ executionState: 'error', requestError: i18n.t('errors.generic') })
          return
        }
        if (sequence !== requestSequence) return
        if (
          baseResult.status === 401 &&
          profile?.autoRefresh &&
          request.id !== profile.loginRequestId &&
          ['bearer', 'oauth2', 'inherit'].includes(request.auth.type)
        ) {
          const refreshed = await get().forceRefresh(environmentId)
          if (refreshed) {
            const refreshedEnvironment = get().data.environments.find(
              (entry) => entry.id === environmentId,
            )!
            const retry = prepareRequest(request, refreshedEnvironment, {
              now: new Date(state.mockNow),
            })
            try {
              baseResult = await executionClient.executeHttp(
                { ...input, scenario: 'success', headers: retry.headers },
                { seed: 2026 },
                controller.signal,
              )
            } catch (error) {
              if (error instanceof ExecutionAbortedError || sequence !== requestSequence) return
              set({ executionState: 'error', requestError: i18n.t('errors.generic') })
              return
            }
            executedHeaders = retry.headers
            baseResult.console.unshift({ level: 'warn', message: i18n.t('auth.retriedOnce') })
          }
        }
        if (sequence !== requestSequence) return
        const result: HttpExecutionResult = {
          ...baseResult,
          console: [
            ...baseResult.console.map((entry) => ({
              ...entry,
              message: redactSensitiveData(entry.message, '', secretValues) as string,
            })),
          ],
        }
        let data = get().data
        if (request.id === profile?.loginRequestId && result.status === 200) {
          const profile = data.authProfiles[0]
          if (profile) {
            try {
              const captured = captureTokens(result.body, profile, new Date(state.mockNow))
              data = applyEnvironmentWrites(
                data,
                environmentId,
                {
                  [profile.accessVariable]: captured.accessToken,
                  [profile.refreshVariable]: captured.refreshToken,
                },
                state.mockNow,
                { secretKeys: [profile.accessVariable, profile.refreshVariable] },
              )
              data = updateEnvironmentAuthSession(data, environmentId, profile.id, {
                lastCapturedAt: state.mockNow,
                expiresAt: captured.expiresAt.toISOString(),
                tokenVersion: getEnvironmentAuthSession(environment, profile.id).tokenVersion + 1,
              })
            } catch {
              result.tests.push({
                name: i18n.t('auth.captureRules'),
                passed: false,
                detail: i18n.t('auth.captureError'),
              })
            }
          }
        }
        const execution: RequestExecution = {
          id: `execution-${crypto.randomUUID()}`,
          requestId: request.id,
          requestName: request.name,
          protocol: 'http',
          scenario: getHttpScenario(request.id),
          startedAt: state.mockNow,
          duration: result.timings.total,
          status: result.status,
          statusText: result.statusText,
          environmentId: environment.id,
          environmentName: environment.name,
          trace: captureRequestTrace(prepared, executedHeaders),
          requestSnapshot: createSafeRequestSnapshot(request),
          http: {
            ...result,
            body: redactSensitiveData(result.body, '', secretValues),
            rawBody: redactSensitiveData(result.rawBody, '', secretValues) as string,
            tests: redactSensitiveData(
              result.tests,
              '',
              secretValues,
            ) as HttpExecutionResult['tests'],
            headers: result.headers.map((header) => ({
              ...header,
              value: redactSensitiveData(header.value, header.key, secretValues) as string,
            })),
          },
        }
        data = persist(repository, {
          ...data,
          executions: [execution, ...data.executions].slice(0, 200),
        })
        set({ data, lastHttpResponse: result, lastGrpcResult: null, executionState: 'complete' })
      },

      cancelActiveRequest: () => {
        requestSequence += 1
        const activeRequest = get().data.requests.find(
          (request) => request.id === get().data.activeRequestId,
        )
        const cancellingGrpc = activeRequest?.protocol === 'grpc'
        const currentGrpcResult = get().lastGrpcResult
        const cancelledGrpcResult =
          cancellingGrpc && (activeGrpcSession || currentGrpcResult)
            ? {
                ...(currentGrpcResult ?? {
                  duration: 0,
                  messages: [],
                  headers: [],
                  trailers: [],
                }),
                status: 1,
                statusName: 'CANCELLED',
              }
            : null
        activeGrpcSession?.cancel()
        activeGrpcSession = null
        activeRequestController?.abort()
        activeRequestController = null
        cancelRefreshes()
        set({
          executionState: 'cancelled',
          grpcSessionState: cancellingGrpc ? 'cancelled' : 'idle',
          authOperation: 'idle',
          lastGrpcResult: cancelledGrpcResult,
        })
      },

      sendGrpcMessage: async (message) => {
        const session = activeGrpcSession
        if (!session) return false
        try {
          await session.send(message)
          return true
        } catch (error) {
          set({ requestError: error instanceof Error ? error.message : i18n.t('errors.generic') })
          return false
        }
      },

      pauseGrpcStream: () => {
        if (!activeGrpcSession) return
        try {
          activeGrpcSession.pause()
          set({ grpcSessionState: 'paused' })
        } catch (error) {
          set({ requestError: error instanceof Error ? error.message : i18n.t('errors.generic') })
        }
      },

      resumeGrpcStream: () => {
        if (!activeGrpcSession) return
        try {
          activeGrpcSession.resume()
          set({ grpcSessionState: 'streaming' })
        } catch (error) {
          set({ requestError: error instanceof Error ? error.message : i18n.t('errors.generic') })
        }
      },

      halfCloseGrpcStream: async () => {
        const session = activeGrpcSession
        if (!session) return false
        try {
          await session.halfClose()
          set({ grpcSessionState: 'half-closed' })
          return true
        } catch (error) {
          set({ requestError: error instanceof Error ? error.message : i18n.t('errors.generic') })
          return false
        }
      },

      clearGrpcStream: () => {
        if (activeGrpcSession) return
        set({ lastGrpcResult: null, grpcSessionState: 'idle', requestError: null })
      },

      setHttpResponse: (lastHttpResponse) => set({ lastHttpResponse }),

      updateAuthProfile: (profileId, patch) => {
        const state = get()
        const authProfiles = state.data.authProfiles.map((profile) =>
          profile.id === profileId ? { ...profile, ...patch } : profile,
        )
        const data = persist(repository, { ...state.data, authProfiles })
        set({ data })
      },

      runLoginCapture: async () => {
        activeRequestController?.abort()
        const controller = new AbortController()
        activeRequestController = controller
        const sequence = ++requestSequence
        const state = get()
        const login = state.data.requests.find(
          (request) => request.id === state.data.authProfiles[0]?.loginRequestId,
        )
        const profile = state.data.authProfiles[0]
        const environment = state.data.environments.find(
          (entry) => entry.id === state.data.activeEnvironmentId,
        )
        const failCapture = (message: string) =>
          set({
            executionState: 'error',
            authCaptureError: message,
            authOperation: 'idle',
            toastMessage: message,
          })
        if (!login || !profile || !environment) {
          failCapture(i18n.t('auth.loginError'))
          return
        }
        set({ executionState: 'running', authCaptureError: null, authOperation: 'login' })
        const prepared = prepareRequest(login, environment, {
          seed: 97,
          now: new Date(state.mockNow),
        })
        if (!prepared.valid) {
          failCapture(i18n.t(`errors.${prepared.problem}`))
          return
        }
        let response: HttpExecutionResult
        try {
          response = await executionClient.executeHttp(
            {
              requestId: login.id,
              scenario: getHttpScenario(login.id),
              method: login.method,
              url: prepared.url.value,
              body: prepared.body.value,
              headers: prepared.headers,
              timeoutMs: login.timeoutMs,
              followRedirects: login.followRedirects,
              verifyTls: login.verifyTls,
              seed: 97,
            },
            { seed: 97 },
            controller.signal,
          )
        } catch (error) {
          if (error instanceof ExecutionAbortedError || sequence !== requestSequence) return
          failCapture(i18n.t('auth.loginError'))
          return
        }
        if (sequence !== requestSequence) return
        if (response.status < 200 || response.status >= 300) {
          failCapture(i18n.t('auth.loginError'))
          return
        }
        try {
          const captured = captureTokens(response.body, profile, new Date(state.mockNow))
          const next = applyEnvironmentWrites(
            get().data,
            environment.id,
            {
              [profile.accessVariable]: captured.accessToken,
              [profile.refreshVariable]: captured.refreshToken,
            },
            state.mockNow,
            { secretKeys: [profile.accessVariable, profile.refreshVariable] },
          )
          const data = persist(
            repository,
            updateEnvironmentAuthSession(next, environment.id, profile.id, {
              lastCapturedAt: state.mockNow,
              expiresAt: captured.expiresAt.toISOString(),
              tokenVersion: getEnvironmentAuthSession(environment, profile.id).tokenVersion + 1,
            }),
          )
          set({
            data,
            ...(get().data.activeRequestId === login.id ? { lastHttpResponse: response } : {}),
            executionState: 'complete',
            authOperation: 'idle',
          })
        } catch {
          failCapture(i18n.t('auth.captureError'))
        }
      },

      advanceMockClock: (milliseconds) => {
        const mockNow = new Date(new Date(get().mockNow).getTime() + milliseconds).toISOString()
        set({ mockNow })
      },

      forceRefresh: async (environmentId) => {
        const state = get()
        const profile = state.data.authProfiles[0]
        if (!profile) return false
        const targetId = environmentId ?? state.data.activeEnvironmentId
        const startingEnvironment = state.data.environments.find((entry) => entry.id === targetId)
        const startingSession = startingEnvironment
          ? getEnvironmentAuthSession(startingEnvironment, profile.id)
          : null
        const refreshKey = `${profile.id}:${targetId}`
        const existing = refreshInFlight.get(refreshKey)
        if (existing) return existing
        const controller = new AbortController()
        refreshControllers.set(refreshKey, controller)
        set({ authOperation: 'refresh', authCaptureError: null })

        const operation = (async (): Promise<boolean> => {
          const failRefresh = () => {
            set({
              authCaptureError: i18n.t('auth.refreshError'),
              toastMessage: i18n.t('auth.refreshError'),
            })
            return false
          }
          const environment = state.data.environments.find((entry) => entry.id === targetId)
          const refreshToken = environment?.variables.find(
            (variable) => variable.key === profile.refreshVariable && variable.enabled,
          )?.value
          const refreshRequest = state.data.requests.find(
            (entry) => entry.id === profile.refreshRequestId,
          )
          if (
            !environment ||
            !refreshToken ||
            !refreshRequest ||
            refreshRequest.protocol !== 'http'
          )
            return failRefresh()
          const prepared = prepareRequest(refreshRequest, environment, {
            now: new Date(state.mockNow),
          })
          if (!prepared.valid) return failRefresh()
          let response: HttpExecutionResult
          try {
            response = await executionClient.executeHttp(
              {
                requestId: refreshRequest.id,
                scenario: getHttpScenario(refreshRequest.id),
                method: refreshRequest.method,
                url: prepared.url.value,
                body: prepared.body.value,
                headers: prepared.headers,
                timeoutMs: refreshRequest.timeoutMs,
                followRedirects: refreshRequest.followRedirects,
                verifyTls: refreshRequest.verifyTls,
                seed: 97,
              },
              { seed: 97 },
              controller.signal,
            )
          } catch (error) {
            if (error instanceof ExecutionAbortedError) return false
            return failRefresh()
          }
          if (response.status < 200 || response.status >= 300) return failRefresh()
          let tokens: ReturnType<typeof captureTokens>
          try {
            tokens = captureTokens(response.body, profile, new Date(state.mockNow))
          } catch {
            return failRefresh()
          }
          const current = get().data
          const currentEnvironment = current.environments.find((entry) => entry.id === targetId)
          if (!currentEnvironment) return true
          const currentSession = getEnvironmentAuthSession(currentEnvironment, profile.id)
          if (!startingSession || currentSession.tokenVersion !== startingSession.tokenVersion)
            return true
          const next = applyEnvironmentWrites(
            current,
            targetId,
            {
              [profile.accessVariable]: tokens.accessToken,
              [profile.refreshVariable]: tokens.refreshToken,
            },
            state.mockNow,
            { secretKeys: [profile.accessVariable, profile.refreshVariable] },
          )
          const data = persist(
            repository,
            updateEnvironmentAuthSession(next, targetId, profile.id, {
              refreshCount: currentSession.refreshCount + 1,
              lastCapturedAt: state.mockNow,
              expiresAt: tokens.expiresAt.toISOString(),
              tokenVersion: currentSession.tokenVersion + 1,
            }),
          )
          set({ data, authCaptureError: null })
          return true
        })().finally(() => {
          if (refreshInFlight.get(refreshKey) === operation) refreshInFlight.delete(refreshKey)
          if (refreshControllers.get(refreshKey) === controller)
            refreshControllers.delete(refreshKey)
          if (get().authOperation === 'refresh') set({ authOperation: 'idle' })
        })

        refreshInFlight.set(refreshKey, operation)
        return operation
      },
    },
    invalidate: () => {
      requestSequence += 1
      activeGrpcSession?.cancel()
      activeGrpcSession = null
      activeRequestController?.abort()
      activeRequestController = null
      cancelRefreshes()
      set({ authOperation: 'idle', grpcSessionState: 'idle' })
    },
    reset: () => {
      requestSequence += 1
      activeGrpcSession?.cancel()
      activeGrpcSession = null
      activeRequestController?.abort()
      activeRequestController = null
      cancelRefreshes()
      set({ authOperation: 'idle', grpcSessionState: 'idle' })
    },
  }
}
