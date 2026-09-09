import { useEffect, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router-dom'

import { ActivityRail } from '@/app/layout/ActivityRail'
import { CommandPalette } from '@/app/layout/CommandPalette'
import { ExplorerPanel } from '@/app/layout/ExplorerPanel'
import { RequestTabs } from '@/app/layout/RequestTabs'
import { TopBar } from '@/app/layout/TopBar'
import { isRequestTabRoute, isWorkbenchRoute } from '@/app/routing/route-context'
import { usePulseStore } from '@/state/pulse-store'
import { navigateTabList } from '@/lib/utils/tab-navigation'

export const AppShell = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const [explorerWidth, setExplorerWidth] = useState(272)
  const toastMessage = usePulseStore((state) => state.toastMessage)
  const clearToast = usePulseStore((state) => state.clearToast)
  const showWorkbenchChrome = isWorkbenchRoute(location.pathname)
  const showTabs = isRequestTabRoute(location.pathname)

  useEffect(() => {
    if (!toastMessage) return
    const timer = globalThis.setTimeout(clearToast, 2400)
    return () => globalThis.clearTimeout(timer)
  }, [clearToast, toastMessage])

  const beginResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const startX = event.clientX
    const current = explorerWidth
    const onMove = (moveEvent: PointerEvent) => {
      const next = Math.min(420, Math.max(220, current + moveEvent.clientX - startX))
      setExplorerWidth(next)
    }
    const onEnd = () => {
      globalThis.removeEventListener('pointermove', onMove)
      globalThis.removeEventListener('pointerup', onEnd)
    }
    globalThis.addEventListener('pointermove', onMove)
    globalThis.addEventListener('pointerup', onEnd)
  }

  const resizeWithKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    if (event.key === 'Home') setExplorerWidth(220)
    else if (event.key === 'End') setExplorerWidth(420)
    else
      setExplorerWidth((current) =>
        Math.min(420, Math.max(220, current + (event.key === 'ArrowRight' ? 12 : -12))),
      )
  }

  return (
    <div
      onKeyDown={navigateTabList}
      style={{ '--explorer-width': `${explorerWidth}px` } as CSSProperties}
      className="flex h-dvh w-full flex-col overflow-hidden bg-canvas"
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent"
      >
        {t('common.skipToContent')}
      </a>
      <TopBar />
      <div className="shell-main-row flex min-h-0 min-w-0 max-w-full flex-1 overflow-hidden max-md:pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <ActivityRail />
        {showWorkbenchChrome ? <ExplorerPanel /> : null}
        {showWorkbenchChrome ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t('nav.resizeExplorer')}
            aria-valuemin={220}
            aria-valuemax={420}
            aria-valuenow={explorerWidth}
            tabIndex={0}
            onPointerDown={beginResize}
            onKeyDown={resizeWithKeyboard}
            className="desktop-explorer-resizer z-10 hidden w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-accent/50 focus-visible:bg-accent md:block"
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          {showTabs ? <RequestTabs /> : null}
          <main id="main-content" className="min-h-0 flex-1 overflow-hidden" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
      <CommandPalette />
      <div
        role="status"
        className="pointer-events-none fixed bottom-10 left-1/2 z-[90] max-w-[90vw] -translate-x-1/2 max-md:bottom-20"
        aria-live="polite"
        aria-atomic="true"
      >
        {toastMessage ? (
          <div className="rounded-md border border-border-strong bg-surface-raised px-3 py-2 text-xs font-medium text-ink shadow-panel">
            {toastMessage}
          </div>
        ) : null}
      </div>
    </div>
  )
}
