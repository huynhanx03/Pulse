import type { GrpcResult, JsonValue } from '@/domain/execution/grpc'
import type { HttpExecutionResult } from '@/domain/execution/http'
import { isValidTestRunPlan, projectRunProgress } from '@/domain/runner/run-analysis'
import type { RunnerSample, SimulatedRun } from '@/domain/runner/types'
import type { RunRecord } from '@/domain/types'
import { generateDatasetRows } from '@/lib/datasets/dataset-engine'
import { prepareRequest } from '@/lib/http/request-resolution'
import { i18n } from '@/lib/i18n/i18n'
import type { PulseRepository } from '@/lib/persistence/pulse-repository'
import { redactSensitiveData } from '@/lib/security/redaction'
import {
  ExecutionAbortedError,
  type ExecutionClient,
  type TestRunSession,
} from '@/services/execution-client'
import { collectGrpcResult, persistWorkspace as persist } from '@/state/store-helpers'
import type { PulseGet, PulseSet, PulseStoreActions } from '@/state/store-types'

type RunnerActions = Pick<
  PulseStoreActions,
  'updateRunConfig' | 'getRunPreflight' | 'startRun' | 'pauseRun' | 'resumeRun' | 'stopRun'
>

interface RunnerSliceContext {
  executionClient: ExecutionClient
  repository: PulseRepository
  set: PulseSet
  get: PulseGet
}

export interface RunnerSlice {
  actions: RunnerActions
  reset(): void
}

export const createRunnerSlice = ({
  executionClient,
  repository,
  set,
  get,
}: RunnerSliceContext): RunnerSlice => {
  let sequence = 0
  let timer: ReturnType<typeof setInterval> | null = null
  let finish: ((stopped: boolean) => void) | null = null
  let controller: AbortController | null = null
  let session: TestRunSession | null = null
  const getHttpScenario = (requestId: string) =>
    get().mockProfiles[requestId]?.httpScenario ?? 'success'
  const getGrpcScenario = (requestId: string) =>
    get().mockProfiles[requestId]?.grpcScenario ?? 'success'

  const stopRuntime = () => {
    sequence += 1
    session?.stop()
    session = null
    controller?.abort()
    controller = null
    if (timer) clearInterval(timer)
    timer = null
  }

  return {
    reset: () => {
      stopRuntime()
      finish = null
    },
    actions: {
      updateRunConfig: (patch) => set((state) => ({ runConfig: { ...state.runConfig, ...patch } })),

      getRunPreflight: () => {
        const { data, runConfig: config, mockNow } = get()
        const request = data.requests.find((entry) => entry.id === config.requestId)
        const environment = data.environments.find((entry) => entry.id === data.activeEnvironmentId)
        const dataset = data.datasets.find((entry) => entry.id === config.datasetId)
        const rows =
          config.mode === 'data' ? get().getDatasetRows(config.datasetId, config.iterations) : []
        const estimatedIterations =
          config.mode === 'functional'
            ? 1
            : config.mode === 'data'
              ? rows.length
              : config.mode === 'race'
                ? config.workers
                : config.mode === 'arrival-rate'
                  ? config.targetRate * config.durationSeconds
                  : config.mode === 'constant-vus'
                    ? config.workers * config.durationSeconds
                    : Math.max(1, Math.round(config.workers * config.durationSeconds * 0.7))
        const issues: string[] = []
        if (!isValidTestRunPlan(config)) issues.push(i18n.t('runner.invalidConfig'))
        if (!request || !environment) issues.push(i18n.t('runner.missingTarget'))
        if (config.mode === 'data' && rows.length === 0) issues.push(i18n.t('runner.emptyDataset'))
        if (request && environment) {
          const prepared = prepareRequest(request, environment, {
            now: new Date(mockNow),
            ...(rows[0] ? { iteration: rows[0] } : {}),
          })
          if (!prepared.valid)
            issues.push(
              `${i18n.t(`errors.${prepared.problem}`)}${prepared.unresolved.length ? `: ${prepared.unresolved.join(', ')}` : ''}`,
            )
        }
        return {
          valid: issues.length === 0,
          issues,
          target: request?.name ?? '',
          environment: environment?.name ?? '',
          dataset: config.mode === 'data' ? (dataset?.name ?? null) : null,
          estimatedIterations,
        }
      },

      startRun: async () => {
        const preflight = get().getRunPreflight()
        if (!preflight.valid) {
          set({ toastMessage: preflight.issues[0] ?? i18n.t('errors.generic') })
          return
        }
        if (timer) clearInterval(timer)
        controller?.abort()
        controller = new AbortController()
        const activeController = controller
        const activeSequence = ++sequence
        const snapshot = structuredClone({
          data: get().data,
          config: get().runConfig,
          now: get().mockNow,
        })
        const { config, now } = snapshot
        const request = snapshot.data.requests.find((entry) => entry.id === config.requestId)!
        const operations = [{ operation: request, expectedStatus: null }]
        const environment = snapshot.data.environments.find(
          (entry) => entry.id === snapshot.data.activeEnvironmentId,
        )!
        const dataset = snapshot.data.datasets.find((entry) => entry.id === config.datasetId)
        const rows =
          config.mode === 'data' && dataset
            ? generateDatasetRows(dataset, config.iterations)
            : [undefined]
        set({ runState: 'running', runProgress: 0, activeRunResult: null, activeRunConfig: config })
        const samples: RunnerSample[] = []

        const executeOperation = async (
          operation: typeof request,
          expectedStatus: number | null,
          index: number,
          row: (typeof rows)[number],
        ): Promise<RunnerSample | null> => {
          const prepared = prepareRequest(operation, environment, {
            seed: config.seed + index,
            now: new Date(now),
            ...(row ? { iteration: row } : {}),
          })
          const input = redactSensitiveData(prepared.body.value, '', prepared.secrets) as string
          if (!prepared.valid) {
            return {
              label: operation.name,
              status: 0,
              duration: 0,
              input,
              checks: [{ name: i18n.t(`errors.${prepared.problem}`), passed: false }],
            }
          }
          if (operation.protocol === 'grpc') {
            let response: GrpcResult | null
            try {
              const grpcSession = await executionClient.openGrpc(
                {
                  methodId: operation.grpcMethodId,
                  callType: operation.grpcType,
                  scenario: getGrpcScenario(operation.id),
                  seed: config.seed + index,
                  body: prepared.body.value,
                  deadlineMs: operation.timeoutMs,
                  metadata: prepared.headers,
                },
                { seed: config.seed + index },
                activeController.signal,
              )
              if (operation.grpcType === 'client-stream' || operation.grpcType === 'bidi-stream') {
                const message = (
                  prepared.body.value.trim() ? JSON.parse(prepared.body.value) : null
                ) as JsonValue
                await grpcSession.send(message)
                await grpcSession.halfClose()
              }
              response = await collectGrpcResult(grpcSession)
            } catch (error) {
              if (error instanceof ExecutionAbortedError || activeSequence !== sequence) return null
              response = null
            }
            if (!response) {
              return {
                label: operation.name,
                status: 0,
                duration: 0,
                input,
                checks: [{ name: 'gRPC execution failed', passed: false }],
              }
            }
            const target = expectedStatus ?? 0
            return {
              label: operation.name,
              status: response.status,
              duration: response.duration,
              input,
              checks: [
                {
                  name: `${operation.name} · status ${target}`,
                  passed: response.status === target,
                },
              ],
            }
          }
          let response: HttpExecutionResult
          try {
            response = await executionClient.executeHttp(
              {
                requestId: operation.id,
                scenario: getHttpScenario(operation.id),
                method: operation.method,
                url: prepared.url.value,
                body: prepared.body.value,
                seed: config.seed + index,
                timeoutMs: operation.timeoutMs,
                verifyTls: operation.verifyTls,
                followRedirects: operation.followRedirects,
                headers: prepared.headers,
              },
              { seed: config.seed + index },
              activeController.signal,
            )
          } catch (error) {
            if (error instanceof ExecutionAbortedError || activeSequence !== sequence) return null
            return {
              label: operation.name,
              status: 0,
              duration: 0,
              input,
              checks: [{ name: i18n.t('errors.generic'), passed: false }],
            }
          }
          const expected = expectedStatus ?? response.status
          return {
            label: operation.name,
            status: response.status,
            duration: response.timings.total,
            input,
            checks: [
              ...response.tests.map(({ name, passed }) => ({ name, passed })),
              {
                name: `${operation.name} · status ${expected}`,
                passed: response.status === expected,
              },
            ],
          }
        }

        for (const [index, row] of rows.entries()) {
          const label = `${i18n.t('common.row')} ${index + 1}`
          const stepResults: RunnerSample[] = []
          for (const { operation, expectedStatus } of operations) {
            const outcome = await executeOperation(operation, expectedStatus, index, row)
            if (!outcome || activeSequence !== sequence) return
            stepResults.push(outcome)
          }
          samples.push({
            label,
            status: stepResults.at(-1)?.status ?? 0,
            duration: stepResults.reduce((total, item) => total + item.duration, 0),
            input: stepResults
              .map((item) => item.input)
              .filter(Boolean)
              .join('\n'),
            checks: stepResults.flatMap((item) => item.checks),
          })
        }
        if (activeSequence !== sequence) return
        let result: SimulatedRun | null = null
        try {
          session = await executionClient.startRun(
            { ...config, samples, resource: `mock:${request.name}` },
            { seed: config.seed },
            activeController.signal,
          )
          for await (const event of session.events) {
            if (activeSequence !== sequence) return
            if (event.type === 'snapshot')
              set({ runProgress: event.progress, activeRunResult: event.result })
            else result = event.result
          }
        } catch (error) {
          if (error instanceof ExecutionAbortedError || activeSequence !== sequence) return
          set({ runState: 'failed', toastMessage: i18n.t('errors.generic') })
          return
        } finally {
          session = null
        }
        if (activeSequence !== sequence || !result) return
        set({ runProgress: 0, activeRunResult: projectRunProgress(result, 0) })
        finish = (stopped) => {
          if (timer) clearInterval(timer)
          timer = null
          const current = get()
          const recordedResult = stopped
            ? (current.activeRunResult ?? projectRunProgress(result, 0))
            : result
          const preparedTarget = prepareRequest(request, environment, { now: new Date(now) })
          const datasetTrace = dataset
            ? {
                id: dataset.id,
                name: dataset.name,
                columnCount: dataset.columns.length,
              }
            : undefined
          const record: RunRecord = {
            id: `run-${crypto.randomUUID()}`,
            name: `${request.name} · ${config.mode}`,
            ...config,
            environmentId: environment.id,
            environmentName: environment.name,
            startedAt: now,
            result: recordedResult,
            status: stopped ? 'stopped' : result.metrics.failures === 0 ? 'passed' : 'failed',
            trace: {
              target: {
                name: request.name,
                protocol: request.protocol,
                operation: request.protocol === 'grpc' ? request.grpcMethodId : request.method,
                endpoint: redactSensitiveData(
                  preparedTarget.valid ? preparedTarget.url.value : request.url,
                  '',
                  preparedTarget.secrets,
                ) as string,
              },
              ...(datasetTrace ? { dataset: datasetTrace } : {}),
              estimatedIterations: preflight.estimatedIterations,
            },
          }
          const data = persist(repository, {
            ...current.data,
            runs: [record, ...current.data.runs].slice(0, 100),
          })
          set({
            data,
            activeRunResult: recordedResult,
            runState: stopped ? 'stopped' : 'complete',
            runProgress: stopped ? current.runProgress : 100,
          })
          finish = null
        }
        timer = setInterval(() => {
          if (get().runState !== 'running') return
          const progress = Math.min(100, get().runProgress + 10)
          if (progress >= 100) finish?.(false)
          else set({ runProgress: progress, activeRunResult: projectRunProgress(result, progress) })
        }, 300)
      },

      pauseRun: () => {
        if (get().runState === 'running') {
          session?.pause()
          set({ runState: 'paused' })
        }
      },

      resumeRun: () => {
        if (get().runState === 'paused') {
          session?.resume()
          set({ runState: 'running' })
        }
      },

      stopRun: () => {
        stopRuntime()
        if (finish) finish(true)
        else set({ runState: 'stopped' })
      },
    },
  }
}
