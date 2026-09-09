import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils/cn'

interface EnvironmentMarkerProps extends HTMLAttributes<HTMLSpanElement> {
  active: boolean
}

/**
 * A single visual rule for an Environment everywhere in the product.
 * Green means it resolves requests now; blue means it is available but inactive.
 */
export const EnvironmentMarker = ({ active, className, ...props }: EnvironmentMarkerProps) => (
  <span
    aria-hidden="true"
    className={cn(
      'size-2.5 shrink-0 rounded-full',
      active ? 'bg-success shadow-[0_0_0_3px_var(--color-success-soft)]' : 'bg-sky-400',
      className,
    )}
    {...props}
  />
)
