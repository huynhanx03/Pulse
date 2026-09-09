import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Check,
  CircleAlert,
  Copy,
  MoreHorizontal,
  Send,
  ShieldCheck,
  Square,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CodeEditor } from '@/components/editor/CodeEditor'
import { RequestTitleBar } from '@/components/workbench/RequestTitleBar'
import { generateRequestSnippets, parseCurl } from '@/lib/http/request-tools'
import { Button } from '@/components/ui/Button'
import { modalBackdropClassName } from '@/components/ui/dialogStyles'
import { FieldShell, Input, Textarea } from '@/components/ui/Field'
import { httpMethodTextClass } from '@/lib/http/method-display'
import { IconButton } from '@/components/ui/IconButton'
import { SelectMenu } from '@/components/ui/SelectMenu'
import { Switch } from '@/components/ui/Switch'
import { useCompactTabs } from '@/components/ui/useCompactTabs'
import type { ApiRequest, BodyMode, HttpMethod } from '@/domain/types'
import { usePulseStore } from '@/state/pulse-store'
import { cn } from '@/lib/utils/cn'
import { KeyValueEditor } from '@/components/editor/KeyValueEditor'

const primaryRequestTabs = ['params', 'authorization', 'headers', 'body'] as const
const advancedRequestTabs = ['cookies', 'requestSettings'] as const
const requestTabs = [...primaryRequestTabs, ...advancedRequestTabs] as const
type RequestTab = (typeof requestTabs)[number]
type ToolMode = 'import' | 'code'
type SnippetLanguage = 'curl' | 'fetch' | 'go' | 'python'

const httpMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

interface RequestComposerProps {
  request: ApiRequest
}

export const RequestComposer = ({ request }: RequestComposerProps) => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<RequestTab>('body')
  const [toolsOpen, setToolsOpen] = useState(false)
  const [toolMode, setToolMode] = useState<ToolMode>('import')
  const [snippetLanguage, setSnippetLanguage] = useState<SnippetLanguage>('go')
  const [curl, setCurl] = useState('')
  const toolsTrigger = useRef<HTMLElement | null>(null)
  // Keep every authoring tab visible on desktop. Secondary tabs move to More only after
  // the actual tab strip becomes narrow enough that labels would be clipped.
  const { ref: requestTabsRef, compact: requestTabsCompact } = useCompactTabs(480)
  const updateRequest = usePulseStore((state) => state.updateRequest)
  const sendActiveRequest = usePulseStore((state) => state.sendActiveRequest)
  const cancelActiveRequest = usePulseStore((state) => state.cancelActiveRequest)
  const executionState = usePulseStore((state) => state.executionState)
  const showToast = usePulseStore((state) => state.showToast)
  const busy = executionState === 'resolving' || executionState === 'running'
  const previewRequest = usePulseStore((state) => state.previewRequest)
  const secureEndpoint = previewRequest(request.id)?.url.value.startsWith('https://') ?? false

  const snippets = useMemo(() => generateRequestSnippets(request), [request])
  const parsedCurl = useMemo(() => parseCurl(curl), [curl])

  useEffect(() => {
    const handleSendShortcut = (event: KeyboardEvent) => {
      if ((!event.metaKey && !event.ctrlKey) || event.key !== 'Enter' || busy) return
      event.preventDefault()
      void sendActiveRequest()
    }
    document.addEventListener('keydown', handleSendShortcut)
    return () => document.removeEventListener('keydown', handleSendShortcut)
  }, [busy, sendActiveRequest])

  const openTools = (mode: ToolMode) => {
    toolsTrigger.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (mode === 'import') setCurl(snippets.curl)
    setToolMode(mode)
    setToolsOpen(true)
  }

  const applyCurl = () => {
    if (!parsedCurl) return
    updateRequest(request.id, {
      ...parsedCurl,
      query: [],
      auth: { ...request.auth, type: 'none' },
      headers: parsedCurl.headers.map((header) => ({
        ...header,
        id: crypto.randomUUID(),
        enabled: true,
        description: t('workbench.importedFromCurl'),
      })),
    })
    setToolsOpen(false)
    showToast(t('workbench.importedFromCurl'))
  }

  const formatBody = () => {
    if (request.bodyMode !== 'json') {
      updateRequest(request.id, { body: request.body.trim() })
      showToast(t('workbench.bodyFormatted'))
      return
    }
    try {
      updateRequest(request.id, { body: JSON.stringify(JSON.parse(request.body), null, 2) })
      showToast(t('workbench.bodyFormatted'))
    } catch {
      showToast(t('errors.invalidJson'))
    }
  }

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippets[snippetLanguage])
      showToast(t('common.copied'))
    } catch {
      showToast(t('errors.generic'))
    }
  }

  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface"
      aria-label={request.name}
    >
      <header className="border-b border-border bg-surface">
        <RequestTitleBar
          request={request}
          onImport={() => openTools('import')}
          onGenerateCode={() => openTools('code')}
        />
        <div className="p-3">
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border-strong bg-surface-raised p-1.5 shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15 max-md:gap-2">
            <SelectMenu
              value={request.method}
              onValueChange={(method) =>
                updateRequest(request.id, { method: method as HttpMethod })
              }
              label={t('workbench.method')}
              className={cn(
                'h-9 w-[92px] shrink-0 border-transparent bg-surface-sunken font-bold hover:border-border-strong',
                httpMethodTextClass(request.method),
              )}
              options={httpMethods.map((method) => ({ value: method, label: method }))}
            />
            <div className="relative min-w-[180px] flex-1 max-md:order-first max-md:basis-full">
              <Input
                id="request-endpoint"
                value={request.url}
                onChange={(event) => updateRequest(request.id, { url: event.target.value })}
                aria-label={t('workbench.endpoint')}
                spellCheck={false}
                type="url"
                inputMode="url"
                autoCapitalize="none"
                className="h-9 border-transparent bg-transparent pr-20 font-mono text-xs hover:border-border focus:border-accent max-md:h-10"
              />
              <div className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                <ShieldCheck
                  className={cn('size-3.5', secureEndpoint ? 'text-success' : 'text-info')}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    'text-[10px] font-bold',
                    secureEndpoint ? 'text-success' : 'text-info',
                  )}
                >
                  {secureEndpoint ? 'HTTPS' : 'HTTP'}
                </span>
              </div>
            </div>
            {busy ? (
              <Button
                variant="danger"
                className="h-9 max-md:flex-1"
                icon={<Square className="size-3 fill-current" />}
                onClick={cancelActiveRequest}
                aria-label={t('workbench.cancelRequest')}
              >
                {t('common.cancel')}
              </Button>
            ) : (
              <Button
                variant="primary"
                className="h-9 shadow-sm max-md:flex-1"
                icon={<Send className="size-3.5" />}
                onClick={() => void sendActiveRequest()}
                aria-label={t('workbench.sendRequest')}
              >
                {t('common.send')}
                <span className="ml-1 hidden rounded border border-current/20 px-1 py-px text-[9px] font-bold opacity-80 xl:inline">
                  ⌘↵
                </span>
              </Button>
            )}
          </div>
        </div>
      </header>
      <div
        ref={requestTabsRef}
        className="flex h-10 shrink-0 gap-1 overflow-hidden border-b border-border bg-surface px-3"
      >
        <div
          className="flex min-w-0 flex-1 gap-1 overflow-hidden"
          role="tablist"
          aria-label={t('common.details')}
        >
          {(requestTabsCompact ? primaryRequestTabs : requestTabs).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              tabIndex={tab === key ? 0 : -1}
              onClick={() => setTab(key)}
              className={cn(
                'relative h-full shrink-0 border-b-2 border-transparent px-2.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink',
                tab === key && 'border-accent text-ink',
              )}
            >
              {t(`workbench.${key}`)}
            </button>
          ))}
        </div>
        {requestTabsCompact ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label={t('nav.more')}
                className={cn(
                  'flex h-full shrink-0 items-center gap-1 border-b-2 border-transparent px-2.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink',
                  advancedRequestTabs.includes(tab as (typeof advancedRequestTabs)[number]) &&
                    'border-accent text-ink',
                )}
              >
                <MoreHorizontal className="size-3.5" />
                {t('nav.more')}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={6}
                className="z-[80] min-w-40 rounded-lg border border-border bg-surface-raised p-1.5 text-xs text-ink shadow-panel"
              >
                {advancedRequestTabs.map((key) => (
                  <DropdownMenu.Item
                    key={key}
                    onSelect={() => setTab(key)}
                    className={cn(
                      'flex cursor-default items-center rounded-md px-2.5 py-2 outline-none data-[highlighted]:bg-surface-hover',
                      tab === key && 'bg-accent-soft font-semibold text-accent',
                    )}
                  >
                    {t(`workbench.${key}`)}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'params' ? (
          <KeyValueEditor
            rows={request.query}
            onChange={(query) => updateRequest(request.id, { query })}
          />
        ) : null}
        {tab === 'headers' ? (
          <KeyValueEditor
            rows={request.headers}
            onChange={(headers) => updateRequest(request.id, { headers })}
            allowSecrets
          />
        ) : null}
        {tab === 'cookies' ? (
          <KeyValueEditor
            rows={request.cookies}
            onChange={(cookies) => updateRequest(request.id, { cookies })}
            allowSecrets
          />
        ) : null}
        {tab === 'authorization' ? (
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <FieldShell label={t('workbench.authType')} htmlFor="request-auth-type">
              <SelectMenu
                id="request-auth-type"
                value={request.auth.type}
                onValueChange={(type) =>
                  updateRequest(request.id, {
                    auth: {
                      ...request.auth,
                      type: type as ApiRequest['auth']['type'],
                    },
                  })
                }
                label={t('workbench.authType')}
                options={[
                  { value: 'inherit', label: t('workbench.inheritAuth') },
                  { value: 'none', label: t('workbench.noAuth') },
                  { value: 'bearer', label: t('workbench.bearerToken') },
                  { value: 'basic', label: t('workbench.basicAuth') },
                  { value: 'api-key', label: t('workbench.apiKey') },
                  { value: 'oauth2', label: 'OAuth 2.0' },
                ]}
              />
            </FieldShell>
            {request.auth.type === 'inherit' ? (
              <div className="rounded-md border border-accent/20 bg-accent-soft p-3 text-xs text-ink-muted">
                <p className="font-semibold text-accent">{t('workbench.inheritedAuth')}</p>
                <p className="mt-1 font-mono">Bearer {'{{access_token}}'}</p>
              </div>
            ) : null}
            {request.auth.type === 'none' ? (
              <div className="rounded-md border border-border bg-surface-sunken p-3 text-xs text-ink-muted">
                {t('workbench.noAuthHint')}
              </div>
            ) : null}
            {request.auth.type === 'bearer' || request.auth.type === 'oauth2' ? (
              <FieldShell
                label={
                  request.auth.type === 'oauth2' ? 'OAuth 2.0 token' : t('workbench.bearerToken')
                }
                htmlFor="request-token"
                hint={t('common.secret')}
              >
                <Input
                  id="request-token"
                  type="password"
                  value={request.auth.token}
                  onChange={(event) =>
                    updateRequest(request.id, {
                      auth: { ...request.auth, token: event.target.value },
                    })
                  }
                  className="font-mono"
                />
              </FieldShell>
            ) : null}
            {request.auth.type === 'basic' ? (
              <>
                <FieldShell label={t('workbench.username')} htmlFor="request-username">
                  <Input
                    id="request-username"
                    value={request.auth.username}
                    onChange={(event) =>
                      updateRequest(request.id, {
                        auth: { ...request.auth, username: event.target.value },
                      })
                    }
                  />
                </FieldShell>
                <FieldShell
                  label={t('workbench.password')}
                  htmlFor="request-password"
                  hint={t('common.secret')}
                >
                  <Input
                    id="request-password"
                    type="password"
                    value={request.auth.password}
                    onChange={(event) =>
                      updateRequest(request.id, {
                        auth: { ...request.auth, password: event.target.value },
                      })
                    }
                  />
                </FieldShell>
              </>
            ) : null}
            {request.auth.type === 'api-key' ? (
              <>
                <FieldShell label={t('workbench.apiKeyName')} htmlFor="request-api-key">
                  <Input
                    id="request-api-key"
                    value={request.auth.key}
                    onChange={(event) =>
                      updateRequest(request.id, {
                        auth: { ...request.auth, key: event.target.value },
                      })
                    }
                    className="font-mono"
                  />
                </FieldShell>
                <FieldShell
                  label={t('workbench.apiKeyValue')}
                  htmlFor="request-api-value"
                  hint={t('common.secret')}
                >
                  <Input
                    id="request-api-value"
                    type="password"
                    value={request.auth.value}
                    onChange={(event) =>
                      updateRequest(request.id, {
                        auth: { ...request.auth, value: event.target.value },
                      })
                    }
                    className="font-mono"
                  />
                </FieldShell>
                <FieldShell label={t('workbench.apiKeyLocation')} htmlFor="request-api-location">
                  <SelectMenu
                    id="request-api-location"
                    value={request.auth.location}
                    onValueChange={(location) =>
                      updateRequest(request.id, {
                        auth: {
                          ...request.auth,
                          location: location as ApiRequest['auth']['location'],
                        },
                      })
                    }
                    label={t('workbench.apiKeyLocation')}
                    options={[
                      { value: 'header', label: 'Header' },
                      { value: 'query', label: 'Query parameter' },
                    ]}
                  />
                </FieldShell>
              </>
            ) : null}
          </div>
        ) : null}
        {tab === 'body' ? (
          <div className="flex h-full min-h-[300px] flex-col">
            <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
                {t('workbench.bodyType')}
              </span>
              <SelectMenu
                value={request.bodyMode}
                onValueChange={(bodyMode) =>
                  updateRequest(request.id, { bodyMode: bodyMode as BodyMode })
                }
                className="h-7 w-28 border-transparent bg-transparent py-0 text-[11px] max-md:h-8"
                label={t('workbench.bodyType')}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'json', label: 'JSON' },
                  { value: 'text', label: 'Text' },
                  { value: 'form', label: 'Form data' },
                  { value: 'graphql', label: 'GraphQL' },
                ]}
              />
              <button
                type="button"
                className="ml-auto text-[11px] font-medium text-accent hover:underline"
                onClick={formatBody}
              >
                {t('workbench.format')}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-surface-raised">
              {request.bodyMode === 'none' ? (
                <div className="p-8 text-center text-xs text-ink-muted">
                  {t('workbench.noRequestBody')}
                </div>
              ) : (
                <CodeEditor
                  value={request.body}
                  onChange={(body) => updateRequest(request.id, { body })}
                  language={request.bodyMode === 'json' ? 'json' : 'text'}
                  label={t('workbench.body')}
                />
              )}
            </div>
          </div>
        ) : null}
        {tab === 'requestSettings' ? (
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <FieldShell label={t('workbench.timeout')} htmlFor="request-timeout" hint="ms">
              <Input
                id="request-timeout"
                type="number"
                min={1}
                value={request.timeoutMs}
                onChange={(event) =>
                  updateRequest(request.id, { timeoutMs: Number(event.target.value) })
                }
              />
            </FieldShell>
            <div className="space-y-3 rounded-md border border-border bg-surface-raised p-3">
              <label className="flex items-center justify-between gap-3 text-xs text-ink">
                <span>{t('workbench.followRedirects')}</span>
                <Switch
                  checked={request.followRedirects}
                  onCheckedChange={(followRedirects) =>
                    updateRequest(request.id, { followRedirects })
                  }
                  label={t('workbench.followRedirects')}
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-xs text-ink">
                <span>{t('workbench.verifyTls')}</span>
                <Switch
                  checked={request.verifyTls}
                  onCheckedChange={(verifyTls) => updateRequest(request.id, { verifyTls })}
                  label={t('workbench.verifyTls')}
                />
              </label>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog.Root open={toolsOpen} onOpenChange={setToolsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className={`${modalBackdropClassName} z-50`} />
          <Dialog.Content
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              toolsTrigger.current?.focus()
            }}
            className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] overflow-y-auto w-[min(92vw,760px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface-raised shadow-panel focus:outline-none"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <Dialog.Title className="text-sm font-semibold">
                {t(toolMode === 'import' ? 'workbench.importCurl' : 'workbench.generateCode')}
              </Dialog.Title>
              <Dialog.Close asChild>
                <IconButton label={t('common.close')} icon={<X className="size-4" />} />
              </Dialog.Close>
            </div>
            <Dialog.Description className="px-4 pt-3 text-xs leading-relaxed text-ink-muted">
              {t(toolMode === 'import' ? 'workbench.importHint' : 'workbench.snippetHint')}
            </Dialog.Description>
            {toolMode === 'import' ? (
              <div className="grid gap-4 p-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="curl-input"
                    className="mb-1.5 block text-xs font-semibold text-ink-muted"
                  >
                    cURL
                  </label>
                  <Textarea
                    id="curl-input"
                    value={curl}
                    onChange={(event) => setCurl(event.target.value)}
                    className="min-h-64"
                  />
                  <div
                    role="status"
                    className={cn(
                      'mt-2 flex items-start gap-1.5 text-[11px]',
                      parsedCurl ? 'text-success' : 'text-danger',
                    )}
                  >
                    {parsedCurl ? (
                      <Check className="size-3.5 shrink-0" />
                    ) : (
                      <CircleAlert className="size-3.5 shrink-0" />
                    )}
                    {t(parsedCurl ? 'workbench.importReady' : 'workbench.invalidCurl')}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-ink-muted">
                    {t('workbench.dryRun')}
                  </p>
                  <pre
                    tabIndex={0}
                    aria-label={t('workbench.dryRun')}
                    className="max-h-80 min-h-64 overflow-auto rounded-md border border-border bg-surface-sunken p-3 text-xs leading-relaxed text-ink"
                  >
                    {parsedCurl ? JSON.stringify(parsedCurl, null, 2) : '—'}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="mb-3 flex flex-wrap items-center gap-1">
                  {(['curl', 'fetch', 'go', 'python'] as SnippetLanguage[]).map((language) => (
                    <Button
                      key={language}
                      size="sm"
                      variant={snippetLanguage === language ? 'secondary' : 'ghost'}
                      onClick={() => setSnippetLanguage(language)}
                    >
                      {language === 'go'
                        ? 'Go · net/http'
                        : language === 'python'
                          ? 'Python · requests'
                          : language === 'fetch'
                            ? 'JavaScript · Fetch'
                            : 'cURL'}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    className="ml-auto"
                    icon={<Copy className="size-3.5" />}
                    onClick={() => void copySnippet()}
                  >
                    {t('common.copy')}
                  </Button>
                </div>
                <pre
                  tabIndex={0}
                  aria-label={t('workbench.generateCode')}
                  className="max-h-[55vh] min-h-72 overflow-auto rounded-md border border-border bg-surface-sunken p-4 text-xs leading-relaxed text-ink"
                >
                  {snippets[snippetLanguage]}
                </pre>
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
              <Dialog.Close asChild>
                <Button>{toolMode === 'import' ? t('common.cancel') : t('common.close')}</Button>
              </Dialog.Close>
              {toolMode === 'import' ? (
                <Button variant="primary" onClick={applyCurl} disabled={!parsedCurl}>
                  {t('common.import')}
                </Button>
              ) : null}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  )
}
