import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

const buttonVariants = cva(
  'inline-flex min-h-9 items-center justify-center gap-2 rounded-md border text-[13px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none max-md:min-h-11',
  {
    variants: {
      variant: {
        primary: 'border-accent bg-accent px-3 text-on-accent hover:bg-accent-hover',
        secondary:
          'border-border bg-surface-raised px-3 text-ink hover:border-border-strong hover:bg-surface-hover',
        ghost:
          'border-transparent bg-transparent px-2.5 text-ink-muted hover:bg-surface-hover hover:text-ink',
        danger: 'border-danger bg-danger px-3 text-on-danger hover:opacity-90',
      },
      size: {
        sm: 'min-h-8 px-2 text-xs max-md:min-h-10',
        md: '',
        lg: 'min-h-10 px-4 text-sm max-md:min-h-11',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      icon,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const Component = asChild ? Slot : 'button'
    return (
      <Component
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <LoaderCircle
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          icon
        )}
        {children}
      </Component>
    )
  },
)

Button.displayName = 'Button'
