import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export const RequestResponseLayout = ({
  request,
  response,
  className,
}: {
  request: ReactNode
  response: ReactNode
  className?: string
}) => (
  <div
    className={cn(
      'grid h-full min-h-[720px] min-w-0 grid-rows-[minmax(380px,1fr)_minmax(320px,0.9fr)] overflow-hidden xl:min-h-0 xl:grid-cols-[minmax(380px,0.9fr)_minmax(480px,1.1fr)] xl:grid-rows-1',
      className,
    )}
  >
    <div className="flex min-h-0 min-w-0 flex-col">{request}</div>
    <div className="flex min-h-0 min-w-0 flex-col border-t border-border xl:border-t-0 xl:border-l">
      {response}
    </div>
  </div>
)
