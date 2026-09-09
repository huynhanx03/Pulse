import { create, type StoreApi, type UseBoundStore } from 'zustand'

import { i18n } from '@/lib/i18n/i18n'
import { PulseRepository } from '@/lib/persistence/pulse-repository'
import { DEFAULT_PREFERENCES } from '@/lib/preferences/preferences'
import { PreferencesRepository } from '@/lib/preferences/preferences-repository'
import type { PulseStore, PulseStoreDependencies } from '@/state/store-types'
import { initialRunConfig } from '@/state/store-helpers'
import { createExecutionSlice } from '@/state/slices/execution-slice'
import { createUiSlice } from '@/state/slices/ui-slice'
import { createWorkspaceSlice } from '@/state/slices/workspace-slice'
import { createRunnerSlice } from '@/state/slices/runner-slice'

export type { GrpcSessionState, PulseStore, RunConfiguration } from '@/state/store-types'

export const createPulseStore = ({
  storage,
  executionClient,
  createWorkspace,
  workspaceDirectory,
}: PulseStoreDependencies): UseBoundStore<StoreApi<PulseStore>> => {
  const repository = new PulseRepository(storage, createWorkspace)
  const preferencesRepository = new PreferencesRepository(storage)
  const initialData = repository.load()
  const initialPreferences = preferencesRepository.load()

  return create<PulseStore>((set, get) => {
    const executionSlice = createExecutionSlice({ executionClient, repository, set, get })
    const runnerSlice = createRunnerSlice({ executionClient, repository, set, get })
    return {
      data: initialData,
      workspaceDirectory: workspaceDirectory?.length ? workspaceDirectory : [initialData.workspace],
      preferences: initialPreferences,
      mockProfiles: {},
      executionState: 'idle',
      lastHttpResponse: null,
      lastGrpcResult: null,
      grpcSessionState: 'idle',
      lastResolution: null,
      requestError: null,
      authCaptureError: null,
      authOperation: 'idle',
      mockNow: '2026-08-30T00:00:00.000Z',
      commandOpen: false,
      explorerOpen: false,
      inspectorOpen: false,
      runConfig: initialRunConfig,
      runState: 'idle',
      runProgress: 0,
      activeRunResult: null,
      activeRunConfig: null,
      toastMessage: repository.lastRecoveryReason ? i18n.t('errors.malformedData') : null,
      ...createUiSlice({ storage, preferencesRepository, set, get }),

      ...createWorkspaceSlice({
        repository,
        set,
        get,
        invalidateRequest: executionSlice.invalidate,
      }),

      ...executionSlice.actions,

      ...runnerSlice.actions,

      resetWorkspace: () => {
        executionSlice.reset()
        runnerSlice.reset()
        const data = repository.reset(get().data.workspace.id)
        preferencesRepository.save(DEFAULT_PREFERENCES)
        set({
          data,
          preferences: DEFAULT_PREFERENCES,
          mockProfiles: {},
          executionState: 'idle',
          lastHttpResponse: null,
          lastGrpcResult: null,
          grpcSessionState: 'idle',
          lastResolution: null,
          requestError: null,
          authCaptureError: null,
          authOperation: 'idle',
          mockNow: '2026-08-30T00:00:00.000Z',
          runConfig: initialRunConfig,
          runState: 'idle',
          runProgress: 0,
          activeRunResult: null,
          activeRunConfig: null,
        })
      },
    }
  })
}
