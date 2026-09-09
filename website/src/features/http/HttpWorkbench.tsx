import { useEffect } from 'react'
import { useParams } from 'react-router-dom'

import { NotFoundState } from '@/components/ui/NotFoundState'
import { RequestResponseLayout } from '@/components/workbench/RequestResponseLayout'
import { RequestComposer } from '@/features/http/components/RequestComposer'
import { ResolutionInspector } from '@/features/http/components/ResolutionInspector'
import { ResponsePanel } from '@/features/http/components/ResponsePanel'
import { cn } from '@/lib/utils/cn'
import { usePulseStore } from '@/state/pulse-store'

const HttpWorkbench = () => {
  const { requestId } = useParams()
  const data = usePulseStore((state) => state.data)
  const selectRequest = usePulseStore((state) => state.selectRequest)
  const inspectorOpen = usePulseStore((state) => state.inspectorOpen)

  useEffect(() => {
    if (requestId) selectRequest(requestId)
  }, [requestId, selectRequest])

  const request = data.requests.find((entry) => entry.id === (requestId ?? data.activeRequestId))
  if (!request || request.protocol !== 'http')
    return <NotFoundState descriptionKey="errors.noRequest" />

  return (
    <div className={cn('relative h-full min-h-0 overflow-hidden max-xl:overflow-auto')}>
      <RequestResponseLayout
        request={<RequestComposer key={request.id} request={request} />}
        response={<ResponsePanel />}
      />
      {inspectorOpen ? <ResolutionInspector /> : null}
    </div>
  )
}

export default HttpWorkbench
