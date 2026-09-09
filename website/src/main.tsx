import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app/App'
import { AppErrorBoundary } from '@/app/providers/AppErrorBoundary'
import { applyPreferencesToDocument } from '@/app/providers/apply-document-preferences'
import '@/app/styles/globals.css'
import '@/lib/i18n/i18n'
import { usePulseStore } from '@/state/pulse-store'

// The injected store reads its repositories once at construction; synchronize that
// snapshot before first paint so theme and language do not flash.
applyPreferencesToDocument(usePulseStore.getState().preferences)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary onResetWorkspace={() => usePulseStore.getState().resetWorkspace()}>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
