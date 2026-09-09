import { Braces, RadioTower } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { usePulseStore } from '@/state/pulse-store'

export const WorkspaceIndex = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const data = usePulseStore((state) => state.data)
  const createRequest = usePulseStore((state) => state.createRequest)
  const request =
    data.requests.find((entry) => entry.id === data.activeRequestId) ?? data.requests[0]
  const workspacePath = `/w/${encodeURIComponent(data.workspace.id)}`

  if (request)
    return (
      <Navigate
        to={`${workspacePath}/${request.protocol === 'grpc' ? 'grpc' : 'request'}/${encodeURIComponent(request.id)}`}
        replace
      />
    )

  const create = (protocol: 'http' | 'grpc') => {
    const id = createRequest(
      protocol,
      t(protocol === 'grpc' ? 'workbench.untitledGrpc' : 'workbench.untitledHttp'),
    )
    navigate(
      `${workspacePath}/${protocol === 'grpc' ? 'grpc' : 'request'}/${encodeURIComponent(id)}`,
      { replace: true },
    )
  }

  return (
    <div className="flex h-full min-h-0 items-center justify-center overflow-auto bg-canvas p-4 md:p-8">
      <div className="w-full max-w-xl rounded-xl border border-border bg-surface shadow-panel">
        <EmptyState
          icon={<Braces className="size-5 text-accent" aria-hidden="true" />}
          title={t('workbench.emptyWorkspace')}
          description={t('workbench.emptyWorkspaceHint')}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="primary"
                icon={<Braces className="size-4" aria-hidden="true" />}
                onClick={() => create('http')}
              >
                {t('workbench.newHttp')}
              </Button>
              <Button
                icon={<RadioTower className="size-4" aria-hidden="true" />}
                onClick={() => create('grpc')}
              >
                {t('workbench.newGrpc')}
              </Button>
            </div>
          }
        />
      </div>
    </div>
  )
}
