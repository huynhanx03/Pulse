import * as Dialog from '@radix-ui/react-dialog'
import { SlidersHorizontal, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { modalBackdropClassName } from '@/components/ui/dialogStyles'
import { IconButton } from '@/components/ui/IconButton'
import { SelectMenuPortalContext } from '@/components/ui/SelectMenuContext'

interface FilterDrawerProps {
  title: string
  closeLabel: string
  clearLabel: string
  doneLabel: string
  activeCount: number
  onClear: () => void
  children: ReactNode
}

/** A reusable right-side filter sheet that keeps dense criteria out of the primary toolbar. */
export const FilterDrawer = ({
  title,
  closeLabel,
  clearLabel,
  doneLabel,
  activeCount,
  onClear,
  children,
}: FilterDrawerProps) => {
  const [open, setOpen] = useState(false)

  return (
    <Dialog.Root
      modal={false}
      open={open}
      // Select content is portalled outside this dialog. Ignore Radix's automatic
      // dismiss request so a select interaction cannot collapse the sheet.
      onOpenChange={(nextOpen) => {
        if (nextOpen) setOpen(true)
      }}
    >
      <Dialog.Trigger asChild>
        <Button
          size="sm"
          variant={activeCount ? 'secondary' : 'ghost'}
          icon={<SlidersHorizontal className="size-3.5" />}
        >
          {activeCount ? `${title} · ${activeCount}` : title}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <div
          aria-hidden="true"
          className={`${modalBackdropClassName} z-[70]`}
          onPointerDown={() => setOpen(false)}
        />
        <Dialog.Content
          aria-describedby={undefined}
          // Closing is owned by the backdrop, Done and ×. Prevent Radix from
          // interpreting an inline Select's open/close lifecycle as an outside click.
          onInteractOutside={(event) => event.preventDefault()}
          className="fixed inset-y-0 right-0 z-[71] flex w-[min(100vw,380px)] flex-col border-l border-border bg-surface-raised shadow-panel focus:outline-none"
        >
          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title>
            <IconButton
              label={closeLabel}
              icon={<X className="size-4" />}
              className="size-8"
              onClick={() => setOpen(false)}
            />
          </header>
          <SelectMenuPortalContext.Provider value={false}>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">{children}</div>
          </SelectMenuPortalContext.Provider>
          <footer className="flex items-center justify-between gap-3 border-t border-border bg-surface-sunken px-5 py-4">
            {activeCount ? (
              <Button size="sm" variant="ghost" onClick={onClear}>
                {clearLabel}
              </Button>
            ) : (
              <span />
            )}
            <Button size="sm" variant="primary" onClick={() => setOpen(false)}>
              {doneLabel}
            </Button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export interface ActiveFilterChip {
  id: string
  label: string
  value: string
  onRemove: () => void
}

interface ActiveFilterChipsProps {
  items: ActiveFilterChip[]
  clearLabel: string
  onClear: () => void
}

export const ActiveFilterChips = ({ items, clearLabel, onClear }: ActiveFilterChipsProps) => {
  if (!items.length) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={clearLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent-soft px-2 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={`${clearLabel}: ${item.label} ${item.value}`}
          onClick={item.onRemove}
        >
          <span className="text-ink-muted">{item.label}</span>
          <span>{item.value}</span>
          <X className="size-3" aria-hidden="true" />
        </button>
      ))}
      <Button size="sm" variant="ghost" className="h-7 min-h-7" onClick={onClear}>
        {clearLabel}
      </Button>
    </div>
  )
}
