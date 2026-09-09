import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  action?: ReactNode
}

export const Panel = ({
  title,
  description,
  action,
  children,
  className,
  ...props
}: PanelProps) => (
  <section
    className={cn('min-w-0 rounded-lg border border-border bg-surface shadow-sm', className)}
    {...props}
  >
    {title || description || action ? (
      <header className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-2.5">
        <div className="min-w-0 flex-1 basis-36">
          {title ? <h2 className="truncate text-sm font-semibold text-ink">{title}</h2> : null}
          {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
        </div>
        {action}
      </header>
    ) : null}
    {children}
  </section>
)
