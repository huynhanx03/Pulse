import {
  Braces,
  Database,
  FlaskConical,
  FolderTree,
  History,
  Clock3,
  MoreHorizontal,
  Variable,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router-dom'
import { useState } from 'react'

import type { ApiRequest } from '@/domain/types'
import { cn } from '@/lib/utils/cn'
import { isWorkbenchRoute } from '@/app/routing/route-context'
import { usePulseStore } from '@/state/pulse-store'
import { modalBackdropClassName } from '@/components/ui/dialogStyles'

const navItems = [
  { key: 'workspace', icon: Braces },
  { key: 'runner', icon: FlaskConical },
  { key: 'variables', icon: Variable },
  { key: 'datasets', icon: Database },
  { key: 'automations', icon: Clock3 },
  { key: 'runs', icon: History },
] as const

export const ActivityRail = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const explorerOpen = usePulseStore((state) => state.explorerOpen)
  const setExplorerOpen = usePulseStore((state) => state.setExplorerOpen)
  const data = usePulseStore((state) => state.data)
  const activeRequest =
    data.requests.find((request) => request.id === data.activeRequestId) ?? data.requests[0]
  const requestPath = (request: ApiRequest | undefined) =>
    request
      ? `/w/${encodeURIComponent(data.workspace.id)}/${request.protocol === 'grpc' ? 'grpc' : 'request'}/${encodeURIComponent(request.id)}`
      : '/'
  const showCollections = isWorkbenchRoute(location.pathname)
  return (
    <>
      <nav
        aria-label={t('nav.primary')}
        className="desktop-activity-rail z-20 hidden w-40 shrink-0 flex-col border-r border-border bg-surface-sunken px-1.5 py-2 md:flex"
      >
        <div className="flex flex-1 flex-col gap-0.5">
          {navItems.map(({ key, icon: Icon }) => (
            <NavLink
              key={key}
              to={
                key === 'workspace'
                  ? requestPath(activeRequest)
                  : `/w/${data.workspace.id}/${key === 'runs' ? 'runs' : key}`
              }
              title={t(`nav.${key}`)}
              aria-label={t(`nav.${key}`)}
              className={({ isActive }) =>
                cn(
                  'relative flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-xs font-medium text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  isActive &&
                    'bg-accent-soft text-accent before:absolute before:left-[-7px] before:h-5 before:w-0.5 before:rounded-r before:bg-accent',
                )
              }
            >
              <Icon className="size-[18px]" aria-hidden="true" />
              <span>{t(`nav.${key}`)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
      <nav
        aria-label={t('nav.primary')}
        className="mobile-activity-rail fixed inset-x-0 bottom-0 z-40 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-stretch border-t border-border bg-surface px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <NavLink
          to={requestPath(activeRequest)}
          className={({ isActive }) =>
            cn(
              'relative flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium text-ink-subtle',
              isActive &&
                'text-accent before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-b before:bg-accent',
            )
          }
        >
          <Braces className="size-5" />
          {t('nav.workbench')}
        </NavLink>
        {showCollections ? (
          <button
            type="button"
            onClick={() => setExplorerOpen(true)}
            className={cn(
              'relative flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium text-ink-subtle',
              explorerOpen && 'text-accent',
            )}
          >
            <FolderTree className="size-5" />
            {t('nav.collections')}
          </button>
        ) : null}
        <NavLink
          to={`/w/${data.workspace.id}/runs`}
          className={({ isActive }) =>
            cn(
              'relative flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium text-ink-subtle',
              isActive &&
                'text-accent before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-b before:bg-accent',
            )
          }
        >
          <History className="size-5" />
          {t('nav.runs')}
        </NavLink>
        <Dialog.Root open={moreOpen} onOpenChange={setMoreOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              className="relative flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium text-ink-subtle hover:text-ink"
            >
              <MoreHorizontal className="size-5" aria-hidden="true" />
              {t('nav.more')}
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className={`${modalBackdropClassName} z-50`} />
            <Dialog.Content
              aria-describedby={undefined}
              className="mobile-more-sheet fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] rounded-xl border border-border bg-surface-raised p-3 shadow-panel focus:outline-none md:hidden"
            >
              <Dialog.Title className="px-2 pb-2 text-sm font-semibold text-ink">
                {t('nav.more')}
              </Dialog.Title>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'variables', icon: Variable },
                  { key: 'datasets', icon: Database },
                  { key: 'automations', icon: Clock3 },
                  { key: 'runner', icon: FlaskConical },
                ].map(({ key, icon: Icon }) => (
                  <NavLink
                    key={key}
                    to={`/w/${data.workspace.id}/${key}`}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-12 items-center gap-3 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-ink-muted hover:border-border-strong hover:bg-surface-hover hover:text-ink',
                        isActive && 'border-accent/40 bg-accent-soft text-accent',
                      )
                    }
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {t(`nav.${key}`)}
                  </NavLink>
                ))}
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </nav>
    </>
  )
}
import * as Dialog from '@radix-ui/react-dialog'
