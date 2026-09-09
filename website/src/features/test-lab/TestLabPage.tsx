import {
  AlertTriangle,
  CheckCircle2,
  CircleStop,
  Download,
  Gauge,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Rocket,
  Rows3,
  TrendingUp,
  UsersRound,
  X,
  Zap,
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { FieldShell, Input } from '@/components/ui/Field'
import { IconButton } from '@/components/ui/IconButton'
import { StatusBadge, type StatusKind } from '@/components/ui/StatusBadge'
import { modalBackdropClassName } from '@/components/ui/dialogStyles'
import { MasterDetailShell } from '@/components/layout/MasterDetail'
import { Panel } from '@/components/ui/Panel'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { SelectMenu } from '@/components/ui/SelectMenu'
import { RequestSearchList, RequestTargetSummary } from '@/components/request/RequestPicker'
import type { RunnerMode } from '@/domain/runner/types'
import { formatNumber, formatPercent } from '@/lib/i18n/formatters'
import { usePulseStore } from '@/state/pulse-store'
import type { RunConfiguration } from '@/state/store-types'
import { cn } from '@/lib/utils/cn'

const modes: Array<{ mode: RunnerMode; key: string; icon: typeof Play; hint: string }> = [
  { mode: 'functional', key: 'functional', icon: CheckCircle2, hint: 'functionalHint' },
  { mode: 'data', key: 'data', icon: Rows3, hint: 'dataHint' },
  { mode: 'race', key: 'race', icon: Zap, hint: 'raceHint' },
  { mode: 'constant-vus', key: 'constantUsers', icon: UsersRound, hint: 'constantUsersHint' },
  { mode: 'ramping-vus', key: 'rampingUsers', icon: TrendingUp, hint: 'rampingUsersHint' },
  { mode: 'arrival-rate', key: 'arrivalRate', icon: Rocket, hint: 'arrivalHint' },
]

const MetricCard = ({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
}) => (
  <div className="rounded-lg border border-border bg-surface-raised p-3 shadow-sm">
    <div className="flex items-center justify-between gap-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">{label}</p>
      <span
        className={cn(
          'size-1.5 rounded-full',
          tone === 'success'
            ? 'bg-success'
            : tone === 'warning'
              ? 'bg-warning'
              : tone === 'danger'
                ? 'bg-danger'
                : tone === 'info'
                  ? 'bg-info'
                  : 'bg-ink-subtle',
        )}
      />
    </div>
    <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-ink">{value}</p>
    {hint ? <p className="mt-0.5 text-[10px] text-ink-subtle">{hint}</p> : null}
  </div>
)

const NumberField = ({
  label,
  id,
  value,
  onValueChange,
  unit,
  className,
}: {
  label: string
  id: string
  value: number
  onValueChange: (value: number) => void
  unit?: string
  className?: string
}) => (
  <FieldShell label={label} htmlFor={id} {...(className ? { className } : {})}>
    <div className="relative">
      <Input
        id={id}
        type="number"
        min={1}
        max={1000}
        value={value}
        onChange={(event) => onValueChange(Number(event.target.value))}
        className={unit ? 'pr-10' : undefined}
      />
      {unit ? (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-ink-subtle">
          {unit}
        </span>
      ) : null}
    </div>
  </FieldShell>
)

const TestLabPage = () => {
  const { t } = useTranslation()
  const data = usePulseStore((state) => state.data)
  const locale = usePulseStore((state) => state.preferences.locale)
  const config = usePulseStore((state) => state.runConfig)
  const updateConfig = usePulseStore((state) => state.updateRunConfig)
  const startRun = usePulseStore((state) => state.startRun)
  const stopRun = usePulseStore((state) => state.stopRun)
  const pauseRun = usePulseStore((state) => state.pauseRun)
  const resumeRun = usePulseStore((state) => state.resumeRun)
  const runState = usePulseStore((state) => state.runState)
  const progress = usePulseStore((state) => state.runProgress)
  const result = usePulseStore((state) => state.activeRunResult)
  const [targetEditorOpen, setTargetEditorOpen] = useState(false)
  const [draftConfig, setDraftConfig] = useState<RunConfiguration | null>(null)
  const activeConfig = usePulseStore((state) => state.activeRunConfig) ?? config
  const activeSeries = result?.series ?? []
  const running = runState === 'running'
  const paused = runState === 'paused'
  const errorRate = result?.metrics.total ? result.metrics.failures / result.metrics.total : 0
  const failureGroups = result?.checks.filter((check) => check.failed > 0) ?? []
  const targetSettings = (() => {
    if (config.mode === 'race') {
      return [
        { label: t('runner.concurrentAttempts'), value: formatNumber(config.workers, locale, 0) },
      ]
    }
    if (config.mode === 'constant-vus') {
      return [
        { label: t('runner.workers'), value: formatNumber(config.workers, locale, 0) },
        { label: t('runner.duration'), value: `${config.durationSeconds} s` },
      ]
    }
    if (config.mode === 'ramping-vus') {
      return [
        { label: t('runner.peakVus'), value: formatNumber(config.workers, locale, 0) },
        { label: t('runner.rampUp'), value: `${config.rampUpSeconds} s` },
        { label: t('runner.hold'), value: `${config.holdSeconds} s` },
        { label: t('runner.rampDown'), value: `${config.rampDownSeconds} s` },
      ]
    }
    if (config.mode === 'arrival-rate') {
      return [
        { label: t('runner.targetRate'), value: `${config.targetRate} req/s` },
        { label: t('runner.maxVus'), value: formatNumber(config.workers, locale, 0) },
        { label: t('runner.duration'), value: `${config.durationSeconds} s` },
      ]
    }
    if (config.mode === 'data') {
      return [
        {
          label: t('runner.dataset'),
          value: data.datasets.find((dataset) => dataset.id === config.datasetId)?.name ?? '—',
        },
        { label: t('runner.iterations'), value: formatNumber(config.iterations, locale, 0) },
      ]
    }
    return []
  })()
  const runStateLabel =
    runState === 'idle'
      ? t('runner.readyState')
      : runState === 'running'
        ? t('runner.runningState')
        : runState === 'paused'
          ? t('runner.pausedState')
          : runState === 'stopped'
            ? t('runner.stoppedState')
            : runState === 'failed'
              ? t('runner.failedState')
              : t('runner.completedState')
  const runStatus: StatusKind =
    runState === 'complete' ? 'success' : runState === 'idle' ? 'ready' : runState
  const openTargetEditor = () => {
    setDraftConfig({ ...config })
    setTargetEditorOpen(true)
  }
  const closeTargetEditor = () => {
    setTargetEditorOpen(false)
    setDraftConfig(null)
  }
  const updateDraftConfig = (patch: Partial<RunConfiguration>) => {
    setDraftConfig((current) => (current ? { ...current, ...patch } : current))
  }
  const updateDraftRamp = (
    patch: Partial<Pick<RunConfiguration, 'rampUpSeconds' | 'holdSeconds' | 'rampDownSeconds'>>,
  ) => {
    setDraftConfig((current) => {
      if (!current) return current
      const next = { ...current, ...patch }
      return {
        ...next,
        durationSeconds: next.rampUpSeconds + next.holdSeconds + next.rampDownSeconds,
      }
    })
  }
  const saveTargetEditor = () => {
    if (!draftConfig) return
    updateConfig(draftConfig)
    closeTargetEditor()
  }
  const randomizeSeed = () => {
    updateConfig({ seed: Math.floor(100_000_000 + Math.random() * 900_000_000) })
  }

  const exportReport = () => {
    if (!result) return
    const blob = new Blob(
      [JSON.stringify({ mode: 'browser-local-mock', config: activeConfig, result }, null, 2)],
      { type: 'application/json' },
    )
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `pulse-run-${activeConfig.mode}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-canvas">
      <SectionHeading
        eyebrow={t('runner.eyebrow')}
        title={t('runner.title')}
        description={t('runner.subtitle')}
        actions={
          <>
            <div className="flex h-9 items-center gap-1 rounded-md border border-border bg-surface-raised pl-2">
              <label htmlFor="runner-seed" className="text-[11px] font-semibold text-ink-muted">
                {t('runner.seed')}
              </label>
              <Input
                id="runner-seed"
                type="number"
                value={config.seed}
                onChange={(event) => updateConfig({ seed: Number(event.target.value) })}
                className="h-7 w-24 border-0 bg-transparent px-1 font-mono text-xs focus-visible:ring-0"
              />
              <IconButton
                label={t('runner.randomizeSeed')}
                icon={<RefreshCw className="size-3.5" />}
                className="size-8 shrink-0"
                onClick={randomizeSeed}
              />
            </div>
            {running || paused ? (
              <>
                <Button
                  icon={paused ? <Play className="size-4" /> : <Pause className="size-4" />}
                  onClick={paused ? resumeRun : pauseRun}
                >
                  {t(paused ? 'runner.resumeRun' : 'runner.pauseRun')}
                </Button>
                <Button variant="danger" icon={<CircleStop className="size-4" />} onClick={stopRun}>
                  {t('runner.stopRun')}
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                icon={<Play className="size-4" />}
                onClick={() => void startRun()}
              >
                {t('runner.startRun')}
              </Button>
            )}
          </>
        }
      />
      <MasterDetailShell>
        <aside className="min-h-0 overflow-auto border-b border-border bg-surface lg:border-b-0 lg:border-r">
          <fieldset disabled={running || paused} className="min-w-0 space-y-3 p-3">
            <Panel title={t('runner.mode')} description={t('runner.executionModel')}>
              <div className="grid gap-1.5 p-2">
                {modes.map(({ mode, key, icon: Icon, hint }) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={config.mode === mode}
                    onClick={() => updateConfig({ mode })}
                    className={cn(
                      'flex items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-left hover:bg-surface-hover disabled:cursor-default',
                      config.mode === mode && 'border-accent/25 bg-accent-soft',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-8 items-center justify-center rounded-md border border-border bg-surface-raised text-ink-muted',
                        config.mode === mode && 'border-accent/20 text-accent',
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <p
                        className={cn(
                          'text-xs font-semibold',
                          config.mode === mode ? 'text-accent' : 'text-ink',
                        )}
                      >
                        {t(`runner.${key}`)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-ink-muted">{t(`runner.${hint}`)}</p>
                    </div>
                    {config.mode === mode ? (
                      <CheckCircle2 className="ml-auto size-4 text-accent" />
                    ) : null}
                  </button>
                ))}
              </div>
            </Panel>
            <Panel
              title={t('runs.target')}
              action={
                <IconButton
                  label={t('runner.editTarget')}
                  icon={<Pencil className="size-4" />}
                  className="size-8"
                  onClick={openTargetEditor}
                />
              }
            >
              <div className="p-3">
                <RequestTargetSummary
                  value={config.requestId}
                  requests={data.requests}
                  collections={data.collections}
                  label={t('runs.target')}
                />
                {targetSettings.length ? (
                  <div
                    className={cn(
                      'mt-3 grid gap-2',
                      targetSettings.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
                    )}
                  >
                    {targetSettings.map((setting) => (
                      <div key={setting.label} className="rounded-md bg-surface-sunken px-2.5 py-2">
                        <p className="text-[10px] font-semibold text-ink-subtle">{setting.label}</p>
                        <p className="mt-0.5 text-sm font-semibold text-ink">{setting.value}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </Panel>
          </fieldset>

          <Dialog.Root
            open={targetEditorOpen}
            onOpenChange={(open) => (open ? setTargetEditorOpen(true) : closeTargetEditor())}
          >
            <Dialog.Portal>
              <Dialog.Overlay className={`${modalBackdropClassName} z-[70]`} />
              <Dialog.Content
                aria-describedby="runner-target-editor-hint"
                className="fixed left-1/2 top-1/2 z-[71] flex max-h-[calc(100vh-3rem)] w-[min(calc(100vw-3rem),1024px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-surface-raised shadow-panel focus:outline-none"
              >
                <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
                  <div>
                    <Dialog.Title className="text-base font-semibold text-ink">
                      {t('runner.configureTarget')}
                    </Dialog.Title>
                    <Dialog.Description
                      id="runner-target-editor-hint"
                      className="mt-1 text-xs text-ink-muted"
                    >
                      {t('runner.targetEditorHint')}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <IconButton
                      label={t('common.close')}
                      icon={<X className="size-4" />}
                      className="size-8"
                    />
                  </Dialog.Close>
                </div>
                {draftConfig ? (
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    <div className="space-y-5">
                      <section>
                        <p className="mb-2 text-xs font-semibold text-ink-muted">
                          {t('runs.target')}
                        </p>
                        <RequestSearchList
                          value={draftConfig.requestId}
                          onValueChange={(requestId) => updateDraftConfig({ requestId })}
                          requests={data.requests}
                          collections={data.collections}
                          label={t('runs.target')}
                          placeholder={t('runner.searchRequests')}
                          emptyLabel={t('runner.noMatchingRequests')}
                          previousPageLabel={t('runner.previousPage')}
                          nextPageLabel={t('runner.nextPage')}
                          pageLabel={(page, total) => t('runner.requestPage', { page, total })}
                          columns={{
                            method: t('runner.requestMethod'),
                            request: t('runner.requestName'),
                            collection: t('runner.requestCollection'),
                            route: t('runner.requestRoute'),
                            selected: t('runner.requestSelected'),
                          }}
                          resultCountLabel={(count) => t('runner.requestCount', { count })}
                        />
                      </section>

                      <section className="border-t border-border pt-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold text-ink-muted">
                            {t('runner.runSettings')}
                          </p>
                          <Badge tone="info">
                            {t(
                              `runner.${modes.find((item) => item.mode === draftConfig.mode)?.key ?? 'functional'}`,
                            )}
                          </Badge>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {draftConfig.mode === 'race' ? (
                            <NumberField
                              label={t('runner.concurrentAttempts')}
                              id="editor-runner-workers"
                              value={draftConfig.workers}
                              onValueChange={(workers) => updateDraftConfig({ workers })}
                              className="max-w-xs"
                            />
                          ) : null}
                          {draftConfig.mode === 'constant-vus' ? (
                            <>
                              <NumberField
                                label={t('runner.workers')}
                                id="editor-runner-workers"
                                value={draftConfig.workers}
                                onValueChange={(workers) => updateDraftConfig({ workers })}
                              />
                              <NumberField
                                label={t('runner.duration')}
                                id="editor-runner-duration"
                                value={draftConfig.durationSeconds}
                                onValueChange={(durationSeconds) =>
                                  updateDraftConfig({ durationSeconds })
                                }
                                unit="s"
                              />
                            </>
                          ) : null}
                          {draftConfig.mode === 'ramping-vus' ? (
                            <>
                              <NumberField
                                label={t('runner.peakVus')}
                                id="editor-runner-workers"
                                value={draftConfig.workers}
                                onValueChange={(workers) => updateDraftConfig({ workers })}
                              />
                              <NumberField
                                label={t('runner.rampUp')}
                                id="editor-runner-ramp-up"
                                value={draftConfig.rampUpSeconds}
                                onValueChange={(rampUpSeconds) =>
                                  updateDraftRamp({ rampUpSeconds })
                                }
                                unit="s"
                              />
                              <NumberField
                                label={t('runner.hold')}
                                id="editor-runner-hold"
                                value={draftConfig.holdSeconds}
                                onValueChange={(holdSeconds) => updateDraftRamp({ holdSeconds })}
                                unit="s"
                              />
                              <NumberField
                                label={t('runner.rampDown')}
                                id="editor-runner-ramp-down"
                                value={draftConfig.rampDownSeconds}
                                onValueChange={(rampDownSeconds) =>
                                  updateDraftRamp({ rampDownSeconds })
                                }
                                unit="s"
                              />
                            </>
                          ) : null}
                          {draftConfig.mode === 'arrival-rate' ? (
                            <>
                              <NumberField
                                label={t('runner.targetRate')}
                                id="editor-runner-rate"
                                value={draftConfig.targetRate}
                                onValueChange={(targetRate) => updateDraftConfig({ targetRate })}
                                unit="req/s"
                              />
                              <NumberField
                                label={t('runner.maxVus')}
                                id="editor-runner-workers"
                                value={draftConfig.workers}
                                onValueChange={(workers) => updateDraftConfig({ workers })}
                              />
                              <NumberField
                                label={t('runner.duration')}
                                id="editor-runner-duration"
                                value={draftConfig.durationSeconds}
                                onValueChange={(durationSeconds) =>
                                  updateDraftConfig({ durationSeconds })
                                }
                                unit="s"
                              />
                            </>
                          ) : null}
                          {draftConfig.mode === 'data' ? (
                            <>
                              <FieldShell
                                label={t('runner.dataset')}
                                htmlFor="editor-runner-dataset"
                              >
                                <SelectMenu
                                  id="editor-runner-dataset"
                                  value={draftConfig.datasetId}
                                  onValueChange={(datasetId) => updateDraftConfig({ datasetId })}
                                  label={t('runner.dataset')}
                                  options={data.datasets.map((dataset) => ({
                                    value: dataset.id,
                                    label: dataset.name,
                                  }))}
                                />
                              </FieldShell>
                              <NumberField
                                label={t('runner.iterations')}
                                id="editor-runner-iterations"
                                value={draftConfig.iterations}
                                onValueChange={(iterations) => updateDraftConfig({ iterations })}
                              />
                            </>
                          ) : null}
                          {draftConfig.mode === 'functional' ? (
                            <p className="rounded-md bg-surface-sunken px-3 py-2 text-xs leading-relaxed text-ink-muted sm:col-span-2 xl:col-span-4">
                              {t('runner.functionalHint')}
                            </p>
                          ) : null}
                        </div>
                      </section>
                    </div>
                  </div>
                ) : null}
                <div className="flex justify-end gap-2 border-t border-border bg-surface-sunken px-5 py-4">
                  <Button variant="ghost" onClick={closeTargetEditor}>
                    {t('common.cancel')}
                  </Button>
                  <Button variant="primary" onClick={saveTargetEditor}>
                    {t('common.save')}
                  </Button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </aside>

        <section className="min-w-0 overflow-auto" aria-label={t('runner.title')}>
          <div className="space-y-3 px-8 py-6">
            <Panel
              title={t('runner.liveMetrics')}
              description={t(
                `runner.${modes.find((item) => item.mode === activeConfig.mode)?.key ?? 'functional'}`,
              )}
              action={
                <div className="flex items-center gap-2" aria-live="polite">
                  <StatusBadge status={runStatus}>{runStateLabel}</StatusBadge>
                  {result ? (
                    <Button
                      size="sm"
                      disabled={running || paused}
                      icon={<Download className="size-3.5" />}
                      onClick={exportReport}
                    >
                      {t('runner.exportReport')}
                    </Button>
                  ) : null}
                </div>
              }
            >
              <div className="p-3">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4 2xl:grid-cols-7">
                  <MetricCard
                    label={t('runner.requestsTotal')}
                    value={formatNumber(result?.metrics.total ?? 0, locale, 0)}
                    hint={`${progress}%`}
                  />
                  <MetricCard
                    label={t('runner.passed')}
                    value={formatNumber(result?.metrics.passed ?? 0, locale, 0)}
                    tone="success"
                  />
                  <MetricCard
                    label={t('runner.failures')}
                    value={formatNumber(result?.metrics.failures ?? 0, locale, 0)}
                    tone={result?.metrics.failures ? 'danger' : 'success'}
                  />
                  <MetricCard
                    label={t('runner.errorRate')}
                    value={formatPercent(errorRate, locale)}
                    tone={errorRate ? 'danger' : 'success'}
                  />
                  <MetricCard
                    label={t('runner.dropped')}
                    value={formatNumber(result?.metrics.dropped ?? 0, locale, 0)}
                    tone={result?.metrics.dropped ? 'warning' : 'neutral'}
                  />
                  <MetricCard
                    label={t('runner.throughput')}
                    value={`${formatNumber(result?.metrics.throughput ?? 0, locale)} rps`}
                    tone="info"
                  />
                  <MetricCard
                    label={t('runner.p95')}
                    value={`${result?.metrics.p95 ?? 0} ms`}
                    tone="info"
                  />
                </div>
                {runState !== 'idle' ? (
                  <div
                    className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                    aria-label={t('runner.runProgress')}
                  >
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-300 motion-reduce:transition-none"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                ) : null}
                {runState === 'failed' ? (
                  <div role="alert" className="mt-3 flex items-start gap-2 text-xs text-danger">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <div>
                      <p className="font-semibold">{t('runner.runFailed')}</p>
                      <p className="mt-0.5 text-ink-muted">{t('runner.runFailedHint')}</p>
                    </div>
                  </div>
                ) : null}
                {result?.series.length ? (
                  <div
                    className="mt-3 h-[320px] rounded-lg border border-border bg-surface-raised p-3"
                    aria-label={t('runner.chart')}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={activeSeries}
                        margin={{ top: 10, right: 4, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid
                          stroke="var(--border)"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="second"
                          tick={{ fill: 'var(--ink-subtle)', fontSize: 10 }}
                          axisLine={{ stroke: 'var(--border)' }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: 'var(--ink-subtle)', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="latency"
                          orientation="right"
                          width={38}
                          unit="ms"
                          tick={{ fill: 'var(--ink-subtle)', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--surface-raised)',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            fontSize: 11,
                          }}
                        />
                        <Area
                          name={t('runner.throughput')}
                          type="monotone"
                          dataKey="throughput"
                          stroke="var(--accent)"
                          fill="var(--accent-soft)"
                          fillOpacity={0.55}
                          strokeWidth={2}
                          isAnimationActive={false}
                        />
                        <Line
                          name="p95 (ms)"
                          yAxisId="latency"
                          type="monotone"
                          dataKey="p95"
                          stroke="var(--info)"
                          dot={activeSeries.length === 1}
                          strokeWidth={1.5}
                          isAnimationActive={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}
              </div>
            </Panel>

            {result ? (
              <div className="grid items-start gap-3 lg:grid-cols-2">
                <Panel
                  title={t('runner.checks')}
                  action={
                    <Badge tone={result.metrics.failures ? 'warning' : 'success'}>
                      {result.checks.length}
                    </Badge>
                  }
                >
                  <div className="divide-y divide-border">
                    {result.checks.map((check) => (
                      <div key={check.name} className="flex items-center gap-2 px-3 py-2.5">
                        <CheckCircle2
                          className={cn('size-3.5', check.failed ? 'text-warning' : 'text-success')}
                        />
                        <span className="text-xs">{check.name}</span>
                        <span className="ml-auto text-[10px] text-success">
                          {check.passed} pass
                        </span>
                        {check.failed ? (
                          <span className="text-[10px] text-danger">{check.failed} fail</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </Panel>
                {activeConfig.mode === 'race' ? (
                  <Panel
                    title={t('runner.collisions')}
                    action={
                      <Badge tone="warning">
                        {formatPercent(result.metrics.collisionRate, locale)}
                      </Badge>
                    }
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[420px] text-left text-[11px]">
                        <thead className="bg-surface-sunken text-ink-subtle">
                          <tr>
                            <th className="px-3 py-2">{t('runner.resource')}</th>
                            <th className="px-3 py-2">{t('runner.attempts')}</th>
                            <th className="px-3 py-2">{t('runner.winners')}</th>
                            <th className="px-3 py-2">{t('runner.conflicts')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.collisions.map((row) => (
                            <tr key={row.resource} className="border-t border-border">
                              <td className="px-3 py-2 font-mono">{row.resource}</td>
                              <td className="px-3 py-2">{row.attempts}</td>
                              <td className="px-3 py-2 text-success">{row.winners}</td>
                              <td className="px-3 py-2 text-warning">{row.conflicts}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                ) : (
                  <Panel title={t('runner.resultSummary')} className="self-start">
                    <div className="grid grid-cols-3 divide-x divide-border p-2">
                      {[
                        ['p50', result.metrics.p50],
                        ['p95', result.metrics.p95],
                        ['p99', result.metrics.p99],
                      ].map(([percentile, latency]) => (
                        <div key={percentile} className="px-3 py-2.5 first:pl-2 last:pr-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                            {t(`runner.${percentile}`)}
                          </p>
                          <p className="mt-1.5 text-lg font-semibold tracking-[-0.03em] text-ink">
                            {latency} <span className="text-xs text-ink-muted">ms</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}
              </div>
            ) : null}
            {failureGroups.length ? (
              <Panel
                title={t('runner.failureGroups')}
                description={t('runner.failureGroupsHint')}
                action={<Badge tone="danger">{failureGroups.length}</Badge>}
              >
                <div className="divide-y divide-border">
                  {failureGroups.map((group) => (
                    <div key={group.name} className="flex items-center gap-3 px-3 py-2.5 text-xs">
                      <AlertTriangle className="size-3.5 shrink-0 text-danger" />
                      <span className="min-w-0 flex-1 truncate font-medium">{group.name}</span>
                      <Badge tone="danger">
                        {formatNumber(group.failed, locale, 0)} {t('runner.occurrences')}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Panel>
            ) : null}
            {result?.iterations?.length ? (
              <Panel
                title={t('runner.iterationResults')}
                action={<Badge>{result.iterations.length}</Badge>}
              >
                <div className="max-h-80 divide-y divide-border overflow-auto">
                  {result.iterations.map((iteration, index) => (
                    <details key={index} className="group px-3 py-2">
                      <summary className="flex cursor-pointer items-center gap-3 text-xs">
                        <span className="font-mono text-ink-muted">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span>{iteration.label}</span>
                        <StatusBadge
                          status={iteration.passed ? 'success' : 'failed'}
                          className="ml-auto"
                        >
                          {iteration.status} ·{' '}
                          {t(iteration.passed ? 'common.success' : 'common.failed')}
                        </StatusBadge>
                      </summary>
                      <p className="mt-3 text-[10px] font-semibold text-ink-muted">
                        {t('runner.inputSnapshot')}
                      </p>
                      <pre className="my-2 overflow-auto rounded-md bg-surface-sunken p-3 text-xs">
                        {iteration.input || '—'}
                      </pre>
                    </details>
                  ))}
                </div>
              </Panel>
            ) : null}
            {result?.metrics.dropped ? (
              <div className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning-soft p-3 text-[11px] leading-relaxed text-warning">
                <Gauge className="mt-0.5 size-4 shrink-0" />
                {t('runner.droppedHint')}
              </div>
            ) : null}
          </div>
        </section>
      </MasterDetailShell>
    </div>
  )
}

export default TestLabPage
