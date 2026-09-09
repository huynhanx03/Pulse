import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export const ResponseHeader = ({ children }: { children: ReactNode }) => (
  <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
    {children}
  </header>
)

export type ResponseTabItem<T extends string> = {
  key: T
  label: ReactNode
}

export const ResponseTabs = <T extends string>({
  active,
  items,
  onChange,
  ariaLabel,
  trailing,
}: {
  active: T
  items: ResponseTabItem<T>[]
  onChange: (tab: T) => void
  ariaLabel: string
  trailing?: ReactNode
}) => (
  <div className="flex h-9 shrink-0 items-center border-b border-border bg-surface-sunken px-1">
    <div
      className="flex h-full min-w-0 flex-1 overflow-x-auto"
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={active === key}
          tabIndex={active === key ? 0 : -1}
          onClick={() => onChange(key)}
          className={cn(
            'relative flex h-full shrink-0 items-center gap-1.5 px-2.5 text-[10px] font-semibold text-ink-muted hover:text-ink',
            active === key &&
              'text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-accent',
          )}
        >
          {label}
        </button>
      ))}
    </div>
    {trailing ? <div className="ml-auto flex shrink-0 items-center">{trailing}</div> : null}
  </div>
)

export const ResponseKeyValueRows = ({ rows }: { rows: Array<{ key: string; value: string }> }) => (
  <div className="min-w-[480px] divide-y divide-border">
    {rows.map((row) => (
      <div
        key={row.key}
        className="grid grid-cols-[minmax(140px,0.45fr)_1fr] gap-3 px-4 py-2.5 text-xs"
      >
        <code className="text-accent">{row.key}</code>
        <code className="break-all text-ink-muted">{row.value}</code>
      </div>
    ))}
  </div>
)
