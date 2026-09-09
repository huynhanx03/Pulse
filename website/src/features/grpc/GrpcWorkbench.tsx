import {
  Activity,
  ChevronDown,
  CircleStop,
  Clock3,
  Database,
  LockKeyhole,
  Pause,
  Play,
  RadioTower,
  RefreshCcw,
  Send,
  StepForward,
  Trash2,
  Upload,
} from 'lucide-react'
import { Command as CommandRoot, CommandEmpty, CommandInput, CommandItem, CommandList } from 'cmdk'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { CodeEditor } from '@/components/editor/CodeEditor'
import { Badge } from '@/components/ui/Badge'
import {
  ResponseHeader,
  ResponseKeyValueRows,
  ResponseTabs,
} from '@/components/response/ResponseChrome'
import { RequestResponseLayout } from '@/components/workbench/RequestResponseLayout'
import { RequestTitleBar } from '@/components/workbench/RequestTitleBar'
import { Button } from '@/components/ui/Button'
import { modalBackdropClassName } from '@/components/ui/dialogStyles'
import { EmptyState } from '@/components/ui/EmptyState'
import { FieldShell, Input } from '@/components/ui/Field'
import { IconButton } from '@/components/ui/IconButton'
import { NotFoundState } from '@/components/ui/NotFoundState'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Switch } from '@/components/ui/Switch'
import type { GrpcDefinition, GrpcMethodDefinition } from '@/domain/types'
import { KeyValueEditor } from '@/components/editor/KeyValueEditor'
import type { JsonValue } from '@/domain/execution/grpc'
import { formatDuration } from '@/lib/i18n/formatters'
import { usePulseStore } from '@/state/pulse-store'
import { cn } from '@/lib/utils/cn'

type ComposerTab = 'message' | 'metadata' | 'settings'
type ResponseTab = 'messages' | 'headers' | 'trailers' | 'timeline'

const typeLabel: Record<GrpcMethodDefinition['type'], string> = {
  unary: 'grpc.unary',
  'server-stream': 'grpc.serverStream',
  'client-stream': 'grpc.clientStream',
  'bidi-stream': 'grpc.bidiStream',
}

const callTypeGuidance: Record<
  GrpcMethodDefinition['type'],
  {
    flowKey: 'unaryFlow' | 'serverStreamFlow' | 'clientStreamFlow' | 'bidiStreamFlow'
    hintKey: 'unaryHint' | 'serverStreamHint' | 'clientStreamHint' | 'bidiStreamHint'
  }
> = {
  unary: { flowKey: 'unaryFlow', hintKey: 'unaryHint' },
  'server-stream': { flowKey: 'serverStreamFlow', hintKey: 'serverStreamHint' },
  'client-stream': { flowKey: 'clientStreamFlow', hintKey: 'clientStreamHint' },
  'bidi-stream': { flowKey: 'bidiStreamFlow', hintKey: 'bidiStreamHint' },
}

const parseProtoDefinition = (
  source: string,
  fileName: string,
  endpoint: string,
): GrpcDefinition | null => {
  const packageName =
    source.match(/\bpackage\s+([\w.]+)\s*;/)?.[1] ?? fileName.replace(/\.proto$/i, '')
  const methods: GrpcMethodDefinition[] = []
  const servicePattern = /\bservice\s+(\w+)\s*\{([\s\S]*?)\}/g
  for (const match of source.matchAll(servicePattern)) {
    const [, service, body] = match
    if (!service || !body) continue
    for (const rpc of body.matchAll(
      /\brpc\s+(\w+)\s*\(\s*(stream\s+)?([\w.]+)\s*\)\s*returns\s*\(\s*(stream\s+)?([\w.]+)\s*\)/g,
    )) {
      const [, name, requestStream, requestType, responseStream, responseType] = rpc
      if (!name || !requestType || !responseType) continue
      const type = requestStream
        ? responseStream
          ? 'bidi-stream'
          : 'client-stream'
        : responseStream
          ? 'server-stream'
          : 'unary'
      methods.push({
        id: `grpc-${crypto.randomUUID()}`,
        service,
        name,
        packageName,
        type,
        requestType,
        responseType,
        description: `${service}/${name}`,
      })
    }
  }
  if (!methods.length) return null
  return {
    id: `grpc-definition-${crypto.randomUUID()}`,
    name: packageName,
    source: 'proto',
    endpoint,
    secure: true,
    methods,
  }
}

const GrpcMethodPicker = ({
  methods,
  value,
  onValueChange,
  label,
}: {
  methods: GrpcMethodDefinition[]
  value: string
  onValueChange: (methodId: string) => void
  label: string
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const selected = methods.find((method) => method.id === value) ?? methods[0]
  const serviceMethods = methods.reduce<Record<string, GrpcMethodDefinition[]>>(
    (groups, method) => {
      ;(groups[method.service] ??= []).push(method)
      return groups
    },
    {},
  )
  if (!selected) return null

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          className="flex h-9 min-w-[260px] flex-1 items-center gap-2 rounded-md border border-transparent bg-surface-sunken px-3 text-left transition-colors hover:border-border-strong hover:bg-surface-raised focus:outline-none focus:ring-1 focus:ring-accent/70 data-[state=open]:border-accent"
        >
          <RadioTower className="size-4 shrink-0 text-info" />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">
            {selected.service}/{selected.name}
          </span>
          <ChevronDown className="size-4 shrink-0 text-ink-subtle" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-[100] w-[min(var(--radix-dropdown-menu-trigger-width),calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-surface-raised shadow-panel"
        >
          <CommandRoot label={label} className="text-ink">
            <CommandInput
              autoFocus
              placeholder={t('grpc.searchMethods')}
              className="h-10 w-full border-b border-border bg-transparent px-3 text-xs outline-none placeholder:text-ink-subtle"
            />
            <CommandList className="max-h-72 overflow-y-auto p-1.5">
              <CommandEmpty className="px-2.5 py-5 text-center text-xs text-ink-muted">
                {t('grpc.noMatchingMethods')}
              </CommandEmpty>
              {Object.entries(serviceMethods).map(([service, entries]) => (
                <div key={service} className="mb-1 last:mb-0">
                  <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                    {service}
                  </p>
                  {entries.map((method) => (
                    <CommandItem
                      key={method.id}
                      value={`${method.service} ${method.name} ${method.type} ${method.packageName}`}
                      onSelect={() => {
                        onValueChange(method.id)
                        setOpen(false)
                      }}
                      className={cn(
                        'flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 outline-none data-[selected=true]:bg-surface-hover',
                        method.id === selected.id && 'bg-accent-soft',
                      )}
                    >
                      <RadioTower className="size-3.5 shrink-0 text-info" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-ink">
                          {method.name}
                        </span>
                        <span className="block truncate text-[10px] text-ink-muted">
                          {t(typeLabel[method.type])} · {method.description}
                        </span>
                      </span>
                      <span className="font-mono text-[10px] text-ink-subtle">
                        {method.requestType} → {method.responseType}
                      </span>
                    </CommandItem>
                  ))}
                </div>
              ))}
            </CommandList>
          </CommandRoot>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

const StreamGuide = ({
  type,
  definitionSource,
  definitionState,
  controls,
}: {
  type: GrpcMethodDefinition['type']
  definitionSource: 'reflection' | 'proto'
  definitionState: 'ready' | 'importing' | 'failed'
  controls: ReactNode
}) => {
  const { t } = useTranslation()
  const guidance = callTypeGuidance[type]

  return (
    <div className="flex h-9 items-center gap-2 border-b border-border bg-surface-raised px-3">
      <RadioTower className="size-3.5 shrink-0 text-info" />
      <Badge tone="info">{t(typeLabel[type])}</Badge>
      <span className="min-w-0 truncate font-mono text-[10px] text-ink-muted">
        {t(`grpc.${guidance.flowKey}`)}
      </span>
      <span
        className="sr-only"
        title={`${definitionSource} · ${t(`grpc.definition_${definitionState}`)}`}
      />
      <span className="ml-auto shrink-0">{controls}</span>
      <span className="sr-only">
        {t('grpc.callBehavior')}: {t(`grpc.${guidance.hintKey}`)}
      </span>
    </div>
  )
}

const GrpcDefinitionManager = ({
  definitions,
  definition,
  selectedMethodId,
  onSelectDefinition,
  onSelectMethod,
  onImport,
  onRefresh,
}: {
  definitions: GrpcDefinition[]
  definition: GrpcDefinition
  selectedMethodId: string
  onSelectDefinition: (definition: GrpcDefinition) => void
  onSelectMethod: (method: GrpcMethodDefinition) => void
  onImport: () => void
  onRefresh: () => void
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const services = Array.from(new Set(definition.methods.map((method) => method.service)))

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="ghost" className="h-7 min-h-7 px-2 text-[11px]">
          <Database className="size-3.5" />
          {t('grpc.manageDefinitions')}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={`${modalBackdropClassName} z-[100]`} />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] flex max-h-[min(760px,88vh)] w-[min(94vw,760px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-surface-raised shadow-panel focus:outline-none">
          <header className="border-b border-border px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-ink">
              {t('grpc.manageDefinitions')}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs leading-relaxed text-ink-muted">
              {t('grpc.manageDefinitionsHint')}
            </Dialog.Description>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {definitions.length > 1 ? (
              <div
                className="mb-5 flex gap-2 overflow-x-auto pb-1"
                aria-label={t('grpc.definition')}
              >
                {definitions.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onSelectDefinition(entry)}
                    className={cn(
                      'min-w-40 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      entry.id === definition.id
                        ? 'border-accent bg-accent-soft'
                        : 'border-border bg-surface hover:bg-surface-hover',
                    )}
                  >
                    <span className="block truncate text-xs font-semibold text-ink">
                      {entry.name}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] text-ink-muted">
                      {entry.endpoint}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            <section className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{definition.name}</p>
                  <p className="mt-1 font-mono text-[11px] text-ink-muted">{definition.endpoint}</p>
                </div>
                <Badge tone={definition.source === 'reflection' ? 'success' : 'info'}>
                  {definition.source === 'reflection' ? t('grpc.reflection') : t('grpc.protoFile')}
                </Badge>
              </div>
              <p className="mt-3 text-[11px] text-ink-muted">
                {t('grpc.definitionMethods', { count: definition.methods.length })}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={onRefresh} icon={<RefreshCcw className="size-3.5" />}>
                  {t('grpc.refreshReflection')}
                </Button>
                <Button size="sm" onClick={onImport} icon={<Upload className="size-3.5" />}>
                  {t('grpc.importProto')}
                </Button>
              </div>
            </section>

            <section className="mt-5">
              <h3 className="text-xs font-semibold text-ink">{t('grpc.methods')}</h3>
              <div className="mt-2 overflow-hidden rounded-lg border border-border bg-surface">
                {services.map((service) => (
                  <div key={service}>
                    <div className="border-b border-border bg-surface-sunken px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      {service}
                    </div>
                    {definition.methods
                      .filter((method) => method.service === service)
                      .map((method) => (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => {
                            onSelectMethod(method)
                            setOpen(false)
                          }}
                          className={cn(
                            'flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
                            method.id === selectedMethodId && 'bg-accent-soft',
                          )}
                        >
                          <RadioTower className="size-3.5 shrink-0 text-info" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-medium text-ink">
                              {method.name}
                            </span>
                            <span className="mt-0.5 block truncate font-mono text-[10px] text-ink-muted">
                              {method.requestType} → {method.responseType}
                            </span>
                          </span>
                          <Badge tone="info">{t(typeLabel[method.type])}</Badge>
                        </button>
                      ))}
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-5 rounded-lg border border-border bg-surface-sunken p-4">
              <h3 className="text-xs font-semibold text-ink">{t('grpc.howItWorks')}</h3>
              <ol className="mt-3 grid gap-2 text-[11px] leading-relaxed text-ink-muted sm:grid-cols-3">
                {[t('grpc.stepDefinition'), t('grpc.stepMethod'), t('grpc.stepInvoke')].map(
                  (step, index) => (
                    <li key={step} className="flex gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ),
                )}
              </ol>
            </section>
          </div>
          <footer className="flex justify-end border-t border-border bg-surface-sunken px-5 py-3">
            <Dialog.Close asChild>
              <Button size="sm">{t('common.close')}</Button>
            </Dialog.Close>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const GrpcWorkbench = () => {
  const { t } = useTranslation()
  const { requestId } = useParams()
  const data = usePulseStore((state) => state.data)
  const selectedRequestId = requestId ?? data.activeRequestId
  const selectRequest = usePulseStore((state) => state.selectRequest)
  const updateRequest = usePulseStore((state) => state.updateRequest)
  const upsertGrpcDefinition = usePulseStore((state) => state.upsertGrpcDefinition)
  const sendActiveRequest = usePulseStore((state) => state.sendActiveRequest)
  const cancelActiveRequest = usePulseStore((state) => state.cancelActiveRequest)
  const sendGrpcMessage = usePulseStore((state) => state.sendGrpcMessage)
  const pauseGrpcStream = usePulseStore((state) => state.pauseGrpcStream)
  const resumeGrpcStream = usePulseStore((state) => state.resumeGrpcStream)
  const halfCloseGrpcStream = usePulseStore((state) => state.halfCloseGrpcStream)
  const clearGrpcStream = usePulseStore((state) => state.clearGrpcStream)
  const executionState = usePulseStore((state) => state.executionState)
  const grpcSessionState = usePulseStore((state) => state.grpcSessionState)
  const result = usePulseStore((state) => state.lastGrpcResult)
  const requestError = usePulseStore((state) => state.requestError)
  const locale = usePulseStore((state) => state.preferences.locale)
  const showToast = usePulseStore((state) => state.showToast)
  const [composerTab, setComposerTab] = useState<ComposerTab>('message')
  const [responseTab, setResponseTab] = useState<ResponseTab>('messages')
  const [definitionSource, setDefinitionSource] = useState<'reflection' | 'proto'>('reflection')
  const [definitionState, setDefinitionState] = useState<'ready' | 'importing' | 'failed'>('ready')
  const protoInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (requestId) selectRequest(requestId)
  }, [requestId, selectRequest])

  const request = data.requests.find((entry) => entry.id === selectedRequestId)
  const definition = request
    ? (data.grpcDefinitions.find((entry) => entry.id === request.grpcDefinitionId) ??
      data.grpcDefinitions.find((entry) =>
        entry.methods.some((method) => method.id === request.grpcMethodId),
      ) ??
      data.grpcDefinitions[0])
    : undefined
  const selectedMethod =
    definition?.methods.find((method) => method.id === request?.grpcMethodId) ??
    definition?.methods[0]
  if (!request || request.protocol !== 'grpc' || !definition || !selectedMethod)
    return <NotFoundState descriptionKey="errors.noRequest" />
  const busy = executionState === 'running' || executionState === 'resolving'
  const cancelled = executionState === 'cancelled' || grpcSessionState === 'cancelled'
  const paused = grpcSessionState === 'paused'
  const halfClosed = grpcSessionState === 'half-closed'
  const streamActive = ['streaming', 'paused', 'half-closed'].includes(grpcSessionState)

  const selectMethod = (method: GrpcMethodDefinition) =>
    updateRequest(request.id, { grpcMethodId: method.id, grpcType: method.type })
  const sendMessage = async () => {
    try {
      const message = JSON.parse(request.body) as JsonValue
      if (!(await sendGrpcMessage(message))) showToast(t('grpc.streamUnavailable'))
    } catch {
      showToast(t('grpc.messageInvalid'))
    }
  }
  const importProto = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 1_048_576) {
      setDefinitionState('failed')
      showToast(t('grpc.protoInvalid'))
      return
    }
    setDefinitionState('importing')
    let source: string
    try {
      source = await file.text()
    } catch {
      setDefinitionState('failed')
      showToast(t('grpc.protoInvalid'))
      return
    }
    const importedDefinition = parseProtoDefinition(source, file.name, request.url)
    if (!importedDefinition) {
      setDefinitionState('failed')
      showToast(t('grpc.protoInvalid'))
      return
    }
    upsertGrpcDefinition(importedDefinition)
    const initialMethod = importedDefinition.methods[0]!
    updateRequest(request.id, {
      grpcDefinitionId: importedDefinition.id,
      grpcMethodId: initialMethod.id,
      grpcType: initialMethod.type,
    })
    setDefinitionSource('proto')
    setDefinitionState('ready')
    showToast(t('grpc.protoImported', { name: file.name }))
  }

  const refreshReflection = () => {
    setDefinitionSource('reflection')
    setDefinitionState('ready')
    showToast(t('grpc.reflectionUpdated'))
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto xl:overflow-hidden">
        <div className="border-b border-border bg-surface">
          <RequestTitleBar request={request} />
          <div className="p-3">
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border-strong bg-surface-raised p-1.5 shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15 max-md:gap-2">
              <GrpcMethodPicker
                methods={definition.methods}
                value={selectedMethod.id}
                onValueChange={(methodId) => {
                  const method = definition.methods.find((entry) => entry.id === methodId)
                  if (method) selectMethod(method)
                }}
                label={t('grpc.method')}
              />
              <div className="relative min-w-[220px] flex-1">
                <Input
                  id="request-endpoint"
                  value={request.url}
                  onChange={(event) => updateRequest(request.id, { url: event.target.value })}
                  aria-label={t('grpc.endpoint')}
                  className="h-9 border-transparent bg-transparent pr-20 font-mono text-xs hover:border-border focus:border-accent max-md:h-10"
                />
                <Badge tone="success" className="absolute right-2 top-1/2 -translate-y-1/2">
                  <LockKeyhole className="size-3" />
                  TLS
                </Badge>
              </div>
              {busy ? (
                <Button
                  variant="danger"
                  className="h-9"
                  icon={<CircleStop className="size-4" />}
                  onClick={cancelActiveRequest}
                >
                  {t('grpc.cancel')}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  className="h-9 shadow-sm"
                  icon={<RadioTower className="size-4" />}
                  onClick={() => void sendActiveRequest()}
                >
                  {t('grpc.invoke')}
                </Button>
              )}
            </div>
          </div>
        </div>

        <RequestResponseLayout
          className="flex-1"
          request={
            <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
              <div
                className="flex h-10 items-center gap-1 border-b border-border bg-surface px-3"
                role="tablist"
              >
                {(['message', 'metadata', 'settings'] as ComposerTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={composerTab === tab}
                    tabIndex={composerTab === tab ? 0 : -1}
                    onClick={() => setComposerTab(tab)}
                    className={cn(
                      'relative h-full shrink-0 border-b-2 border-transparent px-2.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink',
                      composerTab === tab && 'border-accent text-ink',
                    )}
                  >
                    {tab === 'message'
                      ? t('grpc.requestMessage')
                      : tab === 'metadata'
                        ? t('grpc.metadata')
                        : t('workbench.requestSettings')}
                  </button>
                ))}
              </div>
              <StreamGuide
                type={selectedMethod.type}
                definitionSource={definitionSource}
                definitionState={definitionState}
                controls={
                  <>
                    <input
                      ref={protoInput}
                      type="file"
                      accept=".proto,text/plain"
                      className="sr-only"
                      aria-label={t('grpc.importProto')}
                      onChange={(event) => {
                        void importProto(event.target.files?.[0])
                        event.target.value = ''
                      }}
                    />
                    <GrpcDefinitionManager
                      definitions={data.grpcDefinitions}
                      definition={definition}
                      selectedMethodId={selectedMethod.id}
                      onSelectDefinition={(nextDefinition) => {
                        const firstMethod = nextDefinition.methods[0]
                        if (!firstMethod) return
                        updateRequest(request.id, {
                          grpcDefinitionId: nextDefinition.id,
                          grpcMethodId: firstMethod.id,
                          grpcType: firstMethod.type,
                          url: nextDefinition.endpoint,
                        })
                        setDefinitionSource(nextDefinition.source)
                      }}
                      onSelectMethod={selectMethod}
                      onImport={() => protoInput.current?.click()}
                      onRefresh={refreshReflection}
                    />
                  </>
                }
              />
              <div className="min-h-0 flex-1 overflow-auto">
                {composerTab === 'message' ? (
                  <CodeEditor
                    value={request.body}
                    onChange={(body) => updateRequest(request.id, { body })}
                    label={t('grpc.requestMessage')}
                  />
                ) : null}
                {composerTab === 'metadata' ? (
                  <KeyValueEditor
                    rows={request.metadata}
                    onChange={(metadata) => updateRequest(request.id, { metadata })}
                    allowSecrets
                  />
                ) : null}
                {composerTab === 'settings' ? (
                  <div className="grid gap-4 p-4 md:grid-cols-2">
                    <FieldShell label={t('grpc.deadline')} htmlFor="grpc-deadline" hint="ms">
                      <Input
                        id="grpc-deadline"
                        type="number"
                        min={1}
                        value={request.timeoutMs}
                        onChange={(event) =>
                          updateRequest(request.id, { timeoutMs: Number(event.target.value) })
                        }
                      />
                    </FieldShell>
                    <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-raised p-3 text-xs text-ink md:col-span-2">
                      <span>{t('workbench.verifyTls')}</span>
                      <Switch
                        checked={request.verifyTls}
                        onCheckedChange={(verifyTls) => updateRequest(request.id, { verifyTls })}
                        label={t('workbench.verifyTls')}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
              {(selectedMethod.type === 'client-stream' || selectedMethod.type === 'bidi-stream') &&
              (streamActive || result) ? (
                <div className="flex items-center gap-2 border-t border-border p-2">
                  <Button
                    size="sm"
                    icon={<Send className="size-3.5" />}
                    onClick={() => void sendMessage()}
                    disabled={!streamActive || halfClosed || (result?.status ?? 0) !== 0}
                  >
                    {t('grpc.sendMessage')}
                  </Button>
                  <Button
                    size="sm"
                    icon={<StepForward className="size-3.5" />}
                    onClick={() => void halfCloseGrpcStream()}
                    disabled={!streamActive || halfClosed || (result?.status ?? 0) !== 0}
                  >
                    {t('grpc.halfClose')}
                  </Button>
                  {halfClosed ? (
                    <StatusBadge status="paused">{t('grpc.halfClosed')}</StatusBadge>
                  ) : null}
                </div>
              ) : null}
            </section>
          }
          response={
            <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
              <ResponseHeader>
                <h2 className="text-xs font-semibold">{t('workbench.response')}</h2>
                {result ? (
                  <>
                    <StatusBadge
                      status={
                        grpcSessionState === 'paused' || grpcSessionState === 'half-closed'
                          ? 'paused'
                          : grpcSessionState === 'streaming'
                            ? 'running'
                            : result.status === 0
                              ? 'success'
                              : 'failed'
                      }
                    >
                      {grpcSessionState === 'paused'
                        ? 'PAUSED'
                        : grpcSessionState === 'half-closed'
                          ? 'HALF_CLOSED'
                          : result.statusName}
                    </StatusBadge>
                    <span className="ml-auto flex items-center gap-1 text-[11px] text-ink-muted">
                      <Clock3 className="size-3" />
                      {formatDuration(result.duration, locale)}
                    </span>
                    <span className="text-[11px] text-ink-muted">
                      {t('grpc.inboundCount', {
                        count: result.messages.filter((message) => message.direction === 'inbound')
                          .length,
                      })}
                    </span>
                  </>
                ) : cancelled ? (
                  <StatusBadge status="failed">1 CANCELLED</StatusBadge>
                ) : (
                  <span className="ml-auto text-[11px] text-ink-subtle">
                    {busy ? t('grpc.connecting') : t('common.ready')}
                  </span>
                )}
              </ResponseHeader>
              {result ? (
                <>
                  <ResponseTabs
                    active={responseTab}
                    onChange={setResponseTab}
                    ariaLabel={t('workbench.response')}
                    items={(['messages', 'headers', 'trailers', 'timeline'] as ResponseTab[]).map(
                      (tab) => ({ key: tab, label: t(`grpc.${tab}`) }),
                    )}
                    trailing={
                      streamActive && !halfClosed ? (
                        <IconButton
                          label={paused ? t('grpc.resume') : t('grpc.pause')}
                          icon={paused ? <Play className="size-3" /> : <Pause className="size-3" />}
                          active={paused}
                          className="size-7"
                          onClick={paused ? resumeGrpcStream : pauseGrpcStream}
                        />
                      ) : (
                        <IconButton
                          label={t('grpc.clear')}
                          icon={<Trash2 className="size-3" />}
                          className="size-7"
                          onClick={clearGrpcStream}
                        />
                      )
                    }
                  />
                  <div
                    tabIndex={0}
                    aria-label={t(`grpc.${responseTab}`)}
                    className="min-h-0 flex-1 overflow-auto"
                  >
                    {responseTab === 'messages' ? (
                      <div className="space-y-1 p-3">
                        {result.messages.map((message, index) => (
                          <article
                            key={message.id}
                            className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-3 py-1"
                          >
                            <span className="relative flex justify-center">
                              {index < result.messages.length - 1 ? (
                                <span
                                  aria-hidden="true"
                                  className="absolute bottom-[-0.5rem] top-[0.875rem] w-px bg-border"
                                />
                              ) : null}
                              <span
                                className={cn(
                                  'relative z-10 mt-2 size-3 rounded-full border-[3px] border-surface',
                                  message.direction === 'inbound'
                                    ? 'bg-success'
                                    : message.direction === 'outbound'
                                      ? 'bg-info'
                                      : 'bg-ink-subtle',
                                )}
                              />
                            </span>
                            <div className="min-w-0 pb-3">
                              <div className="mb-1.5 flex items-center gap-2">
                                <Badge
                                  tone={
                                    message.direction === 'inbound'
                                      ? 'success'
                                      : message.direction === 'outbound'
                                        ? 'info'
                                        : 'neutral'
                                  }
                                >
                                  {message.direction === 'inbound'
                                    ? t('grpc.inbound')
                                    : message.direction === 'outbound'
                                      ? t('grpc.outbound')
                                      : t('grpc.system')}
                                </Badge>
                                <span className="font-mono text-[10px] text-ink-subtle">
                                  +{message.atMs}ms
                                </span>
                              </div>
                              <pre
                                className={cn(
                                  'overflow-auto whitespace-pre-wrap rounded-lg border px-3 py-2.5 text-[11px] leading-relaxed text-ink-muted shadow-sm',
                                  message.direction === 'inbound'
                                    ? 'border-success/20 bg-success-soft/30'
                                    : message.direction === 'outbound'
                                      ? 'border-info/20 bg-info-soft/30'
                                      : 'border-border bg-surface-sunken',
                                )}
                              >
                                {message.payload}
                              </pre>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                    {responseTab === 'headers' ? (
                      <ResponseKeyValueRows rows={result.headers} />
                    ) : null}
                    {responseTab === 'trailers' ? (
                      <ResponseKeyValueRows rows={result.trailers} />
                    ) : null}
                    {responseTab === 'timeline' ? (
                      <div className="space-y-3 p-4">
                        {[
                          [t('grpc.connecting'), Math.max(8, Math.round(result.duration * 0.15))],
                          [t('grpc.metadataSent'), Math.max(4, Math.round(result.duration * 0.08))],
                          [t('grpc.streaming'), Math.max(12, Math.round(result.duration * 0.65))],
                          [
                            t('grpc.trailersReceived'),
                            Math.max(3, Math.round(result.duration * 0.12)),
                          ],
                        ].map(([label, duration]) => (
                          <div
                            key={String(label)}
                            className="grid grid-cols-[110px_1fr_52px] items-center gap-2 text-[11px]"
                          >
                            <span className="text-ink-muted">{label}</span>
                            <span className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                              <span
                                className="block h-full rounded-full bg-accent"
                                style={{
                                  width: `${Math.max(8, (Number(duration) / Math.max(1, result.duration)) * 100)}%`,
                                }}
                              />
                            </span>
                            <span className="text-right font-mono text-ink-subtle">
                              {duration} ms
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={
                    busy ? (
                      <Activity className="size-5 animate-pulse text-accent motion-reduce:animate-none" />
                    ) : (
                      <RadioTower className="size-5" />
                    )
                  }
                  title={
                    requestError
                      ? t('common.failed')
                      : cancelled
                        ? t('grpc.cancelled')
                        : t('grpc.readyToInvoke', { method: selectedMethod.name })
                  }
                  description={
                    requestError ??
                    (cancelled ? t('grpc.cancelledHint') : t('grpc.readyToInvokeHint'))
                  }
                />
              )}
            </section>
          }
        />
      </div>
    </div>
  )
}

export default GrpcWorkbench
