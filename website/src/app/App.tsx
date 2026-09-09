import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'

import { AppShell } from '@/app/layout/AppShell'
import { WorkspaceIndex } from '@/app/WorkspaceIndex'
import { PreferencesSynchronizer } from '@/app/providers/PreferencesSynchronizer'
import { NotFoundState } from '@/components/ui/NotFoundState'
import { usePulseStore } from '@/state/pulse-store'

const HttpWorkbench = lazy(() => import('@/features/http/HttpWorkbench'))
const GrpcWorkbench = lazy(() => import('@/features/grpc/GrpcWorkbench'))
const VariablesPage = lazy(() => import('@/features/variables/VariablesPage'))
const DatasetsPage = lazy(() => import('@/features/datasets/DatasetsPage'))
const AutomationsPage = lazy(() => import('@/features/automations/AutomationsPage'))
const TestLabPage = lazy(() => import('@/features/test-lab/TestLabPage'))
const HistoryPage = lazy(() => import('@/features/history/HistoryPage'))

const AppLifecycle = () => {
  const navigate = useNavigate()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        usePulseStore.getState().setCommandOpen(true)
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'l') {
        event.preventDefault()
        document.getElementById('request-endpoint')?.focus()
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        document.getElementById('explorer-search')?.focus()
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'r') {
        event.preventDefault()
        navigate(`/w/${usePulseStore.getState().data.workspace.id}/runner`)
      }
      if ((event.metaKey || event.ctrlKey) && event.key === '.') {
        event.preventDefault()
        const store = usePulseStore.getState()
        store.setInspectorOpen(!store.inspectorOpen)
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        void usePulseStore.getState().sendActiveRequest()
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        const state = usePulseStore.getState()
        state.saveRequest(state.data.activeRequestId)
      }
      if (event.key === 'Escape') {
        const state = usePulseStore.getState()
        if (state.executionState === 'running' || state.executionState === 'resolving')
          state.cancelActiveRequest()
        else {
          state.setCommandOpen(false)
          state.setExplorerOpen(false)
          state.setInspectorOpen(false)
        }
      }
    }
    globalThis.addEventListener('keydown', onKeyDown)
    return () => globalThis.removeEventListener('keydown', onKeyDown)
  }, [navigate])

  return null
}

const RouteLoading = () => (
  <div
    className="flex h-full items-center justify-center bg-canvas"
    role="status"
    aria-live="polite"
  >
    <div className="flex items-center gap-2 text-xs text-ink-muted">
      <span className="size-2 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
      Pulse
    </div>
  </div>
)

export const App = () => (
  <BrowserRouter>
    <PreferencesSynchronizer />
    <AppLifecycle />
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<WorkspaceIndex />} />
          <Route path="/w/:workspaceId/request/:requestId" element={<HttpWorkbench />} />
          <Route path="/w/:workspaceId/grpc/:requestId" element={<GrpcWorkbench />} />
          <Route path="/w/:workspaceId/variables" element={<VariablesPage />} />
          <Route path="/w/:workspaceId/datasets" element={<DatasetsPage />} />
          <Route path="/w/:workspaceId/automations" element={<AutomationsPage />} />
          <Route path="/w/:workspaceId/auth" element={<Navigate to="../automations" replace />} />
          <Route path="/w/:workspaceId/runner" element={<TestLabPage />} />
          <Route path="/w/:workspaceId/runs" element={<HistoryPage />} />
          <Route path="*" element={<NotFoundState />} />
        </Route>
      </Routes>
    </Suspense>
  </BrowserRouter>
)
