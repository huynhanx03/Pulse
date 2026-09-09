import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils/cn'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent'
}

const tones = {
  neutral: 'border-border bg-surface-sunken text-ink-muted',
  success: 'border-success/25 bg-success-soft text-success',
  warning: 'border-warning/25 bg-warning-soft text-warning',
  danger: 'border-danger/25 bg-danger-soft text-danger',
  info: 'border-info/25 bg-info-soft text-info',
  accent: 'border-accent/25 bg-accent-soft text-accent',
}

export const Badge = ({ className, tone = 'neutral', ...props }: BadgeProps) => (
  <span
    className={cn(
      'inline-flex min-h-5 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none',
      tones[tone],
      className,
    )}
    {...props}
  />
)
