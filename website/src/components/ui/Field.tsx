import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

import { cn } from '@/lib/utils/cn'

interface FieldShellProps {
  label: string
  htmlFor: string
  hint?: string
  children: ReactNode
  className?: string
}

export const FieldShell = ({ label, htmlFor, hint, children, className }: FieldShellProps) => (
  <div className={cn('grid min-w-0 gap-1.5', className)}>
    <div className="flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-ink-muted">
        {label}
      </label>
      {hint ? <span className="text-[11px] text-ink-subtle">{hint}</span> : null}
    </div>
    {children}
  </div>
)

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      'h-9 w-full min-w-0 rounded-md border border-border bg-surface-raised px-2.5 text-ink placeholder:text-ink-subtle transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-surface-sunken disabled:text-ink-subtle max-md:h-11',
      className,
    )}
    {...props}
  />
)

export const Textarea = ({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    className={cn(
      'min-h-24 w-full resize-y rounded-md border border-border bg-surface-raised p-2.5 font-mono text-[var(--editor-font-size)] text-ink placeholder:text-ink-subtle transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20',
      className,
    )}
    {...props}
  />
)
