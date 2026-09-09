import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  Clock3,
  Cookie,
  Copy,
  Download,
  FileBox,
  FileJson2,
  Gauge,
  Info,
  LockKeyhole,
  Variable,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconButton } from '@/components/ui/IconButton'
import {
  ResponseHeader,
  ResponseKeyValueRows,
  ResponseTabs,
} from '@/components/response/ResponseChrome'
import { formatBytes, formatDuration } from '@/lib/i18n/formatters'
import { redactSensitiveData } from '@/lib/security/redaction'
import { usePulseStore } from '@/state/pulse-store'
import { cn } from '@/lib/utils/cn'

type BodyTab = 'pretty' | 'raw' | 'hex'
type DetailTab = 'body' | 'headers' | 'cookies' | 'timeline' | 'tls'

const toHex = (value: string): string =>
  Array.from(new TextEncoder().encode(value))
    .map(
      (byte, index) =>
        `${index % 16 === 0 ? `${index.toString(16).padStart(8, '0')}  ` : ''}${byte.toString(16).padStart(2, ' ')}${index % 16 === 15 ? '\n' : ' '}`,
    )
    .join('')

export const ResponsePanel = () => {
  const { t } = useTranslation()
  const response = usePulseStore((state) => state.lastHttpResponse)
  const executionState = usePulseStore((state) => state.executionState)
  const requestError = usePulseStore((state) => state.requestError)
  const locale = usePulseStore((state) => state.preferences.locale)
  const inspectorOpen = usePulseStore((state) => state.inspectorOpen)
  const setInspectorOpen = usePulseStore((state) => state.setInspectorOpen)
  const showToast = usePulseStore((state) => state.showToast)
  const environments = usePulseStore((state) => state.data.environments)
  const secretValues = useMemo(
    () =>
      environments.flatMap((environment) =>
        environment.variables
          .filter((variable) => variable.secret)
          .map((variable) => variable.value)
          .filter(Boolean),
      ),
    [environments],
  )
  const [bodyTab, setBodyTab] = useState<BodyTab>('pretty')
  const [detailTab, setDetailTab] = useState<DetailTab>('body')

  const details: Array<[DetailTab, string, LucideIcon, number?]> = [
    ['body', t('workbench.body'), Braces],
    ['headers', t('workbench.headers'), FileJson2, response?.headers.length ?? 0],
    ...(response?.cookies.length
      ? ([['cookies', t('workbench.cookies'), Cookie, response.cookies.length]] as Array<
          [DetailTab, string, LucideIcon, number?]
        >)
      : []),
    ['timeline', t('workbench.timeline'), Gauge],
    ...(response?.tls
      ? ([['tls', t('workbench.tls'), LockKeyhole]] as Array<
          [DetailTab, string, LucideIcon, number?]
        >)
      : []),
  ]

  const responseStatus =
    !response || response.status === 0 || response.status >= 300 ? 'failed' : 'success'
  const safeRawBody = useMemo(
    () => redactSensitiveData(response?.rawBody ?? '', '', secretValues) as string,
    [response?.rawBody, secretValues],
  )
  const prettyBody = useMemo(() => {
    if (!safeRawBody) return ''
    try {
      return JSON.stringify(JSON.parse(safeRawBody), null, 2)
    } catch {
      return safeRawBody
    }
  }, [safeRawBody])
  const contentType =
    response?.headers.find((header) => header.key.toLowerCase() === 'content-type')?.value ?? ''
  const binary = /application\/(?:octet-stream|pdf|zip)|image\//i.test(contentType)
  const oversized = (response?.size ?? 0) > 1_048_576
  const copyBody = async () => {
    if (!response) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(safeRawBody)
      showToast(t('common.copied'))
    } catch {
      showToast(t('errors.generic'))
    }
  }
  const downloadBody = () => {
    if (!response) return
    const blob = new Blob([safeRawBody], { type: contentType || 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `pulse-response.${binary ? 'bin' : contentType.includes('json') ? 'json' : 'txt'}`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface"
      aria-label={t('workbench.response')}
    >
      <ResponseHeader>
        <h2 className="text-xs font-semibold text-ink">{t('workbench.response')}</h2>
        {response ? (
          <>
            <StatusBadge status={responseStatus}>
              {response.status || response.errorCode} {response.statusText}
            </StatusBadge>
            <span className="ml-auto flex items-center gap-1 text-[11px] text-ink-muted">
              <Clock3 className="size-3" />
              {formatDuration(response.timings.total, locale)}
            </span>
            <span className="text-[11px] text-ink-muted">{formatBytes(response.size, locale)}</span>
          </>
        ) : (
          <span className="ml-auto text-[11px] text-ink-subtle">
            {executionState === 'running' || executionState === 'resolving'
              ? t('common.running')
              : t('common.ready')}
          </span>
        )}
        <IconButton
          label={t('nav.inspector')}
          icon={<Variable className="size-3.5" />}
          active={inspectorOpen}
          className="size-7 max-md:size-9"
          onClick={() => setInspectorOpen(!inspectorOpen)}
        />
      </ResponseHeader>
      {!response ? (
        <div
          tabIndex={0}
          aria-label={t('workbench.response')}
          className="min-h-0 flex-1 overflow-auto"
        >
          <EmptyState
            icon={
              executionState === 'running' || executionState === 'resolving' ? (
                <span className="size-4 animate-spin rounded-full border-2 border-accent border-r-transparent motion-reduce:animate-none" />
              ) : (
                <Braces className="size-5" />
              )
            }
            title={
              executionState === 'error'
                ? t('common.failed')
                : executionState === 'cancelled'
                  ? t('workbench.cancelRequest')
                  : t('workbench.waitingResponse')
            }
            description={requestError ?? t('workbench.waitingHint')}
          />
        </div>
      ) : (
        <>
          <ResponseTabs
            active={detailTab}
            onChange={setDetailTab}
            ariaLabel={t('common.details')}
            items={details.map(([key, label, Icon, count]) => ({
              key,
              label: (
                <>
                  <Icon className="size-3" />
                  {label}
                  {typeof count === 'number' ? (
                    <span className="text-[9px] text-ink-subtle">{count}</span>
                  ) : null}
                </>
              ),
            }))}
          />
          <div className="min-h-0 flex-1 overflow-auto">
            {detailTab === 'body' ? (
              <div className="flex h-full min-h-[280px] flex-col">
                <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border px-2">
                  {(['pretty', 'raw', ...(binary ? ['hex'] : [])] as BodyTab[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setBodyTab(key)}
                      className={cn(
                        'rounded px-2 py-1 text-[10px] font-semibold text-ink-muted hover:bg-surface-hover',
                        bodyTab === key && 'bg-accent-soft text-accent',
                      )}
                    >
                      {t(`workbench.${key}`)}
                    </button>
                  ))}
                  <IconButton
                    label={t('common.copy')}
                    icon={<Copy className="size-3" />}
                    className="ml-auto size-7"
                    onClick={() => void copyBody()}
                  />
                  <IconButton
                    label={t('workbench.downloadResponse')}
                    icon={<Download className="size-3" />}
                    className="size-7"
                    onClick={downloadBody}
                  />
                </div>
                {oversized ? (
                  <div className="border-b border-warning/25 bg-warning-soft px-3 py-2 text-[11px] text-warning">
                    {t('workbench.oversizedPreview')}
                  </div>
                ) : null}
                {!safeRawBody ? (
                  <EmptyState
                    icon={<FileBox className="size-5" />}
                    title={t('workbench.emptyResponse')}
                    description={t('workbench.emptyResponseHint')}
                  />
                ) : binary && bodyTab !== 'hex' ? (
                  <EmptyState
                    icon={<FileBox className="size-5" />}
                    title={t('workbench.binaryResponse')}
                    description={t('workbench.binaryResponseHint')}
                  />
                ) : (
                  <pre
                    tabIndex={0}
                    aria-label={t('workbench.body')}
                    className="min-h-full flex-1 overflow-auto bg-surface-raised p-3 font-mono text-xs leading-relaxed text-ink"
                  >
                    {bodyTab === 'hex'
                      ? toHex(safeRawBody)
                      : bodyTab === 'raw'
                        ? safeRawBody
                        : prettyBody}
                  </pre>
                )}
              </div>
            ) : null}
            {detailTab === 'headers' ? <ResponseKeyValueRows rows={response.headers} /> : null}
            {detailTab === 'cookies' ? (
              response.cookies.length > 0 ? (
                <div className="divide-y divide-border">
                  {response.cookies.map((cookie) => (
                    <div
                      key={cookie.name}
                      className="grid grid-cols-[140px_1fr] gap-3 px-4 py-3 text-xs"
                    >
                      <code className="text-accent">{cookie.name}</code>
                      <div>
                        <p>{cookie.value}</p>
                        <p className="mt-1 text-[10px] text-ink-subtle">{cookie.flags}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Cookie className="size-5" />}
                  title={t('common.empty')}
                  description={t('workbench.cookies')}
                />
              )
            ) : null}
            {detailTab === 'timeline' ? <Waterfall response={response} /> : null}
            {detailTab === 'tls' ? (
              response.tls ? (
                <div className="grid gap-3 p-4 md:grid-cols-2">
                  <InfoCard label={t('workbench.protocol')} value={response.tls.version} />
                  <InfoCard label={t('workbench.cipherSuite')} value={response.tls.cipher} />
                  <InfoCard label={t('workbench.issuer')} value={response.tls.issuer} />
                  <InfoCard label={t('workbench.validUntil')} value={response.tls.validUntil} />
                  <div className="md:col-span-2">
                    <StatusBadge status={response.tls.verified ? 'success' : 'failed'}>
                      {response.tls.verified ? (
                        <CheckCircle2 className="size-3" />
                      ) : (
                        <AlertTriangle className="size-3" />
                      )}
                      {response.tls.verified
                        ? t('workbench.certificateVerified')
                        : t('workbench.certificateUnverified')}
                    </StatusBadge>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<Info className="size-5" />}
                  title={t('workbench.noTls')}
                  description={t('workbench.noTlsHint')}
                />
              )
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}

const InfoCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-border bg-surface-raised p-3">
    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">{label}</p>
    <p className="mt-1 break-all font-mono text-xs text-ink">{value}</p>
  </div>
)

const Waterfall = ({
  response,
}: {
  response: NonNullable<ReturnType<typeof usePulseStore.getState>['lastHttpResponse']>
}) => {
  const segments = [
    ['Queue', response.timings.queued, 'bg-ink-subtle'],
    ['DNS', response.timings.dns, 'bg-info'],
    ['Connect', response.timings.connect, 'bg-warning'],
    ['TLS', response.timings.tls, 'bg-accent'],
    ['Upload', response.timings.upload, 'bg-method-post'],
    [
      'TTFB',
      Math.max(
        1,
        response.timings.ttfb -
          response.timings.queued -
          response.timings.dns -
          response.timings.connect -
          response.timings.tls -
          response.timings.upload,
      ),
      'bg-method-get',
    ],
    ['Download', response.timings.download, 'bg-success'],
  ] as const
  return (
    <div className="p-4">
      <div className="mb-3 flex h-8 overflow-hidden rounded-md border border-border bg-surface-sunken">
        {segments
          .filter((segment) => segment[1] > 0)
          .map(([label, duration, color]) => (
            <div
              key={label}
              title={`${label}: ${duration} ms`}
              className={cn('min-w-1', color)}
              style={{ width: `${Math.max(2, (duration / response.timings.total) * 100)}%` }}
            />
          ))}
      </div>
      <div className="space-y-1.5">
        {segments.map(([label, duration, color]) => (
          <div
            key={label}
            className="grid grid-cols-[72px_1fr_52px] items-center gap-2 text-[11px]"
          >
            <span className="text-ink-muted">{label}</span>
            <div className="h-1.5 rounded-full bg-surface-sunken">
              <div
                className={cn('h-full rounded-full', color)}
                style={{ width: `${(duration / response.timings.total) * 100}%` }}
              />
            </div>
            <span className="text-right font-mono text-ink-subtle">{duration} ms</span>
          </div>
        ))}
      </div>
      {response.redirects.length > 0 ? (
        <div className="mt-4 rounded-md border border-warning/30 bg-warning-soft p-3 text-[11px] text-warning">
          {response.redirects.map((redirect, index) => (
            <p key={redirect}>
              {index + 1}. {redirect}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}
