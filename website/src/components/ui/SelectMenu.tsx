import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { useContext } from 'react'

import { SelectMenuPortalContext } from '@/components/ui/SelectMenuContext'
import { cn } from '@/lib/utils/cn'

export interface SelectMenuOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectMenuProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  options: SelectMenuOption[]
  placeholder?: string
  label: string
  className?: string
  disabled?: boolean
}

/**
 * The single select pattern for product surfaces. It deliberately replaces native
 * selects so each trigger, focus state and option list follows the same visual and
 * keyboard contract everywhere.
 */
export const SelectMenu = ({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  label,
  className,
  disabled = false,
}: SelectMenuProps) => (
  <Select.Root value={value} onValueChange={onValueChange} disabled={disabled}>
    <Select.Trigger
      id={id}
      aria-label={label}
      className={cn(
        'flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface-sunken px-3 text-left text-sm font-medium text-ink shadow-sm transition-[border-color,box-shadow,background-color,transform] hover:border-border-strong hover:bg-surface-raised focus:outline-none focus:ring-1 focus:ring-accent/70 data-[state=open]:border-accent data-[state=open]:bg-surface-raised data-[state=open]:ring-1 data-[state=open]:ring-accent/40 data-[state=open]:[&_svg]:rotate-180 data-[disabled]:cursor-not-allowed data-[disabled]:bg-surface-sunken data-[disabled]:text-ink-subtle max-md:h-11',
        className,
      )}
    >
      <Select.Value placeholder={placeholder} />
      <Select.Icon className="shrink-0 text-ink-subtle">
        <ChevronDown className="size-4 transition-transform duration-150" />
      </Select.Icon>
    </Select.Trigger>
    <SelectMenuContent options={options} />
  </Select.Root>
)

interface SelectMenuContentProps {
  options: SelectMenuOption[]
}

const SelectMenuContent = ({ options }: SelectMenuContentProps) => {
  const portalled = useContext(SelectMenuPortalContext)
  const content = (
    <Select.Content
      data-select-menu-content
      position="popper"
      sideOffset={6}
      className="z-[100] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-surface-raised p-1.5 shadow-panel data-[side=bottom]:animate-in data-[side=bottom]:fade-in-0 data-[side=bottom]:zoom-in-95"
    >
      <Select.Viewport className="p-0.5">
        {options.map((option) => (
          <Select.Item
            key={option.value}
            value={option.value}
            disabled={option.disabled ?? false}
            className="relative flex min-h-9 cursor-default select-none items-center rounded-md py-2 pl-8 pr-3 text-sm text-ink outline-none transition-colors data-[highlighted]:bg-surface-hover data-[state=checked]:bg-accent-soft data-[state=checked]:font-semibold data-[disabled]:pointer-events-none data-[disabled]:text-ink-subtle"
          >
            <Select.ItemIndicator className="absolute left-2 flex size-4 items-center justify-center text-accent">
              <Check className="size-3.5" />
            </Select.ItemIndicator>
            <Select.ItemText>{option.label}</Select.ItemText>
          </Select.Item>
        ))}
      </Select.Viewport>
    </Select.Content>
  )

  return portalled ? <Select.Portal>{content}</Select.Portal> : content
}
