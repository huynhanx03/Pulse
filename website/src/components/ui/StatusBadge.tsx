import { CheckCircle2, CircleDot, Clock3, PauseCircle, XCircle } from 'lucide-react'
import type { ComponentProps } from 'react'

import { Badge } from '@/components/ui/Badge'

export type StatusKind = 'draft' | 'ready' | 'running' | 'success' | 'failed' | 'paused' | 'stopped'

const statusPresentation = {
  draft: { tone: 'warning', icon: Clock3 },
  ready: { tone: 'neutral', icon: CircleDot },
  running: { tone: 'info', icon: CircleDot },
  success: { tone: 'success', icon: CheckCircle2 },
  failed: { tone: 'danger', icon: XCircle },
  paused: { tone: 'warning', icon: PauseCircle },
  stopped: { tone: 'neutral', icon: CircleDot },
} as const

interface StatusBadgeProps extends Omit<ComponentProps<typeof Badge>, 'tone'> {
  status: StatusKind
  withIcon?: boolean
}

/** Product-wide execution state: wording belongs to the caller, visual semantics do not. */
export const StatusBadge = ({ status, withIcon = true, children, ...props }: StatusBadgeProps) => {
  const { tone, icon: Icon } = statusPresentation[status]

  return (
    <Badge tone={tone} {...props}>
      {withIcon ? (
        <Icon className={status === 'running' ? 'size-3 animate-pulse' : 'size-3'} />
      ) : null}
      {children}
    </Badge>
  )
}
