import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Circle, Pin, RadioTower, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'
import { modalBackdropClassName } from '@/components/ui/dialogStyles'
import { httpMethodTextClass } from '@/lib/http/method-display'
import { usePulseStore } from '@/state/pulse-store'

export const RequestTabs = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const data = usePulseStore((state) => state.data)
  const closeTab = usePulseStore((state) => state.closeTab)
  const saveRequest = usePulseStore((state) => state.saveRequest)
  const [pendingClose, setPendingClose] = useState<string | null>(null)

  const activate = (requestId: string) => {
    const request = data.requests.find((entry) => entry.id === requestId)
    if (!request) return
    navigate(
      request.protocol === 'grpc'
        ? `/w/${data.workspace.id}/grpc/${requestId}`
        : `/w/${data.workspace.id}/request/${requestId}`,
    )
  }

  const finishClose = (requestId: string) => {
    const wasActive = data.activeRequestId === requestId
    closeTab(requestId)
    if (wasActive) activate(usePulseStore.getState().data.activeRequestId)
    setPendingClose(null)
  }

  return (
    <>
      <nav
        className="flex h-10 shrink-0 gap-1 overflow-x-auto border-b border-border bg-surface-sunken px-2 pt-1"
        data-request-tabs
        aria-label={t('common.requests')}
      >
        {data.openTabs.map((tab) => {
          const request = data.requests.find((entry) => entry.id === tab.requestId)
          if (!request) return null
          const active = request.id === data.activeRequestId
          return (
            <div
              key={request.id}
              className={cn(
                'group flex min-w-40 max-w-60 shrink-0 items-center rounded-t-md border border-b-0 border-transparent',
                active
                  ? 'border-border bg-surface shadow-[0_-1px_0_rgba(255,255,255,0.02)]'
                  : 'hover:bg-surface-hover',
              )}
            >
              <button
                type="button"
                data-request-tab
                aria-current={active ? 'page' : undefined}
                onClick={() => activate(request.id)}
                className="flex min-w-0 flex-1 items-center gap-2 self-stretch px-3 text-left text-xs text-ink-muted hover:text-ink"
              >
                {tab.pinned ? (
                  <Pin className="size-3 shrink-0 text-ink-subtle" />
                ) : request.dirty ? (
                  <Circle className="size-2 shrink-0 fill-warning text-warning" />
                ) : null}
                {request.protocol === 'http' ? (
                  <span
                    className={cn(
                      'shrink-0 text-[10px] font-bold tracking-wide',
                      httpMethodTextClass(request.method),
                    )}
                  >
                    {request.method}
                  </span>
                ) : (
                  <RadioTower className="size-3.5 shrink-0 text-info" aria-label="gRPC" />
                )}
                <span className={cn('truncate', active && 'font-semibold text-ink')}>
                  {request.name}
                </span>
              </button>
              {!tab.pinned ? (
                <button
                  type="button"
                  onClick={() =>
                    request.dirty ? setPendingClose(request.id) : finishClose(request.id)
                  }
                  aria-label={`${t('workbench.closeTab')}: ${request.name}`}
                  className="mr-1 flex size-6 items-center justify-center rounded text-ink-subtle opacity-0 hover:bg-surface-sunken hover:text-ink focus:opacity-100 group-hover:opacity-100 max-md:opacity-100"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </div>
          )
        })}
      </nav>
      <AlertDialog.Root
        open={Boolean(pendingClose)}
        onOpenChange={(open) => {
          if (!open) setPendingClose(null)
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className={`${modalBackdropClassName} z-50`} />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface-raised p-5 shadow-panel">
            <AlertDialog.Title className="text-sm font-semibold">
              {t('workbench.requestDirty')}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-xs leading-relaxed text-ink-muted">
              {t('workbench.closeDraftHint')}
            </AlertDialog.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button>{t('common.cancel')}</Button>
              </AlertDialog.Cancel>
              <Button
                onClick={() => {
                  if (pendingClose) finishClose(pendingClose)
                }}
              >
                {t('workbench.keepDraft')}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (pendingClose) {
                    saveRequest(pendingClose)
                    finishClose(pendingClose)
                  }
                }}
              >
                {t('workbench.saveAndClose')}
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  )
}
