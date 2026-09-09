import type { ComponentPropsWithoutRef } from 'react'

import { httpMethodTone } from '@/lib/http/method-display'
import { cn } from '@/lib/utils/cn'

import { Badge } from './Badge'

interface HttpMethodBadgeProps extends ComponentPropsWithoutRef<typeof Badge> {
  method: string | undefined
}

/** Stable, semantic HTTP-method presentation shared by every request surface. */
export const HttpMethodBadge = ({ method, className, ...props }: HttpMethodBadgeProps) => (
  <Badge
    tone={httpMethodTone(method)}
    className={cn('min-w-10 justify-center font-bold tracking-wide', className)}
    {...props}
  >
    {method ?? '—'}
  </Badge>
)
