import { Check, ChevronsUpDown, Layers3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

import { cn } from '@/lib/utils/cn'
import { usePulseStore } from '@/state/pulse-store'

const workspaceRoute = (pathname: string, workspaceId: string, fallbackRequestId: string) => {
  const nextWorkspace = encodeURIComponent(workspaceId)
  if (pathname.startsWith('/w/')) return pathname.replace(/^\/w\/[^/]+/, `/w/${nextWorkspace}`)
  return `/w/${nextWorkspace}/request/${encodeURIComponent(fallbackRequestId)}`
}

/** Accessible workspace directory; the current mock payload is swapped at the store boundary. */
export const WorkspaceSwitcher = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const data = usePulseStore((state) => state.data)
  const workspaces = usePulseStore((state) => state.workspaceDirectory)
  const selectWorkspace = usePulseStore((state) => state.selectWorkspace)

  const changeWorkspace = (workspaceId: string) => {
    selectWorkspace(workspaceId)
    const nextRequestId = usePulseStore.getState().data.activeRequestId
    navigate(workspaceRoute(location.pathname, workspaceId, nextRequestId))
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t('nav.workspaceSwitcher')}
          className="hidden h-8 max-w-56 items-center gap-2 rounded-md border border-transparent px-2 text-left text-xs font-medium text-ink-muted transition-colors hover:border-border hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:flex"
        >
          <span className="flex size-4 shrink-0 items-center justify-center rounded bg-accent-soft text-accent">
            <Layers3 className="size-3" aria-hidden="true" />
          </span>
          <span className="truncate">{data.workspace.name}</span>
          <ChevronsUpDown
            className="ml-auto size-3.5 shrink-0 text-ink-subtle"
            aria-hidden="true"
          />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          aria-label={t('nav.workspaceSwitcher')}
          className="z-[90] w-[min(92vw,348px)] rounded-xl border border-border bg-surface-raised p-1.5 text-ink shadow-panel focus:outline-none"
        >
          <div className="px-2.5 pb-2 pt-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">
              {t('nav.workspaces')}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">{t('nav.workspaceSwitcherHint')}</p>
          </div>
          <div className="space-y-0.5">
            {workspaces.map((workspace) => {
              const active = workspace.id === data.workspace.id
              return (
                <DropdownMenu.Item
                  key={workspace.id}
                  onSelect={() => changeWorkspace(workspace.id)}
                  className={cn(
                    'flex min-h-14 cursor-default items-center gap-3 rounded-lg px-2.5 py-2 outline-none transition-colors data-[highlighted]:bg-surface-hover',
                    active && 'bg-accent-soft',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-sunken text-ink-subtle',
                      active && 'border-accent/30 bg-accent text-on-accent',
                    )}
                  >
                    <Layers3 className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-ink">
                      {workspace.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-ink-muted">
                      {workspace.description}
                    </span>
                  </span>
                  {active ? (
                    <Check className="size-4 shrink-0 text-accent" aria-hidden="true" />
                  ) : null}
                </DropdownMenu.Item>
              )
            })}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
