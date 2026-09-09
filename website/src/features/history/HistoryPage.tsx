import {
  Braces,
  CheckCircle2,
  CircleX,
  Clock3,
  Copy,
  GitCompareArrows,
  History,
  RadioTower,
  Search,
  X,
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { RunnerMode } from '@/domain/runner/types'
import type { RunRecord } from '@/domain/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { modalBackdropClassName } from '@/components/ui/dialogStyles'
import { EmptyState } from '@/components/ui/EmptyState'
import { FieldShell, Input } from '@/components/ui/Field'
import { HttpMethodBadge } from '@/components/ui/HttpMethodBadge'
import { IconButton } from '@/components/ui/IconButton'
import { SelectMenu } from '@/components/ui/SelectMenu'
import {
  ActiveFilterChips,
  FilterDrawer,
  type ActiveFilterChip,
} from '@/components/ui/FilterDrawer'
import { Panel } from '@/components/ui/Panel'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TablePagination } from '@/components/ui/TablePagination'
import { formatBytes, formatDateTime, formatDuration, formatNumber } from '@/lib/i18n/formatters'
import { usePulseStore } from '@/state/pulse-store'
import { cn } from '@/lib/utils/cn'

type HistoryTab = 'executions' | 'runs'
type ExecutionStatusFilter = 'all' | 'success' | 'failed'
type RunStatusFilter = 'all' | 'passed' | 'failed' | 'stopped'
type ExecutionDateFilter = 'all' | 'today' | '7d' | '30d'

const runnerModeLabelKey: Record<RunnerMode, string> = {
  functional: 'functional',
  data: 'data',
  race: 'race',
  'constant-vus': 'constantUsers',
  'ramping-vus': 'rampingUsers',
  'arrival-rate': 'arrivalRate',
}

const runStatusLabelKey: Record<Exclude<RunStatusFilter, 'all'>, string> = {
  passed: 'passed',
  failed: 'failedState',
  stopped: 'stoppedState',
}

const executionFailed = ({ protocol, status }: { protocol: 'http' | 'grpc'; status: number }) =>
  protocol === 'grpc' ? status !== 0 : status < 200 || status >= 400

const withoutEmpty = <Item,>(items: Array<Item | null>): Item[] =>
  items.filter((item): item is Item => item !== null)

const MethodBadge = ({
  protocol,
  method,
}: {
  protocol: 'http' | 'grpc'
  method: string | undefined
}) =>
  protocol === 'http' ? (
    <HttpMethodBadge method={method} />
  ) : (
    <span className="font-mono text-[11px] text-ink-muted">{method ?? '—'}</span>
  )

const DetailMetric = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-md border border-border bg-surface-sunken px-3.5 py-3">
    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">{label}</p>
    <p
      className={cn(
        'mt-1.5 font-semibold tracking-tight text-ink',
        typeof value === 'string' && value.length > 28
          ? 'break-words text-sm leading-snug'
          : 'text-lg',
      )}
    >
      {value}
    </p>
  </div>
)

const CheckList = ({
  title,
  checks,
}: {
  title: string
  checks: Array<{ name: string; passed: boolean; detail: ReactNode }>
}) =>
  checks.length ? (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      <div className="divide-y divide-border rounded-md border border-border bg-surface-sunken">
        {checks.map((check) => (
          <div key={check.name} className="flex items-center gap-3 px-3 py-2.5 text-xs">
            {check.passed ? (
              <CheckCircle2 className="size-3.5 shrink-0 text-success" />
            ) : (
              <CircleX className="size-3.5 shrink-0 text-danger" />
            )}
            <span className="min-w-0 flex-1 font-medium text-ink">{check.name}</span>
            <span className="shrink-0 text-ink-muted">{check.detail}</span>
          </div>
        ))}
      </div>
    </section>
  ) : null

const TraceCode = ({
  title,
  value,
  onCopy,
  copyLabel,
  meta,
}: {
  title: string
  value: string
  onCopy: () => void
  copyLabel: string
  meta?: string
}) => (
  <section className="space-y-2">
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
        {title}
      </span>
      <div className="flex items-center gap-2">
        {meta ? <span className="font-mono text-[10px] text-ink-subtle">{meta}</span> : null}
        <IconButton
          label={copyLabel}
          icon={<Copy className="size-3.5" />}
          className="size-7"
          onClick={onCopy}
        />
      </div>
    </div>
    <pre className="max-h-64 overflow-auto rounded-md border border-border bg-surface-sunken p-3 font-mono text-[11px] leading-relaxed text-ink-muted">
      {value || '—'}
    </pre>
  </section>
)

const TraceKeyValueTable = ({
  title,
  rows,
}: {
  title: string
  rows: Array<{ key: string; value: string }>
}) =>
  rows.length ? (
    <section className="overflow-hidden rounded-md border border-border bg-surface-sunken">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-3 text-sm font-semibold text-ink">
        {title}
        <Badge>{rows.length}</Badge>
      </div>
      <div className="max-h-56 overflow-auto">
        <table className="w-full min-w-[420px] text-left text-xs">
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.key}-${index}`} className="border-t border-border first:border-t-0">
                <th className="w-[35%] px-3 py-2 align-top font-mono font-medium text-ink-muted">
                  {row.key}
                </th>
                <td className="break-all px-3 py-2 font-mono text-ink">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  ) : null

const TraceKeyValueGroups = ({
  title,
  groups,
}: {
  title: string
  groups: Array<{ title: string; rows: Array<{ key: string; value: string }> }>
}) => {
  const populatedGroups = groups.filter((group) => group.rows.length)
  if (!populatedGroups.length) return null

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <div className="grid items-start gap-3 lg:grid-cols-2">
        {populatedGroups.map((group) => (
          <section
            key={group.title}
            className="min-w-0 overflow-hidden rounded-md border border-border bg-surface-sunken"
            aria-label={group.title}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5">
              <h4 className="text-xs font-semibold text-ink">{group.title}</h4>
              <Badge>{group.rows.length}</Badge>
            </div>
            <div className="max-h-56 overflow-auto">
              <table className="w-full table-fixed text-left text-xs">
                <tbody>
                  {group.rows.map((row, index) => (
                    <tr
                      key={`${row.key}-${index}`}
                      className="border-t border-border first:border-t-0"
                    >
                      <th className="w-[38%] break-all px-3 py-2 align-top font-mono font-medium text-ink-muted">
                        {row.key}
                      </th>
                      <td className="break-all px-3 py-2 font-mono text-ink">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}

const CompareButton = ({
  count,
  label,
  onClick,
}: {
  count: number
  label: string
  onClick: () => void
}) => (
  <Button
    size="sm"
    variant={count === 2 ? 'primary' : 'secondary'}
    icon={<GitCompareArrows className="size-4" />}
    disabled={count !== 2}
    onClick={onClick}
    aria-label={`${label} ${count}/2`}
  >
    {label}
    <span
      className={cn(
        'rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
        count === 2 ? 'bg-on-accent/20 text-on-accent' : 'bg-surface-sunken text-ink-muted',
      )}
    >
      {count}/2
    </span>
  </Button>
)

const ComparisonRecord = ({
  label,
  title,
  subtitle,
  badges,
}: {
  label: string
  title: string
  subtitle: string
  badges: ReactNode
}) => (
  <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">{label}</p>
    <div className="mt-2 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 truncate text-[11px] text-ink-muted">{subtitle}</p>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-1">{badges}</div>
    </div>
  </div>
)

const ComparisonMetric = ({
  label,
  left,
  right,
  delta,
}: {
  label: string
  left: ReactNode
  right: ReactNode
  delta: string
}) => (
  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-t border-border px-4 py-3 first:border-t-0">
    <div className="min-w-0 truncate text-xs font-semibold text-ink">{left}</div>
    <div className="flex min-w-24 flex-col items-center text-center">
      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
        {label}
      </span>
      <span className="mt-1 rounded-full bg-surface-sunken px-2 py-0.5 font-mono text-[10px] text-ink-muted">
        {delta}
      </span>
    </div>
    <div className="min-w-0 truncate text-right text-xs font-semibold text-ink">{right}</div>
  </div>
)

const ComparisonVerdict = ({
  tone,
  title,
  description,
}: {
  tone: 'neutral' | 'success' | 'warning'
  title: string
  description: string
}) => (
  <div
    className={cn(
      'flex items-start gap-3 rounded-lg border px-4 py-3',
      tone === 'success' && 'border-success/25 bg-success-soft',
      tone === 'warning' && 'border-warning/25 bg-warning-soft',
      tone === 'neutral' && 'border-border bg-surface-sunken',
    )}
  >
    {tone === 'success' ? (
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
    ) : tone === 'warning' ? (
      <CircleX className="mt-0.5 size-4 shrink-0 text-warning" />
    ) : (
      <GitCompareArrows className="mt-0.5 size-4 shrink-0 text-ink-muted" />
    )}
    <div>
      <p className="text-xs font-semibold text-ink">{title}</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">{description}</p>
    </div>
  </div>
)

const HistoryPage = () => {
  const { t } = useTranslation()
  const data = usePulseStore((state) => state.data)
  const locale = usePulseStore((state) => state.preferences.locale)
  const showToast = usePulseStore((state) => state.showToast)
  const comparisonDelta = (left: number, right: number, suffix: string) => {
    const difference = right - left
    if (difference === 0) return t('runs.same')
    return `${difference > 0 ? '+' : '−'}${Math.abs(difference)}${suffix ? ` ${suffix}` : ''}`
  }
  const [tab, setTab] = useState<HistoryTab>('executions')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectedExecutions, setSelectedExecutions] = useState<Set<string>>(new Set())
  const [protocolFilter, setProtocolFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<ExecutionStatusFilter>('all')
  const [environmentFilter, setEnvironmentFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<ExecutionDateFilter>('all')
  const [runModeFilter, setRunModeFilter] = useState('all')
  const [runStatusFilter, setRunStatusFilter] = useState<RunStatusFilter>('all')
  const [runEnvironmentFilter, setRunEnvironmentFilter] = useState('all')
  const [runDateFilter, setRunDateFilter] = useState<ExecutionDateFilter>('all')
  const [executionPage, setExecutionPage] = useState(1)
  const [runPage, setRunPage] = useState(1)
  const [executionPageSize, setExecutionPageSize] = useState(10)
  const [runPageSize, setRunPageSize] = useState(10)
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [showComparisonMatches, setShowComparisonMatches] = useState(false)
  const [detail, setDetail] = useState<
    { kind: 'execution'; id: string } | { kind: 'run'; id: string } | null
  >(null)
  const requestCollections = useMemo(
    () => new Map(data.requests.map((request) => [request.id, request.collectionId])),
    [data.requests],
  )
  const executionMethods = useMemo(() => {
    const requests = new Map(data.requests.map((request) => [request.id, request]))
    const grpcMethods = new Map(
      data.grpcDefinitions.flatMap((definition) =>
        definition.methods.map(
          (method) => [method.id, `${method.service}/${method.name}`] as const,
        ),
      ),
    )
    const methods = new Map<string, string>()
    for (const execution of data.executions) {
      const request = requests.get(execution.requestId)
      if (!request || request.protocol !== execution.protocol) continue
      if (execution.protocol === 'http') methods.set(execution.id, request.method)
      else {
        const method = grpcMethods.get(request.grpcMethodId) ?? request.grpcMethodId
        if (method) methods.set(execution.id, method)
      }
    }
    return methods
  }, [data.executions, data.grpcDefinitions, data.requests])
  const protocols = useMemo(
    () => [...new Set(data.executions.map((execution) => execution.protocol))].sort(),
    [data.executions],
  )
  const executions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return data.executions.filter((execution) => {
      const requestCollectionId = requestCollections.get(execution.requestId)
      const requestCollection = data.collections.find((item) => item.id === requestCollectionId)
      const searchable = [
        execution.requestName,
        executionMethods.get(execution.id),
        requestCollection?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!searchable.includes(normalizedQuery)) return false
      if (protocolFilter !== 'all' && execution.protocol !== protocolFilter) return false
      const failed = executionFailed(execution)
      if (statusFilter === 'success' && failed) return false
      if (statusFilter === 'failed' && !failed) return false
      if (environmentFilter !== 'all' && execution.environmentId !== environmentFilter) return false
      if (dateFilter !== 'all') {
        const startedAt = new Date(execution.startedAt).getTime()
        const now = new Date()
        const threshold = new Date(now)
        if (dateFilter === 'today') threshold.setHours(0, 0, 0, 0)
        else threshold.setTime(now.getTime() - Number.parseInt(dateFilter, 10) * 86_400_000)
        if (startedAt < threshold.getTime()) return false
      }
      return true
    })
  }, [
    data.executions,
    data.collections,
    environmentFilter,
    dateFilter,
    executionMethods,
    protocolFilter,
    query,
    requestCollections,
    statusFilter,
  ])
  const executionP95 = useMemo(() => {
    const durationsByRequest = new Map<string, number[]>()
    for (const execution of executions) {
      const durations = durationsByRequest.get(execution.requestId) ?? []
      durations.push(execution.duration)
      durationsByRequest.set(execution.requestId, durations)
    }
    return new Map(
      [...durationsByRequest].map(([requestId, durations]) => {
        const sorted = [...durations].sort((left, right) => left - right)
        const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
        return [requestId, sorted[index] ?? 0]
      }),
    )
  }, [executions])
  const runModes = useMemo(() => [...new Set(data.runs.map((run) => run.mode))].sort(), [data.runs])
  const runModeLabel = (mode: RunnerMode) => t(`runner.${runnerModeLabelKey[mode]}`)
  const runStatusLabel = (status: Exclude<RunStatusFilter, 'all'>) =>
    t(`runner.${runStatusLabelKey[status]}`)
  const getRunSetupFacts = (run: RunRecord) => {
    const request = data.requests.find((entry) => entry.id === run.requestId)
    const target = run.trace?.target
    const dataset =
      run.trace?.dataset?.name ?? data.datasets.find((entry) => entry.id === run.datasetId)?.name
    const estimatedIterations =
      run.trace?.estimatedIterations ??
      (run.mode === 'functional'
        ? 1
        : run.mode === 'data'
          ? (run.iterations ?? 0)
          : run.mode === 'race'
            ? run.workers
            : run.mode === 'arrival-rate'
              ? run.targetRate * run.durationSeconds
              : run.workers * run.durationSeconds)
    const facts = [
      {
        label: t('runs.target'),
        value: `${target?.operation ?? request?.method ?? '—'} · ${target?.name ?? request?.name ?? run.name}`,
      },
      { label: t('runner.seed'), value: formatNumber(run.seed ?? 0, locale, 0) },
      {
        label: t('runner.estimatedWork'),
        value: `${formatNumber(estimatedIterations, locale, 0)} ${t('runner.iterations')}`,
      },
    ]

    if (run.mode === 'data') {
      facts.push(
        { label: t('runner.dataset'), value: dataset ?? '—' },
        {
          label: t('runner.iterations'),
          value: formatNumber(run.iterations ?? estimatedIterations, locale, 0),
        },
      )
    } else if (run.mode === 'race') {
      facts.push({
        label: t('runner.concurrentAttempts'),
        value: formatNumber(run.workers, locale, 0),
      })
    } else if (run.mode === 'constant-vus') {
      facts.push(
        { label: t('runner.workers'), value: formatNumber(run.workers, locale, 0) },
        { label: t('runner.duration'), value: `${run.durationSeconds} ${t('runner.second')}` },
      )
    } else if (run.mode === 'ramping-vus') {
      facts.push(
        { label: t('runner.peakVus'), value: formatNumber(run.workers, locale, 0) },
        { label: t('runner.rampUp'), value: `${run.rampUpSeconds ?? 0} ${t('runner.second')}` },
        { label: t('runner.hold'), value: `${run.holdSeconds ?? 0} ${t('runner.second')}` },
        { label: t('runner.rampDown'), value: `${run.rampDownSeconds ?? 0} ${t('runner.second')}` },
      )
    } else if (run.mode === 'arrival-rate') {
      facts.push(
        { label: t('runner.targetRate'), value: `${run.targetRate} req/s` },
        { label: t('runner.maxVus'), value: formatNumber(run.workers, locale, 0) },
        { label: t('runner.duration'), value: `${run.durationSeconds} ${t('runner.second')}` },
      )
    }

    return facts
  }
  const runs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return data.runs.filter((run) => {
      if (!run.name.toLowerCase().includes(normalizedQuery)) return false
      if (runModeFilter !== 'all' && run.mode !== runModeFilter) return false
      if (runStatusFilter !== 'all' && run.status !== runStatusFilter) return false
      if (runEnvironmentFilter !== 'all' && run.environmentId !== runEnvironmentFilter) return false
      if (runDateFilter !== 'all') {
        const startedAt = new Date(run.startedAt).getTime()
        const now = new Date()
        const threshold = new Date(now)
        if (runDateFilter === 'today') threshold.setHours(0, 0, 0, 0)
        else threshold.setTime(now.getTime() - Number.parseInt(runDateFilter, 10) * 86_400_000)
        if (startedAt < threshold.getTime()) return false
      }
      return true
    })
  }, [data.runs, query, runDateFilter, runEnvironmentFilter, runModeFilter, runStatusFilter])
  const executionPageCount = Math.max(1, Math.ceil(executions.length / executionPageSize))
  const runPageCount = Math.max(1, Math.ceil(runs.length / runPageSize))
  const currentExecutionPage = Math.min(executionPage, executionPageCount)
  const currentRunPage = Math.min(runPage, runPageCount)
  const pagedExecutions = executions.slice(
    (currentExecutionPage - 1) * executionPageSize,
    currentExecutionPage * executionPageSize,
  )
  const pagedRuns = runs.slice((currentRunPage - 1) * runPageSize, currentRunPage * runPageSize)
  const selectedRuns = data.runs.filter((run) => selected.has(run.id))
  const selectedExecutionRecords = data.executions.filter((execution) =>
    selectedExecutions.has(execution.id),
  )
  const detailExecution =
    detail?.kind === 'execution'
      ? data.executions.find((execution) => execution.id === detail.id)
      : undefined
  const detailRun =
    detail?.kind === 'run' ? data.runs.find((run) => run.id === detail.id) : undefined
  const copyMessage = async (payload: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(payload)
      showToast(t('common.copied'))
    } catch {
      showToast(t('errors.generic'))
    }
  }
  const comparedExecutions =
    selectedExecutionRecords.length === 2
      ? ([selectedExecutionRecords[0]!, selectedExecutionRecords[1]!] as const)
      : null
  const comparedRuns =
    selectedRuns.length === 2 ? ([selectedRuns[0]!, selectedRuns[1]!] as const) : null
  const initialEmpty =
    (tab === 'executions' && data.executions.length === 0) ||
    (tab === 'runs' && data.runs.length === 0)
  const activeExecutionFilterCount = [
    protocolFilter,
    statusFilter,
    environmentFilter,
    dateFilter,
  ].filter((value) => value !== 'all').length
  const activeRunFilterCount = [
    runModeFilter,
    runStatusFilter,
    runEnvironmentFilter,
    runDateFilter,
  ].filter((value) => value !== 'all').length
  const executionFilterChips = withoutEmpty<ActiveFilterChip>([
    protocolFilter !== 'all'
      ? {
          id: 'protocol',
          label: t('workbench.protocol'),
          value: protocolFilter.toUpperCase(),
          onRemove: () => setProtocolFilter('all'),
        }
      : null,
    environmentFilter !== 'all'
      ? {
          id: 'environment',
          label: t('variables.environment'),
          value:
            data.environments.find((environment) => environment.id === environmentFilter)?.name ??
            environmentFilter,
          onRemove: () => setEnvironmentFilter('all'),
        }
      : null,
    statusFilter !== 'all'
      ? {
          id: 'status',
          label: t('workbench.status'),
          value: t(statusFilter === 'success' ? 'common.success' : 'common.failed'),
          onRemove: () => setStatusFilter('all'),
        }
      : null,
    dateFilter !== 'all'
      ? {
          id: 'date',
          label: t('runs.dateFilter'),
          value: t(
            dateFilter === 'today'
              ? 'runs.today'
              : dateFilter === '7d'
                ? 'runs.last7Days'
                : 'runs.last30Days',
          ),
          onRemove: () => setDateFilter('all'),
        }
      : null,
  ])
  const runFilterChips = withoutEmpty<ActiveFilterChip>([
    runModeFilter !== 'all'
      ? {
          id: 'mode',
          label: t('runner.mode'),
          value: runModeLabel(runModeFilter as RunnerMode),
          onRemove: () => setRunModeFilter('all'),
        }
      : null,
    runEnvironmentFilter !== 'all'
      ? {
          id: 'environment',
          label: t('variables.environment'),
          value:
            data.environments.find((environment) => environment.id === runEnvironmentFilter)
              ?.name ?? runEnvironmentFilter,
          onRemove: () => setRunEnvironmentFilter('all'),
        }
      : null,
    runStatusFilter !== 'all'
      ? {
          id: 'status',
          label: t('workbench.status'),
          value: runStatusLabel(runStatusFilter as Exclude<RunStatusFilter, 'all'>),
          onRemove: () => setRunStatusFilter('all'),
        }
      : null,
    runDateFilter !== 'all'
      ? {
          id: 'date',
          label: t('runs.dateFilter'),
          value: t(
            runDateFilter === 'today'
              ? 'runs.today'
              : runDateFilter === '7d'
                ? 'runs.last7Days'
                : 'runs.last30Days',
          ),
          onRemove: () => setRunDateFilter('all'),
        }
      : null,
  ])
  const toggleSelected = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else if (next.size < 2) next.add(id)
      return next
    })
  const toggleExecutionSelected = (id: string) =>
    setSelectedExecutions((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else if (next.size < 2) next.add(id)
      return next
    })
  const clearExecutionFilters = () => {
    setProtocolFilter('all')
    setStatusFilter('all')
    setEnvironmentFilter('all')
    setDateFilter('all')
  }
  const clearRunFilters = () => {
    setRunModeFilter('all')
    setRunStatusFilter('all')
    setRunEnvironmentFilter('all')
    setRunDateFilter('all')
  }
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-canvas">
      <SectionHeading
        eyebrow={t('runs.eyebrow')}
        title={t('runs.title')}
        description={t('runs.subtitle')}
      />
      <div
        className="flex h-10 shrink-0 items-center gap-1 border-b border-border bg-surface px-5 md:px-8"
        role="tablist"
      >
        {(['executions', 'runs'] as HistoryTab[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
            className={cn(
              'relative h-full px-3 text-xs font-medium text-ink-muted',
              tab === key &&
                'text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-accent',
            )}
          >
            {t(`runs.${key === 'runs' ? 'runnerRuns' : 'executions'}`)}
            <Badge className="ml-2">
              {key === 'runs' ? data.runs.length : data.executions.length}
            </Badge>
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-8 py-6">
        <div className={cn('space-y-3', initialEmpty && 'flex min-h-full flex-col')}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-64 flex-1">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('common.search')}
                aria-label={t('common.search')}
                className="bg-surface pl-8"
              />
            </div>
            {tab === 'executions' ? (
              <>
                <FilterDrawer
                  title={t('runs.filters')}
                  closeLabel={t('common.close')}
                  clearLabel={t('runs.clearFilters')}
                  doneLabel={t('common.done')}
                  activeCount={activeExecutionFilterCount}
                  onClear={clearExecutionFilters}
                >
                  <FieldShell label={t('workbench.protocol')} htmlFor="history-protocol">
                    <SelectMenu
                      id="history-protocol"
                      value={protocolFilter}
                      onValueChange={setProtocolFilter}
                      label={t('workbench.protocol')}
                      options={[
                        { value: 'all', label: t('runs.allProtocols') },
                        ...protocols.map((protocol) => ({
                          value: protocol,
                          label: protocol.toUpperCase(),
                        })),
                      ]}
                    />
                  </FieldShell>
                  <FieldShell label={t('variables.environment')} htmlFor="history-environment">
                    <SelectMenu
                      id="history-environment"
                      value={environmentFilter}
                      onValueChange={setEnvironmentFilter}
                      label={t('variables.environment')}
                      options={[
                        { value: 'all', label: t('common.all') },
                        ...data.environments.map((environment) => ({
                          value: environment.id,
                          label: environment.name,
                        })),
                      ]}
                    />
                  </FieldShell>
                  <FieldShell label={t('runs.dateFilter')} htmlFor="history-date">
                    <SelectMenu
                      id="history-date"
                      value={dateFilter}
                      onValueChange={(value) => setDateFilter(value as ExecutionDateFilter)}
                      label={t('runs.dateFilter')}
                      options={[
                        { value: 'all', label: t('runs.allDates') },
                        { value: 'today', label: t('runs.today') },
                        { value: '7d', label: t('runs.last7Days') },
                        { value: '30d', label: t('runs.last30Days') },
                      ]}
                    />
                  </FieldShell>
                  <FieldShell label={t('workbench.status')} htmlFor="history-status">
                    <SelectMenu
                      id="history-status"
                      value={statusFilter}
                      onValueChange={(value) => setStatusFilter(value as ExecutionStatusFilter)}
                      label={t('workbench.status')}
                      options={[
                        { value: 'all', label: t('runs.allStatuses') },
                        { value: 'success', label: t('common.success') },
                        { value: 'failed', label: t('common.failed') },
                      ]}
                    />
                  </FieldShell>
                </FilterDrawer>
                <CompareButton
                  count={selectedExecutions.size}
                  label={t('common.compare')}
                  onClick={() => setComparisonOpen(true)}
                />
              </>
            ) : (
              <>
                <FilterDrawer
                  title={t('runs.filters')}
                  closeLabel={t('common.close')}
                  clearLabel={t('runs.clearFilters')}
                  doneLabel={t('common.done')}
                  activeCount={activeRunFilterCount}
                  onClear={clearRunFilters}
                >
                  <FieldShell label={t('runner.mode')} htmlFor="history-run-mode">
                    <SelectMenu
                      id="history-run-mode"
                      value={runModeFilter}
                      onValueChange={setRunModeFilter}
                      label={t('runner.mode')}
                      options={[
                        { value: 'all', label: t('common.all') },
                        ...runModes.map((mode) => ({ value: mode, label: runModeLabel(mode) })),
                      ]}
                    />
                  </FieldShell>
                  <FieldShell label={t('variables.environment')} htmlFor="history-run-environment">
                    <SelectMenu
                      id="history-run-environment"
                      value={runEnvironmentFilter}
                      onValueChange={setRunEnvironmentFilter}
                      label={t('variables.environment')}
                      options={[
                        { value: 'all', label: t('common.all') },
                        ...data.environments.map((environment) => ({
                          value: environment.id,
                          label: environment.name,
                        })),
                      ]}
                    />
                  </FieldShell>
                  <FieldShell label={t('workbench.status')} htmlFor="history-run-status">
                    <SelectMenu
                      id="history-run-status"
                      value={runStatusFilter}
                      onValueChange={(value) => setRunStatusFilter(value as RunStatusFilter)}
                      label={t('workbench.status')}
                      options={[
                        { value: 'all', label: t('runs.allStatuses') },
                        { value: 'passed', label: runStatusLabel('passed') },
                        { value: 'failed', label: runStatusLabel('failed') },
                        { value: 'stopped', label: runStatusLabel('stopped') },
                      ]}
                    />
                  </FieldShell>
                  <FieldShell label={t('runs.dateFilter')} htmlFor="history-run-date">
                    <SelectMenu
                      id="history-run-date"
                      value={runDateFilter}
                      onValueChange={(value) => setRunDateFilter(value as ExecutionDateFilter)}
                      label={t('runs.dateFilter')}
                      options={[
                        { value: 'all', label: t('runs.allDates') },
                        { value: 'today', label: t('runs.today') },
                        { value: '7d', label: t('runs.last7Days') },
                        { value: '30d', label: t('runs.last30Days') },
                      ]}
                    />
                  </FieldShell>
                </FilterDrawer>
                <CompareButton
                  count={selected.size}
                  label={t('common.compare')}
                  onClick={() => setComparisonOpen(true)}
                />
              </>
            )}
          </div>
          <ActiveFilterChips
            items={tab === 'executions' ? executionFilterChips : runFilterChips}
            clearLabel={t('runs.clearFilters')}
            onClear={tab === 'executions' ? clearExecutionFilters : clearRunFilters}
          />
          {tab === 'executions' ? (
            <>
              <Panel
                className={cn(
                  'overflow-hidden',
                  data.executions.length === 0 && 'flex flex-1 border-0 bg-transparent shadow-none',
                )}
              >
                {data.executions.length === 0 ? (
                  <EmptyState
                    icon={<History className="size-5" />}
                    title={t('runs.noExecutions')}
                    description={t('workbench.waitingHint')}
                    variant="bare"
                    className="flex-1"
                  />
                ) : executions.length === 0 ? (
                  <EmptyState
                    icon={<Search className="size-5" />}
                    title={t('runs.noMatchingExecutions')}
                    description={t('runs.noMatchingExecutionsHint')}
                    action={
                      <Button onClick={clearExecutionFilters}>{t('runs.clearFilters')}</Button>
                    }
                  />
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[960px] text-left text-xs">
                        <thead className="bg-surface-sunken text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
                          <tr>
                            <th className="w-10 px-3 py-2">
                              <span className="sr-only">{t('workbench.selectExecution')}</span>
                            </th>
                            <th className="px-3 py-2">{t('runs.target')}</th>
                            <th className="px-3 py-2">{t('workbench.protocol')}</th>
                            <th className="px-3 py-2">{t('workbench.method')}</th>
                            <th className="px-3 py-2">{t('variables.environment')}</th>
                            <th className="px-3 py-2">{t('runs.result')}</th>
                            <th className="px-3 py-2">{t('runner.p95')}</th>
                            <th className="px-3 py-2">{t('runs.startedAt')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedExecutions.map((execution) => {
                            const selectionLocked =
                              selectedExecutions.size >= 2 && !selectedExecutions.has(execution.id)

                            return (
                              <tr
                                key={execution.id}
                                tabIndex={0}
                                onClick={() => setDetail({ kind: 'execution', id: execution.id })}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    setDetail({ kind: 'execution', id: execution.id })
                                  }
                                }}
                                className={cn(
                                  'cursor-pointer border-t border-border transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none',
                                  selectedExecutions.has(execution.id) && 'bg-accent-soft/50',
                                )}
                              >
                                <td className="px-3 py-2.5">
                                  <div
                                    onClick={(event) => event.stopPropagation()}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onKeyDown={(event) => event.stopPropagation()}
                                  >
                                    <Checkbox
                                      checked={selectedExecutions.has(execution.id)}
                                      disabled={selectionLocked}
                                      onCheckedChange={() => toggleExecutionSelected(execution.id)}
                                      aria-label={`${t('workbench.selectExecution')} ${execution.requestName}, ${formatDateTime(execution.startedAt, locale)}`}
                                      className="size-3.5"
                                    />
                                  </div>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className="font-semibold text-ink">
                                    {execution.requestName}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <Badge tone={execution.protocol === 'grpc' ? 'info' : 'accent'}>
                                    {execution.protocol === 'grpc' ? (
                                      <RadioTower className="size-3" />
                                    ) : (
                                      <Braces className="size-3" />
                                    )}
                                    {execution.protocol.toUpperCase()}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2.5">
                                  <MethodBadge
                                    protocol={execution.protocol}
                                    method={executionMethods.get(execution.id)}
                                  />
                                </td>
                                <td className="px-3 py-2.5 text-ink-muted">
                                  {execution.environmentName}
                                </td>
                                <td className="px-3 py-2.5">
                                  <StatusBadge
                                    status={executionFailed(execution) ? 'failed' : 'success'}
                                  >
                                    {execution.status} {execution.statusText}
                                  </StatusBadge>
                                </td>
                                <td className="px-3 py-2.5 font-mono text-ink-muted">
                                  {formatDuration(
                                    executionP95.get(execution.requestId) ?? 0,
                                    locale,
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-ink-muted">
                                  {formatDateTime(execution.startedAt, locale)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      page={currentExecutionPage}
                      pageCount={executionPageCount}
                      pageSize={executionPageSize}
                      total={executions.length}
                      rangeLabel={t('runs.pageRange', {
                        from: executions.length
                          ? (currentExecutionPage - 1) * executionPageSize + 1
                          : 0,
                        to: Math.min(currentExecutionPage * executionPageSize, executions.length),
                        total: executions.length,
                      })}
                      pageLabel={t('runs.pageLabel', {
                        page: currentExecutionPage,
                        total: executionPageCount,
                      })}
                      rowsPerPageLabel={t('runs.rowsPerPage')}
                      previousLabel={t('runs.previous')}
                      nextLabel={t('runs.next')}
                      onPageChange={setExecutionPage}
                      onPageSizeChange={(pageSize) => {
                        setExecutionPageSize(pageSize)
                        setExecutionPage(1)
                      }}
                    />
                  </>
                )}
              </Panel>
            </>
          ) : (
            <>
              <Panel
                className={cn(
                  'overflow-hidden',
                  data.runs.length === 0 && 'flex flex-1 border-0 bg-transparent shadow-none',
                )}
              >
                {runs.length === 0 ? (
                  <EmptyState
                    icon={<GitCompareArrows className="size-5" />}
                    title={data.runs.length ? t('runs.noMatchingRuns') : t('runs.noRuns')}
                    description={
                      data.runs.length ? t('runs.noMatchingRunsHint') : t('runner.subtitle')
                    }
                    action={
                      data.runs.length ? (
                        <Button onClick={clearRunFilters}>{t('runs.clearFilters')}</Button>
                      ) : undefined
                    }
                    variant={data.runs.length === 0 ? 'bare' : 'default'}
                    className={data.runs.length === 0 ? 'flex-1' : ''}
                  />
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[900px] text-left text-xs">
                        <thead className="bg-surface-sunken text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
                          <tr>
                            <th className="w-10 px-3 py-2" />
                            <th className="px-3 py-2">{t('common.name')}</th>
                            <th className="px-3 py-2">{t('runner.mode')}</th>
                            <th className="px-3 py-2">{t('variables.environment')}</th>
                            <th className="px-3 py-2">{t('runner.p95')}</th>
                            <th className="px-3 py-2">{t('runs.result')}</th>
                            <th className="px-3 py-2">{t('runs.startedAt')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedRuns.map((run) => {
                            const selectionLocked = selected.size >= 2 && !selected.has(run.id)

                            return (
                              <tr
                                key={run.id}
                                tabIndex={0}
                                onClick={() => setDetail({ kind: 'run', id: run.id })}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    setDetail({ kind: 'run', id: run.id })
                                  }
                                }}
                                className={cn(
                                  'cursor-pointer border-t border-border transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none',
                                  selected.has(run.id) && 'bg-accent-soft/50',
                                )}
                              >
                                <td className="px-3 py-2.5">
                                  <div
                                    onClick={(event) => event.stopPropagation()}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onKeyDown={(event) => event.stopPropagation()}
                                  >
                                    <Checkbox
                                      checked={selected.has(run.id)}
                                      disabled={selectionLocked}
                                      onCheckedChange={() => toggleSelected(run.id)}
                                      aria-label={`${t('common.compare')} ${run.name}`}
                                      className="size-3.5"
                                    />
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 font-semibold">{run.name}</td>
                                <td className="px-3 py-2.5">
                                  <Badge tone="info">{runModeLabel(run.mode)}</Badge>
                                </td>
                                <td className="px-3 py-2.5 text-ink-muted">
                                  {run.environmentName ?? '—'}
                                </td>
                                <td className="px-3 py-2.5 font-mono text-ink-muted">
                                  {run.result.metrics.p95} ms
                                </td>
                                <td className="px-3 py-2.5">
                                  <StatusBadge
                                    status={run.status === 'passed' ? 'success' : 'failed'}
                                  >
                                    {runStatusLabel(run.status)}
                                  </StatusBadge>
                                </td>
                                <td className="px-3 py-2.5 text-ink-muted">
                                  {formatDateTime(run.startedAt, locale)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      page={currentRunPage}
                      pageCount={runPageCount}
                      pageSize={runPageSize}
                      total={runs.length}
                      rangeLabel={t('runs.pageRange', {
                        from: runs.length ? (currentRunPage - 1) * runPageSize + 1 : 0,
                        to: Math.min(currentRunPage * runPageSize, runs.length),
                        total: runs.length,
                      })}
                      pageLabel={t('runs.pageLabel', { page: currentRunPage, total: runPageCount })}
                      rowsPerPageLabel={t('runs.rowsPerPage')}
                      previousLabel={t('runs.previous')}
                      nextLabel={t('runs.next')}
                      onPageChange={setRunPage}
                      onPageSizeChange={(pageSize) => {
                        setRunPageSize(pageSize)
                        setRunPage(1)
                      }}
                    />
                  </>
                )}
              </Panel>
            </>
          )}
        </div>
      </div>
      <Dialog.Root
        open={comparisonOpen}
        onOpenChange={(open) => {
          setComparisonOpen(open)
          if (!open) setShowComparisonMatches(false)
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={`${modalBackdropClassName} z-[70]`} />
          <Dialog.Content
            aria-describedby="history-comparison-description"
            className="fixed left-1/2 top-1/2 z-[71] flex max-h-[min(780px,calc(100dvh-2rem))] w-[min(100vw-2rem,980px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-surface-raised shadow-panel focus:outline-none"
          >
            <header className="flex items-start justify-between gap-4 border-b border-border bg-gradient-to-b from-surface-raised to-surface px-5 py-4">
              <div>
                <Dialog.Title className="text-lg font-semibold tracking-tight text-ink">
                  {tab === 'executions' ? t('workbench.historyCompare') : t('runner.compareRuns')}
                </Dialog.Title>
                <Dialog.Description
                  id="history-comparison-description"
                  className="mt-1 text-xs text-ink-muted"
                >
                  {tab === 'executions' ? t('runs.executionDetails') : t('runs.testRunDetails')}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="size-8 min-h-8 shrink-0 px-0"
                  aria-label={t('common.close')}
                >
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            </header>
            <div className="min-h-0 flex-1 space-y-5 overflow-auto p-5">
              {tab === 'executions' &&
              comparedExecutions?.[0].protocol !== comparedExecutions?.[1].protocol ? (
                <div
                  className="rounded-md border border-warning/25 bg-warning-soft px-4 py-3"
                  role="note"
                >
                  <p className="text-xs font-semibold text-warning">
                    {t('runs.incompatibleComparison')}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                    {t('runs.incompatibleComparisonHint')}
                  </p>
                </div>
              ) : null}
              {tab === 'executions' && comparedExecutions
                ? (() => {
                    const [left, right] = comparedExecutions
                    const sameProtocol = left.protocol === right.protocol
                    const leftMethod = executionMethods.get(left.id)
                    const rightMethod = executionMethods.get(right.id)
                    const leftSize = left.http?.size
                    const rightSize = right.http?.size
                    const leftMessages = left.grpc?.messages.length
                    const rightMessages = right.grpc?.messages.length
                    const methodChanged = leftMethod !== rightMethod
                    const statusChanged =
                      left.status !== right.status || left.statusText !== right.statusText
                    const durationChanged = left.duration !== right.duration
                    const sizeChanged = leftSize !== rightSize
                    const messagesChanged = leftMessages !== rightMessages
                    const hasChanges =
                      methodChanged ||
                      statusChanged ||
                      durationChanged ||
                      (sameProtocol &&
                        ((left.protocol === 'http' && sizeChanged) ||
                          (left.protocol === 'grpc' && messagesChanged)))
                    const showMetric = (changed: boolean) => showComparisonMatches || changed
                    const verdictTone = !hasChanges
                      ? 'neutral'
                      : statusChanged || right.duration > left.duration
                        ? 'warning'
                        : 'success'
                    const verdictTitle = !hasChanges
                      ? t('runs.comparisonNoChange')
                      : statusChanged
                        ? t('runs.comparisonChanged')
                        : right.duration < left.duration
                          ? t('runs.comparisonFaster')
                          : t('runs.comparisonSlower')
                    return (
                      <>
                        <div className="grid gap-3 md:grid-cols-2">
                          <ComparisonRecord
                            label={t('runs.comparisonRunA')}
                            title={left.requestName}
                            subtitle={formatDateTime(left.startedAt, locale)}
                            badges={
                              <>
                                <Badge tone={left.protocol === 'grpc' ? 'info' : 'accent'}>
                                  {left.protocol.toUpperCase()}
                                </Badge>
                                <MethodBadge protocol={left.protocol} method={leftMethod} />
                                <StatusBadge status={executionFailed(left) ? 'failed' : 'success'}>
                                  {left.status} {left.statusText}
                                </StatusBadge>
                              </>
                            }
                          />
                          <ComparisonRecord
                            label={t('runs.comparisonRunB')}
                            title={right.requestName}
                            subtitle={formatDateTime(right.startedAt, locale)}
                            badges={
                              <>
                                <Badge tone={right.protocol === 'grpc' ? 'info' : 'accent'}>
                                  {right.protocol.toUpperCase()}
                                </Badge>
                                <MethodBadge protocol={right.protocol} method={rightMethod} />
                                <StatusBadge status={executionFailed(right) ? 'failed' : 'success'}>
                                  {right.status} {right.statusText}
                                </StatusBadge>
                              </>
                            }
                          />
                        </div>
                        <ComparisonVerdict
                          tone={verdictTone}
                          title={verdictTitle}
                          description={
                            hasChanges
                              ? t('runs.comparisonChangedHint')
                              : t('runs.comparisonNoChangeHint')
                          }
                        />
                        <section className="overflow-hidden rounded-lg border border-border bg-surface">
                          <div className="flex items-center justify-between border-b border-border px-4 py-3">
                            <h3 className="text-sm font-semibold text-ink">
                              {t('runs.comparisonSummary')}
                            </h3>
                            <div className="flex items-center gap-3">
                              <span className="hidden text-[11px] text-ink-subtle sm:inline">
                                {t('runs.comparisonDirection')}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setShowComparisonMatches((value) => !value)}
                              >
                                {showComparisonMatches
                                  ? t('runs.showChangesOnly')
                                  : t('runs.showAllMetrics')}
                              </Button>
                            </div>
                          </div>
                          {!hasChanges && !showComparisonMatches ? (
                            <p className="px-4 py-4 text-xs text-ink-muted">
                              {t('runs.comparisonNoChangeHint')}
                            </p>
                          ) : null}
                          {showMetric(methodChanged) ? (
                            <ComparisonMetric
                              label={t('workbench.method')}
                              left={<MethodBadge protocol={left.protocol} method={leftMethod} />}
                              right={<MethodBadge protocol={right.protocol} method={rightMethod} />}
                              delta={methodChanged ? t('runs.changed') : t('runs.same')}
                            />
                          ) : null}
                          {showMetric(statusChanged) ? (
                            <ComparisonMetric
                              label={t('runs.result')}
                              left={`${left.status} ${left.statusText}`}
                              right={`${right.status} ${right.statusText}`}
                              delta={statusChanged ? t('runs.changed') : t('runs.same')}
                            />
                          ) : null}
                          {showMetric(durationChanged) ? (
                            <ComparisonMetric
                              label={t('runs.duration')}
                              left={formatDuration(left.duration, locale)}
                              right={formatDuration(right.duration, locale)}
                              delta={comparisonDelta(left.duration, right.duration, 'ms')}
                            />
                          ) : null}
                          {sameProtocol &&
                          left.protocol === 'http' &&
                          right.protocol === 'http' &&
                          showMetric(sizeChanged) ? (
                            <ComparisonMetric
                              label={t('workbench.size')}
                              left={leftSize === undefined ? '—' : formatBytes(leftSize, locale)}
                              right={rightSize === undefined ? '—' : formatBytes(rightSize, locale)}
                              delta={
                                leftSize === undefined || rightSize === undefined
                                  ? '—'
                                  : comparisonDelta(leftSize, rightSize, 'B')
                              }
                            />
                          ) : null}
                          {sameProtocol &&
                          left.protocol === 'grpc' &&
                          right.protocol === 'grpc' &&
                          showMetric(messagesChanged) ? (
                            <ComparisonMetric
                              label={t('grpc.messages')}
                              left={leftMessages ?? '—'}
                              right={rightMessages ?? '—'}
                              delta={
                                leftMessages === undefined || rightMessages === undefined
                                  ? '—'
                                  : comparisonDelta(leftMessages, rightMessages, '')
                              }
                            />
                          ) : null}
                        </section>
                      </>
                    )
                  })()
                : tab === 'runs' && comparedRuns
                  ? (() => {
                      const [left, right] = comparedRuns
                      const totalChanged = left.result.metrics.total !== right.result.metrics.total
                      const throughputChanged =
                        left.result.metrics.throughput !== right.result.metrics.throughput
                      const p95Changed = left.result.metrics.p95 !== right.result.metrics.p95
                      const failuresChanged =
                        left.result.metrics.failures !== right.result.metrics.failures
                      const hasChanges =
                        left.mode !== right.mode ||
                        left.status !== right.status ||
                        totalChanged ||
                        throughputChanged ||
                        p95Changed ||
                        failuresChanged
                      const showMetric = (changed: boolean) => showComparisonMatches || changed
                      const verdictTone = !hasChanges
                        ? 'neutral'
                        : left.status !== right.status ||
                            right.result.metrics.failures > left.result.metrics.failures ||
                            right.result.metrics.p95 > left.result.metrics.p95
                          ? 'warning'
                          : 'success'
                      const verdictTitle = !hasChanges
                        ? t('runs.comparisonNoChange')
                        : verdictTone === 'warning'
                          ? t('runs.comparisonSlower')
                          : t('runs.comparisonFaster')
                      return (
                        <>
                          <div className="grid gap-3 md:grid-cols-2">
                            <ComparisonRecord
                              label={t('runs.comparisonRunA')}
                              title={left.name}
                              subtitle={`${left.environmentName ?? '—'} · ${formatDateTime(left.startedAt, locale)}`}
                              badges={
                                <>
                                  <Badge tone="info">{runModeLabel(left.mode)}</Badge>
                                  <StatusBadge
                                    status={left.status === 'passed' ? 'success' : 'failed'}
                                  >
                                    {runStatusLabel(left.status)}
                                  </StatusBadge>
                                </>
                              }
                            />
                            <ComparisonRecord
                              label={t('runs.comparisonRunB')}
                              title={right.name}
                              subtitle={`${right.environmentName ?? '—'} · ${formatDateTime(right.startedAt, locale)}`}
                              badges={
                                <>
                                  <Badge tone="info">{runModeLabel(right.mode)}</Badge>
                                  <StatusBadge
                                    status={right.status === 'passed' ? 'success' : 'failed'}
                                  >
                                    {runStatusLabel(right.status)}
                                  </StatusBadge>
                                </>
                              }
                            />
                          </div>
                          <ComparisonVerdict
                            tone={verdictTone}
                            title={verdictTitle}
                            description={
                              hasChanges
                                ? t('runs.comparisonChangedHint')
                                : t('runs.comparisonNoChangeHint')
                            }
                          />
                          <section className="overflow-hidden rounded-lg border border-border bg-surface">
                            <div className="flex items-center justify-between border-b border-border px-4 py-3">
                              <h3 className="text-sm font-semibold text-ink">
                                {t('runs.comparisonSummary')}
                              </h3>
                              <div className="flex items-center gap-3">
                                <span className="hidden text-[11px] text-ink-subtle sm:inline">
                                  {t('runs.comparisonDirection')}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setShowComparisonMatches((value) => !value)}
                                >
                                  {showComparisonMatches
                                    ? t('runs.showChangesOnly')
                                    : t('runs.showAllMetrics')}
                                </Button>
                              </div>
                            </div>
                            {!hasChanges && !showComparisonMatches ? (
                              <p className="px-4 py-4 text-xs text-ink-muted">
                                {t('runs.comparisonNoChangeHint')}
                              </p>
                            ) : null}
                            {showMetric(totalChanged) ? (
                              <ComparisonMetric
                                label={t('runner.requestsTotal')}
                                left={formatNumber(left.result.metrics.total, locale, 0)}
                                right={formatNumber(right.result.metrics.total, locale, 0)}
                                delta={comparisonDelta(
                                  left.result.metrics.total,
                                  right.result.metrics.total,
                                  '',
                                )}
                              />
                            ) : null}
                            {showMetric(throughputChanged) ? (
                              <ComparisonMetric
                                label={t('runner.throughput')}
                                left={`${left.result.metrics.throughput} rps`}
                                right={`${right.result.metrics.throughput} rps`}
                                delta={comparisonDelta(
                                  left.result.metrics.throughput,
                                  right.result.metrics.throughput,
                                  'rps',
                                )}
                              />
                            ) : null}
                            {showMetric(p95Changed) ? (
                              <ComparisonMetric
                                label={t('runner.p95')}
                                left={`${left.result.metrics.p95} ms`}
                                right={`${right.result.metrics.p95} ms`}
                                delta={comparisonDelta(
                                  left.result.metrics.p95,
                                  right.result.metrics.p95,
                                  'ms',
                                )}
                              />
                            ) : null}
                            {showMetric(failuresChanged) ? (
                              <ComparisonMetric
                                label={t('runner.failures')}
                                left={formatNumber(left.result.metrics.failures, locale, 0)}
                                right={formatNumber(right.result.metrics.failures, locale, 0)}
                                delta={comparisonDelta(
                                  left.result.metrics.failures,
                                  right.result.metrics.failures,
                                  '',
                                )}
                              />
                            ) : null}
                          </section>
                        </>
                      )
                    })()
                  : null}
            </div>
            <footer className="flex justify-end border-t border-border bg-surface-sunken px-5 py-3">
              <Dialog.Close asChild>
                <Button size="sm" variant="secondary">
                  {t('common.close')}
                </Button>
              </Dialog.Close>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className={`${modalBackdropClassName} z-[70]`} />
          <Dialog.Content
            aria-describedby="history-detail-description"
            className="fixed left-1/2 top-1/2 z-[71] flex max-h-[min(800px,calc(100dvh-2rem))] w-[min(100vw-2rem,920px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-surface-raised shadow-panel focus:outline-none"
          >
            <header className="border-b border-border bg-gradient-to-b from-surface-raised to-surface px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Dialog.Title className="truncate text-lg font-semibold tracking-tight text-ink">
                    {detailExecution?.requestName ??
                      detailRun?.trace?.target.name ??
                      detailRun?.name ??
                      t('runs.details')}
                  </Dialog.Title>
                  <Dialog.Description
                    id="history-detail-description"
                    className="mt-1 text-xs text-ink-muted"
                  >
                    {detailExecution
                      ? t('runs.executionDetails')
                      : detailRun
                        ? t('runs.testRunDetails')
                        : ''}
                  </Dialog.Description>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {detailExecution ? (
                    <>
                      <Badge tone={detailExecution.protocol === 'grpc' ? 'info' : 'accent'}>
                        {detailExecution.protocol.toUpperCase()}
                      </Badge>
                      <StatusBadge status={executionFailed(detailExecution) ? 'failed' : 'success'}>
                        {detailExecution.status} {detailExecution.statusText}
                      </StatusBadge>
                    </>
                  ) : detailRun ? (
                    <>
                      <Badge tone="info">{runModeLabel(detailRun.mode)}</Badge>
                      <StatusBadge status={detailRun.status === 'passed' ? 'success' : 'failed'}>
                        {runStatusLabel(detailRun.status)}
                      </StatusBadge>
                    </>
                  ) : null}
                  <Dialog.Close asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-8 min-h-8 px-0"
                      aria-label={t('common.close')}
                    >
                      <X className="size-4" />
                    </Button>
                  </Dialog.Close>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="size-3.5 text-ink-subtle" />
                  {detailExecution
                    ? formatDateTime(detailExecution.startedAt, locale)
                    : detailRun
                      ? formatDateTime(detailRun.startedAt, locale)
                      : '—'}
                </span>
                <span className="text-ink-subtle">•</span>
                <span>
                  {detailExecution
                    ? detailExecution.environmentName
                    : (detailRun?.environmentName ?? '—')}
                </span>
                {detailExecution ? (
                  <>
                    <span className="text-ink-subtle">•</span>
                    <MethodBadge
                      protocol={detailExecution.protocol}
                      method={executionMethods.get(detailExecution.id)}
                    />
                    <span className="text-ink-subtle">•</span>
                    <span>{formatDuration(detailExecution.duration, locale)}</span>
                  </>
                ) : detailRun ? (
                  <>
                    <span className="text-ink-subtle">•</span>
                    <span>
                      {detailRun.durationSeconds} {t('runner.second')}
                    </span>
                  </>
                ) : null}
              </div>
            </header>
            <div className="min-h-0 flex-1 space-y-5 overflow-auto p-5">
              {detailExecution ? (
                <>
                  {(() => {
                    const snapshot = detailExecution.requestSnapshot
                    const trace = detailExecution.trace
                    const requestBody = trace?.body ?? snapshot?.body ?? ''
                    const requestHeaders =
                      trace?.headers ??
                      (snapshot
                        ? (snapshot.protocol === 'grpc' ? snapshot.metadata : snapshot.headers)
                            .filter((row) => row.enabled)
                            .map(({ key, value }) => ({ key, value }))
                        : [])
                    const requestFormat =
                      detailExecution.protocol === 'grpc'
                        ? (snapshot?.grpcType ?? '—')
                        : (snapshot?.bodyMode ?? '—')
                    return (
                      <>
                        <section>
                          <h3 className="mb-3 text-sm font-semibold text-ink">
                            {t('runner.runPlan')}
                          </h3>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            <DetailMetric
                              label={t('runs.target')}
                              value={
                                <span
                                  className="block truncate font-mono text-sm"
                                  title={trace?.endpoint ?? snapshot?.url ?? '—'}
                                >
                                  {trace?.endpoint ?? snapshot?.url ?? '—'}
                                </span>
                              }
                            />
                            <DetailMetric label={t('workbench.bodyType')} value={requestFormat} />
                            <DetailMetric
                              label={t('workbench.timeout')}
                              value={`${snapshot?.timeoutMs ?? '—'} ms`}
                            />
                          </div>
                        </section>
                        <CheckList
                          title={t('runner.checks')}
                          checks={(detailExecution.http?.tests ?? []).map((test) => ({
                            name: test.name,
                            passed: test.passed,
                            detail: test.detail,
                          }))}
                        />
                        {detailExecution.grpc ? (
                          <TraceKeyValueGroups
                            title={t('runner.protocolDetails')}
                            groups={[
                              { title: t('grpc.metadata'), rows: requestHeaders },
                              { title: t('grpc.headers'), rows: detailExecution.grpc.headers },
                              { title: t('grpc.trailers'), rows: detailExecution.grpc.trailers },
                            ]}
                          />
                        ) : detailExecution.http ? (
                          <TraceKeyValueGroups
                            title={t('runner.protocolDetails')}
                            groups={[
                              { title: t('runner.requestHeaders'), rows: requestHeaders },
                              {
                                title: t('runner.responseHeaders'),
                                rows: detailExecution.http.headers,
                              },
                              {
                                title: t('workbench.cookies'),
                                rows: detailExecution.http.cookies.map((cookie) => ({
                                  key: cookie.name,
                                  value: `${cookie.value}${cookie.flags ? ` · ${cookie.flags}` : ''}`,
                                })),
                              },
                            ]}
                          />
                        ) : null}
                        <TraceCode
                          title={
                            detailExecution.protocol === 'grpc'
                              ? t('grpc.requestMessage')
                              : t('workbench.resolvedPreview')
                          }
                          value={requestBody}
                          onCopy={() => void copyMessage(requestBody)}
                          copyLabel={t('common.copy')}
                          meta={requestFormat.toUpperCase()}
                        />
                        {!detailExecution.grpc && !detailExecution.http ? (
                          <TraceKeyValueTable
                            title={
                              detailExecution.protocol === 'grpc'
                                ? t('grpc.metadata')
                                : t('workbench.headers')
                            }
                            rows={requestHeaders}
                          />
                        ) : null}
                      </>
                    )
                  })()}
                  {detailExecution.http ? (
                    <>
                      <TraceCode
                        title={t('workbench.responseBody')}
                        value={
                          detailExecution.http.rawBody ||
                          JSON.stringify(detailExecution.http.body, null, 2)
                        }
                        onCopy={() =>
                          void copyMessage(
                            detailExecution.http?.rawBody ||
                              JSON.stringify(detailExecution.http?.body, null, 2),
                          )
                        }
                        copyLabel={t('common.copy')}
                        meta={`JSON · ${formatBytes(detailExecution.http.size, locale)}`}
                      />
                      <section className="overflow-hidden rounded-md border border-border bg-surface-sunken">
                        <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-3 text-sm font-semibold text-ink">
                          {t('workbench.timeline')}
                          <Badge>
                            {formatDuration(detailExecution.http.timings.total, locale)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
                          {Object.entries(detailExecution.http.timings).map(([label, value]) => (
                            <div key={label} className="bg-surface-sunken px-3 py-2.5">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
                                {label}
                              </p>
                              <p className="mt-1 font-mono text-xs text-ink">{value} ms</p>
                            </div>
                          ))}
                        </div>
                      </section>
                      <TraceKeyValueTable
                        title={t('workbench.tls')}
                        rows={
                          detailExecution.http.tls
                            ? Object.entries(detailExecution.http.tls).map(([key, value]) => ({
                                key,
                                value: String(value),
                              }))
                            : []
                        }
                      />
                      <TraceKeyValueTable
                        title={t('workbench.redirects')}
                        rows={detailExecution.http.redirects.map((value, index) => ({
                          key: String(index + 1),
                          value,
                        }))}
                      />
                      {detailExecution.http.console.length ? (
                        <section className="overflow-hidden rounded-md border border-border bg-surface-sunken">
                          <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-3 text-sm font-semibold text-ink">
                            {t('workbench.console')}
                            <Badge>{detailExecution.http.console.length}</Badge>
                          </div>
                          <div className="divide-y divide-border">
                            {detailExecution.http.console.map((entry, index) => (
                              <p
                                key={`${entry.level}-${index}`}
                                className="px-3 py-2 font-mono text-[11px] text-ink-muted"
                              >
                                <span className="mr-2 uppercase text-ink-subtle">
                                  {entry.level}
                                </span>
                                {entry.message}
                              </p>
                            ))}
                          </div>
                        </section>
                      ) : null}
                    </>
                  ) : detailExecution.grpc ? (
                    <>
                      <section className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold text-ink">{t('grpc.messages')}</h3>
                          <span className="font-mono text-[10px] text-ink-subtle">
                            {detailExecution.grpc.messages.length}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {detailExecution.grpc.messages.map((message) => (
                            <article
                              key={message.id}
                              className="overflow-hidden rounded-md border border-border bg-surface-sunken"
                            >
                              <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    tone={
                                      message.direction === 'inbound'
                                        ? 'success'
                                        : message.direction === 'outbound'
                                          ? 'info'
                                          : 'neutral'
                                    }
                                  >
                                    {message.direction.toUpperCase()}
                                  </Badge>
                                  <span className="font-mono text-[10px] text-ink-subtle">
                                    +{message.atMs} ms
                                  </span>
                                </div>
                                <IconButton
                                  label={t('common.copy')}
                                  icon={<Copy className="size-3.5" />}
                                  className="size-7"
                                  onClick={() => void copyMessage(message.payload)}
                                />
                              </div>
                              <pre className="max-h-64 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-ink-muted">
                                {message.payload}
                              </pre>
                            </article>
                          ))}
                        </div>
                      </section>
                    </>
                  ) : null}
                </>
              ) : detailRun ? (
                <>
                  <section>
                    <h3 className="mb-3 text-sm font-semibold text-ink">{t('runner.runPlan')}</h3>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {getRunSetupFacts(detailRun).map((fact) => (
                        <DetailMetric key={fact.label} label={fact.label} value={fact.value} />
                      ))}
                    </div>
                  </section>
                  <CheckList
                    title={t('runner.checks')}
                    checks={detailRun.result.checks.map((check) => ({
                      name: check.name,
                      passed: !check.failed,
                      detail: (
                        <span className="font-mono">
                          <span className="text-success">
                            {check.passed} {t('runner.passed').toLowerCase()}
                          </span>
                          <span className="text-ink-subtle"> · </span>
                          <span className={check.failed ? 'text-danger' : 'text-ink-subtle'}>
                            {check.failed} {t('runner.failures').toLowerCase()}
                          </span>
                        </span>
                      ),
                    }))}
                  />
                  <section>
                    <h3 className="mb-3 text-sm font-semibold text-ink">
                      {t('runner.resultSummary')}
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <DetailMetric
                        label={t('runner.requestsTotal')}
                        value={formatNumber(detailRun.result.metrics.total, locale, 0)}
                      />
                      <DetailMetric
                        label={t('runner.passed')}
                        value={formatNumber(detailRun.result.metrics.passed, locale, 0)}
                      />
                      <DetailMetric
                        label={t('runner.failures')}
                        value={formatNumber(detailRun.result.metrics.failures, locale, 0)}
                      />
                      <DetailMetric
                        label={t('runner.dropped')}
                        value={formatNumber(detailRun.result.metrics.dropped, locale, 0)}
                      />
                    </div>
                  </section>
                  <section>
                    <h3 className="mb-3 text-sm font-semibold text-ink">{t('runs.performance')}</h3>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      <DetailMetric
                        label={t('runner.throughput')}
                        value={`${detailRun.result.metrics.throughput} rps`}
                      />
                      <DetailMetric
                        label={t('runner.p50')}
                        value={`${detailRun.result.metrics.p50} ms`}
                      />
                      <DetailMetric
                        label={t('runner.p95')}
                        value={`${detailRun.result.metrics.p95} ms`}
                      />
                      <DetailMetric
                        label={t('runner.p99')}
                        value={`${detailRun.result.metrics.p99} ms`}
                      />
                      <DetailMetric
                        label={t('runner.collisionRate')}
                        value={`${formatNumber(detailRun.result.metrics.collisionRate * 100, locale, 1)}%`}
                      />
                    </div>
                  </section>
                  {detailRun.result.collisions.length ? (
                    <section>
                      <h3 className="mb-3 text-sm font-semibold text-ink">
                        {t('runner.collisions')}
                      </h3>
                      <div className="overflow-x-auto rounded-md border border-border">
                        <table className="w-full min-w-[460px] text-left text-xs">
                          <thead className="bg-surface-sunken text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
                            <tr>
                              <th className="px-3 py-2">{t('runner.resource')}</th>
                              <th className="px-3 py-2">{t('runner.attempts')}</th>
                              <th className="px-3 py-2">{t('runner.winners')}</th>
                              <th className="px-3 py-2">{t('runner.conflicts')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailRun.result.collisions.map((collision) => (
                              <tr key={collision.resource} className="border-t border-border">
                                <td className="px-3 py-2 font-mono text-ink-muted">
                                  {collision.resource}
                                </td>
                                <td className="px-3 py-2">{collision.attempts}</td>
                                <td className="px-3 py-2 text-success">{collision.winners}</td>
                                <td className="px-3 py-2 text-warning">{collision.conflicts}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ) : null}
                  {detailRun.result.iterations.length ? (
                    <section className="overflow-hidden rounded-md border border-border bg-surface-sunken">
                      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-3 text-sm font-semibold text-ink">
                        {t('runner.iterationResults')}
                        <Badge>{detailRun.result.iterations.length}</Badge>
                      </div>
                      <div className="max-h-72 divide-y divide-border overflow-auto">
                        {detailRun.result.iterations.map((iteration, index) => (
                          <article key={`${iteration.label}-${index}`} className="px-3 py-2.5">
                            <div className="flex items-center gap-3 text-xs">
                              <span className="font-mono text-ink-subtle">
                                {String(index + 1).padStart(2, '0')}
                              </span>
                              <span className="min-w-0 flex-1 truncate font-medium text-ink">
                                {iteration.label}
                              </span>
                              <span className="font-mono text-ink-muted">
                                {iteration.duration} ms
                              </span>
                              <StatusBadge status={iteration.passed ? 'success' : 'failed'}>
                                {iteration.status}
                              </StatusBadge>
                              <IconButton
                                label={t('common.copy')}
                                icon={<Copy className="size-3.5" />}
                                className="size-7"
                                onClick={() => void copyMessage(iteration.input ?? '')}
                              />
                            </div>
                            {iteration.input ? (
                              <pre className="mt-2 max-h-28 overflow-auto rounded bg-surface p-2 font-mono text-[10px] leading-relaxed text-ink-muted">
                                {iteration.input}
                              </pre>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  {detailRun.result.series.length ? (
                    <section className="overflow-hidden rounded-md border border-border bg-surface-sunken">
                      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-3 text-sm font-semibold text-ink">
                        {t('runner.chart')}
                        <Badge>
                          {detailRun.result.series.length} {t('runner.second').toLowerCase()}
                        </Badge>
                      </div>
                      <div className="max-h-64 overflow-auto">
                        <table className="w-full min-w-[520px] text-left text-xs">
                          <thead className="sticky top-0 bg-surface-sunken text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
                            <tr>
                              <th className="px-3 py-2">{t('runner.second')}</th>
                              <th className="px-3 py-2">{t('runner.throughput')}</th>
                              <th className="px-3 py-2">{t('runner.p95')}</th>
                              <th className="px-3 py-2">{t('runner.activeWorkers')}</th>
                              <th className="px-3 py-2">{t('runner.dropped')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailRun.result.series.map((point) => (
                              <tr key={point.second} className="border-t border-border">
                                <td className="px-3 py-2 font-mono text-ink-muted">
                                  {point.second}s
                                </td>
                                <td className="px-3 py-2">{point.throughput} rps</td>
                                <td className="px-3 py-2">{point.p95} ms</td>
                                <td className="px-3 py-2">{point.active}</td>
                                <td
                                  className={cn(
                                    'px-3 py-2',
                                    point.dropped ? 'text-warning' : 'text-ink-muted',
                                  )}
                                >
                                  {point.dropped}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ) : null}
                </>
              ) : null}
            </div>
            <footer className="flex justify-end border-t border-border bg-surface-sunken px-5 py-3">
              <Dialog.Close asChild>
                <Button size="sm" variant="secondary">
                  {t('common.close')}
                </Button>
              </Dialog.Close>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

export default HistoryPage
