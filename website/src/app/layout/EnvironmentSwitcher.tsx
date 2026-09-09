import { Check, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

import { EnvironmentMarker } from '@/components/environment/EnvironmentMarker'
import { cn } from '@/lib/utils/cn'
import { usePulseStore } from '@/state/pulse-store'

/** Replaces the native select with a compact environment menu and direct variable management. */
export const EnvironmentSwitcher = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const data = usePulseStore((state) => state.data)
  const selectEnvironment = usePulseStore((state) => state.selectEnvironment)
  const environment =
    data.environments.find((entry) => entry.id === data.activeEnvironmentId) ?? data.environments[0]

  if (!environment) return null

  const openVariables = () => {
    navigate(`/w/${encodeURIComponent(data.workspace.id)}/variables`)
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t('nav.activeEnvironment')}
          className="flex h-9 max-w-40 items-center gap-1.5 rounded-md border border-transparent px-2 text-xs font-semibold text-ink-muted transition-colors hover:border-border hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent max-md:h-11 max-md:max-w-32"
        >
          <EnvironmentMarker active className="size-2" />
          <span className="truncate">{environment.name}</span>
          <ChevronDown className="size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          aria-label={t('nav.activeEnvironment')}
          className="z-[90] w-[min(92vw,300px)] rounded-xl border border-border bg-surface-raised p-1.5 text-ink shadow-panel focus:outline-none"
        >
          <div className="px-2.5 pb-2 pt-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">
              {t('nav.activeEnvironment')}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">{t('nav.environmentSwitcherHint')}</p>
          </div>
          <div className="space-y-0.5">
            {data.environments.map((entry) => {
              const active = entry.id === environment.id
              return (
                <DropdownMenu.Item
                  key={entry.id}
                  onSelect={() => selectEnvironment(entry.id)}
                  className={cn(
                    'flex min-h-12 cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 outline-none transition-colors data-[highlighted]:bg-surface-hover',
                    active && 'bg-accent-soft',
                  )}
                >
                  <EnvironmentMarker active={active} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-ink">
                      {entry.name}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-ink-muted">
                      {t('nav.variableCount', { count: entry.variables.length })}
                    </span>
                  </span>
                  {active ? (
                    <Check className="size-4 shrink-0 text-accent" aria-hidden="true" />
                  ) : null}
                </DropdownMenu.Item>
              )
            })}
          </div>
          <DropdownMenu.Separator className="my-1.5 h-px bg-border" />
          <DropdownMenu.Item
            onSelect={openVariables}
            className="flex min-h-10 cursor-default items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-accent outline-none transition-colors data-[highlighted]:bg-accent-soft max-md:min-h-11"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            {t('nav.manageVariables')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
