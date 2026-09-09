import { appDependencies } from '@/app/dependencies'
import { createPulseStore } from '@/state/create-pulse-store'

/** The single browser store, composed from concrete adapters only at the application edge. */
export const usePulseStore = createPulseStore(appDependencies)
