import * as SwitchPrimitive from '@radix-ui/react-switch'

import { cn } from '@/lib/utils/cn'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  className?: string
}

export const Switch = ({ checked, onCheckedChange, label, className }: SwitchProps) => (
  <SwitchPrimitive.Root
    checked={checked}
    onCheckedChange={onCheckedChange}
    aria-label={label}
    className={cn(
      'relative h-5 w-9 shrink-0 rounded-full border border-border-strong bg-surface-sunken transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
      className,
    )}
  >
    <SwitchPrimitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-ink-muted shadow-sm transition-transform data-[state=checked]:translate-x-[17px] data-[state=checked]:bg-white" />
  </SwitchPrimitive.Root>
)
