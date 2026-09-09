import type { StorageAdapter } from '@/lib/persistence/types'
import { normalizePreferences } from '@/lib/preferences/preferences'
import type { PreferencesRepository } from '@/lib/preferences/preferences-repository'
import type { PulseGet, PulseSet, PulseStoreActions } from '@/state/store-types'

type UiActions = Pick<
  PulseStoreActions,
  | 'isPersistent'
  | 'setTheme'
  | 'setLocale'
  | 'updatePreferences'
  | 'setCommandOpen'
  | 'setExplorerOpen'
  | 'setInspectorOpen'
  | 'showToast'
  | 'clearToast'
>

interface UiSliceContext {
  storage: StorageAdapter
  preferencesRepository: PreferencesRepository
  set: PulseSet
  get: PulseGet
}

export const createUiSlice = ({
  storage,
  preferencesRepository,
  set,
  get,
}: UiSliceContext): UiActions => ({
  isPersistent: () => storage.persistent !== false,
  setTheme: (theme) => get().updatePreferences({ theme }),
  setLocale: (locale) => get().updatePreferences({ locale }),
  updatePreferences: (patch) => {
    const preferences = normalizePreferences({ ...get().preferences, ...patch })
    preferencesRepository.save(preferences)
    set({ preferences })
  },
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setExplorerOpen: (explorerOpen) => set({ explorerOpen }),
  setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
  showToast: (toastMessage) => set({ toastMessage }),
  clearToast: () => set({ toastMessage: null }),
})
