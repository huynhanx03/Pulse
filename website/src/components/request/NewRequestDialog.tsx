import * as Dialog from '@radix-ui/react-dialog'
import { Braces, RadioTower, X } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { FieldShell, Input } from '@/components/ui/Field'
import { SelectMenu } from '@/components/ui/SelectMenu'
import type { HttpMethod, RequestProtocol } from '@/domain/types'
import { httpMethodTextClass } from '@/lib/http/method-display'
import { cn } from '@/lib/utils/cn'
import { modalBackdropClassName } from '@/components/ui/dialogStyles'
import { usePulseStore } from '@/state/pulse-store'

const requestKinds: Array<{
  protocol: RequestProtocol
  icon: typeof Braces
  labelKey: 'newHttp' | 'newGrpc'
  descriptionKey: 'newHttpHint' | 'newGrpcHint'
}> = [
  { protocol: 'http', icon: Braces, labelKey: 'newHttp', descriptionKey: 'newHttpHint' },
  { protocol: 'grpc', icon: RadioTower, labelKey: 'newGrpc', descriptionKey: 'newGrpcHint' },
]

const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

export interface NewRequestValues {
  protocol: RequestProtocol
  name: string
  method: HttpMethod
  url: string
  grpcMethodId: string
}

interface NewRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (values: NewRequestValues) => void
}

/** A config-driven creation flow: adding a protocol starts with one request-kind definition. */
export const NewRequestDialog = ({ open, onOpenChange, onCreate }: NewRequestDialogProps) => {
  const { t } = useTranslation()
  const nameId = useId()
  const urlId = useId()
  const methodId = useId()
  const [protocol, setProtocol] = useState<RequestProtocol>('http')
  const [name, setName] = useState('')
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [url, setUrl] = useState('')
  const definitions = usePulseStore((state) => state.data.grpcDefinitions)
  const grpcMethods = definitions.flatMap((definition) =>
    definition.methods.map((rpc) => ({
      value: rpc.id,
      label: `${definition.name} · ${rpc.service}/${rpc.name} · ${rpc.type}`,
    })),
  )
  const [grpcMethodId, setGrpcMethodId] = useState(() => grpcMethods[0]?.value ?? '')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onCreate({ protocol, name: name.trim(), method, url: url.trim(), grpcMethodId })
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={`${modalBackdropClassName} z-[90]`} />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[91] w-[min(92vw,620px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-surface-raised text-ink shadow-panel focus:outline-none">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold">
                {t('workbench.newRequest')}
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-ink-muted">
                {t('workbench.newRequestHint')}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={t('common.close')}
                className="flex size-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={submit} className="space-y-5 p-5">
            <fieldset>
              <legend className="mb-2.5 text-xs font-semibold text-ink">
                {t('workbench.requestType')}
              </legend>
              <div
                className="grid gap-2 sm:grid-cols-2"
                role="radiogroup"
                aria-label={t('workbench.requestType')}
              >
                {requestKinds.map(({ protocol: kind, icon: Icon, labelKey, descriptionKey }) => {
                  const selected = protocol === kind
                  return (
                    <button
                      key={kind}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setProtocol(kind)}
                      className={cn(
                        'flex min-h-20 items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                        selected
                          ? 'border-accent bg-accent-soft shadow-[inset_0_0_0_1px_rgba(106,155,255,0.16)]'
                          : 'border-border bg-surface hover:border-border-strong hover:bg-surface-hover',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md',
                          kind === 'http'
                            ? 'bg-success-soft text-success'
                            : 'bg-info-soft text-info',
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-ink">
                          {t(`workbench.${labelKey}`)}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-muted">
                          {t(`workbench.${descriptionKey}`)}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <FieldShell label={t('common.name')} htmlFor={nameId}>
              <Input
                id={nameId}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('workbench.requestNamePlaceholder')}
                autoFocus
                required
              />
            </FieldShell>

            <FieldShell
              label={protocol === 'http' ? t('workbench.endpoint') : t('grpc.endpoint')}
              htmlFor={urlId}
            >
              <div className="flex overflow-hidden rounded-md border border-border-strong bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
                {protocol === 'http' ? (
                  <SelectMenu
                    id={methodId}
                    value={method}
                    onValueChange={(value) => setMethod(value as HttpMethod)}
                    label={t('workbench.method')}
                    className={cn(
                      'h-10 w-28 rounded-none border-y-0 border-l-0 border-r border-border bg-surface-sunken font-bold',
                      httpMethodTextClass(method),
                    )}
                    options={methods.map((value) => ({ value, label: value }))}
                  />
                ) : (
                  <span className="flex h-10 items-center border-r border-border bg-surface-sunken px-3 text-xs font-bold text-info">
                    gRPC
                  </span>
                )}
                <Input
                  id={urlId}
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder={
                    protocol === 'http'
                      ? 'https://api.example.com/v1/resource'
                      : 'grpc.example.com:443'
                  }
                  spellCheck={false}
                  className="h-10 min-w-0 flex-1 rounded-none border-0 bg-transparent font-mono text-xs focus:ring-0"
                />
              </div>
            </FieldShell>

            {protocol === 'grpc' ? (
              <FieldShell label={t('grpc.method')} htmlFor={methodId} hint={t('grpc.methodHint')}>
                <SelectMenu
                  id={methodId}
                  value={grpcMethodId}
                  onValueChange={setGrpcMethodId}
                  label={t('grpc.method')}
                  options={grpcMethods}
                  disabled={!grpcMethods.length}
                />
              </FieldShell>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Dialog.Close asChild>
                <Button type="button">{t('common.cancel')}</Button>
              </Dialog.Close>
              <Button type="submit" variant="primary" disabled={!name.trim()}>
                {t('common.create')}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
