import { Component, type ReactNode } from 'react'

import { PulseMark } from '@/components/brand/PulseLogo'
import { i18n } from '@/lib/i18n/i18n'

interface AppErrorBoundaryProps {
  children: ReactNode
  onResetWorkspace: () => void
  onReload?: () => void
}

interface AppErrorBoundaryState {
  hasError: boolean
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  private readonly resetWorkspace = () => {
    this.props.onResetWorkspace()
    this.setState({ hasError: false })
  }

  private readonly reloadPage = () => {
    if (this.props.onReload) {
      this.props.onReload()
      return
    }
    globalThis.location.reload()
  }

  override render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="relative min-h-dvh overflow-auto bg-canvas p-4 text-ink sm:p-8">
        <div className="panel-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <main className="relative mx-auto flex min-h-[calc(100dvh-2rem)] max-w-xl items-center sm:min-h-[calc(100dvh-4rem)]">
          <section
            role="alert"
            aria-live="assertive"
            aria-labelledby="app-recovery-title"
            aria-describedby="app-recovery-description app-recovery-reset-note"
            className="w-full rounded-xl border border-border bg-surface-raised p-6 shadow-panel sm:p-8"
          >
            <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-brand-graphite text-brand-signal">
              <PulseMark size={28} />
            </div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              {i18n.t('errors.recoveryEyebrow')}
            </p>
            <h1
              id="app-recovery-title"
              className="text-balance text-2xl font-bold tracking-[-0.035em] text-ink sm:text-3xl"
            >
              {i18n.t('errors.recoveryTitle')}
            </h1>
            <p
              id="app-recovery-description"
              className="mt-3 max-w-lg text-sm leading-6 text-ink-muted"
            >
              {i18n.t('errors.recoveryDescription')}
            </p>
            <p
              id="app-recovery-reset-note"
              className="mt-4 rounded-lg border border-warning/35 bg-warning-soft px-3 py-2.5 text-xs leading-5 text-ink"
            >
              {i18n.t('errors.recoveryResetNote')}
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={this.reloadPage}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-accent bg-accent px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
              >
                {i18n.t('errors.recoveryReload')}
              </button>
              <button
                type="button"
                onClick={this.resetWorkspace}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-danger bg-danger px-4 text-sm font-semibold text-on-danger transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger motion-reduce:transition-none"
              >
                {i18n.t('errors.recoveryReset')}
              </button>
            </div>
          </section>
        </main>
      </div>
    )
  }
}
