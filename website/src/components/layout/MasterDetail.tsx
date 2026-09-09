import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

interface MasterDetailShellProps {
  children: ReactNode
  className?: string
}

/** Shared desktop composition for workspace resources: browse on the left, edit on the right. */
export const MasterDetailShell = ({ children, className }: MasterDetailShellProps) => (
  <div
    className={cn(
      'grid min-h-0 min-w-0 max-w-full flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-1',
      className,
    )}
  >
    {children}
  </div>
)

interface ResourceRailProps {
  title: string
  count: ReactNode
  action?: ReactNode
  toolbar?: ReactNode
  children: ReactNode
  className?: string
}

export const ResourceRail = ({
  title,
  count,
  action,
  toolbar,
  children,
  className,
}: ResourceRailProps) => (
  <aside
    className={cn(
      'flex min-h-0 flex-col border-b border-border bg-surface lg:border-b-0 lg:border-r',
      className,
    )}
  >
    <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
      <h2 className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-ink-subtle">
        {title}
      </h2>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-[11px] font-medium text-ink-subtle">{count}</span>
        {action}
      </div>
    </div>
    {toolbar ? <div className="border-b border-border px-3 pb-3">{toolbar}</div> : null}
    <div className="min-h-0 flex-1 overflow-auto p-2">{children}</div>
  </aside>
)

interface EditorHeaderProps {
  children: ReactNode
  actions?: ReactNode
  className?: string
}

export const EditorHeader = ({ children, actions, className }: EditorHeaderProps) => (
  <header
    className={cn(
      'flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border pb-4',
      className,
    )}
  >
    <div className="min-w-0">{children}</div>
    {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
  </header>
)

interface EditorToolbarProps {
  children: ReactNode
  className?: string
}

export const EditorToolbar = ({ children, className }: EditorToolbarProps) => (
  <div
    className={cn('mt-4 flex flex-wrap items-center gap-2 border-b border-border pb-3', className)}
  >
    {children}
  </div>
)
