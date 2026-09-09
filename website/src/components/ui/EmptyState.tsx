import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
  variant?: 'default' | 'bare'
  className?: string
}

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  variant = 'default',
  className,
}: EmptyStateProps) => (
  <div
    className={cn(
      'relative flex min-h-64 flex-col items-center justify-center overflow-hidden p-8 text-center',
      className,
    )}
  >
    {variant === 'default' ? (
      <div className="panel-grid absolute inset-0" aria-hidden="true" />
    ) : null}
    <div
      className={cn(
        'relative mb-3 flex size-10 items-center justify-center text-ink-muted',
        variant === 'default' && 'rounded-lg border border-border bg-surface-raised shadow-sm',
      )}
    >
      {icon}
    </div>
    <h2 className="relative text-sm font-semibold text-ink">{title}</h2>
    <p className="relative mt-1 max-w-md text-xs leading-relaxed text-ink-muted">{description}</p>
    {action ? <div className="relative mt-4">{action}</div> : null}
  </div>
)
