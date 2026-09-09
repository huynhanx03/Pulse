import { CheckCircle2, ChevronRight, Eye, EyeOff, Layers3, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/Badge'
import { IconButton } from '@/components/ui/IconButton'
import { maskSecret } from '@/lib/utils/secret'
import type { ResolutionTraceEntry } from '@/lib/variables/variable-engine'
import { usePulseStore } from '@/state/pulse-store'

export const ResolutionInspector = () => {
  const { t } = useTranslation()
  const [reveal, setReveal] = useState(false)
  const data = usePulseStore((state) => state.data)
  const resolution = usePulseStore((state) => state.lastResolution)
  const setInspectorOpen = usePulseStore((state) => state.setInspectorOpen)
  const environment = data.environments.find((entry) => entry.id === data.activeEnvironmentId)
  const request = data.requests.find((entry) => entry.id === data.activeRequestId)
  const values = environment?.variables.filter((variable) => variable.enabled) ?? []
  const redactResolved = (value: string, trace: readonly ResolutionTraceEntry[] = []) =>
    trace
      .filter((entry) => entry.masked && entry.value)
      .reduce((current, entry) => current.replaceAll(entry.value, '••••••••'), value)

  return (
    <aside
      className="absolute inset-y-0 right-0 z-30 flex min-h-0 w-full md:w-[284px] shrink-0 flex-col border-l border-border bg-surface shadow-panel md:flex 2xl:static 2xl:shadow-none"
      aria-label={t('nav.inspector')}
    >
      <header className="flex h-11 items-center gap-2 border-b border-border px-3">
        <Layers3 className="size-4 text-accent" />
        <h2 className="text-xs font-semibold">{t('workbench.inspectorTitle')}</h2>
        <IconButton
          label={t('common.close')}
          icon={<X className="size-3.5" />}
          className="ml-auto size-7"
          onClick={() => setInspectorOpen(false)}
        />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
              {t('workbench.requestResolved')}
            </p>
            <IconButton
              label={reveal ? t('common.hide') : t('common.reveal')}
              icon={reveal ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
              className="size-7"
              onClick={() => setReveal(!reveal)}
            />
          </div>
          <div className="mt-2 space-y-2">
            <div>
              <p className="mb-1 text-[10px] text-ink-subtle">URL</p>
              <code className="block break-all rounded bg-surface-sunken p-2 text-[10px] leading-relaxed text-ink">
                {resolution
                  ? redactResolved(resolution.url.value, resolution.url.trace)
                  : request?.url}
              </code>
            </div>
            <div>
              <p className="mb-1 text-[10px] text-ink-subtle">Body</p>
              <code className="block max-h-28 overflow-auto whitespace-pre-wrap rounded bg-surface-sunken p-2 text-[10px] leading-relaxed text-ink">
                {resolution
                  ? redactResolved(resolution.body.value, resolution.body.trace)
                  : request?.body}
              </code>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-success">
            <CheckCircle2 className="size-3" />
            {resolution?.url.unresolved.length || resolution?.body.unresolved.length
              ? t('workbench.unresolvedVariables')
              : t('workbench.noUnresolvedVariables')}
          </div>
        </div>
        <div className="p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
            {t('variables.resolutionTrace')}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-ink-subtle">
            {t('variables.precedence')}
          </p>
          <div className="mt-3 space-y-1.5">
            {values.map((variable) => (
              <div
                key={variable.id}
                className="rounded-md border border-border bg-surface-raised p-2"
              >
                <div className="flex items-center gap-1.5">
                  <code className="truncate text-[11px] font-semibold text-accent">
                    {variable.key}
                  </code>
                  <ChevronRight className="size-3 text-ink-subtle" />
                  <Badge tone="neutral" className="ml-auto">
                    environment
                  </Badge>
                </div>
                <code className="mt-1 block truncate text-[10px] text-ink-muted">
                  {variable.secret && !reveal ? maskSecret(variable.value) : variable.value || '—'}
                </code>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}
