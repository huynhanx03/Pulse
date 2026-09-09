import * as Dialog from '@radix-ui/react-dialog'
import {
  Command as CommandRoot,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from 'cmdk'
import {
  Braces,
  Database,
  FlaskConical,
  Clock3,
  Languages,
  Moon,
  RadioTower,
  Variable,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/Badge'
import { HttpMethodBadge } from '@/components/ui/HttpMethodBadge'
import { modalBackdropClassName } from '@/components/ui/dialogStyles'
import { usePulseStore } from '@/state/pulse-store'

export const CommandPalette = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const open = usePulseStore((state) => state.commandOpen)
  const setOpen = usePulseStore((state) => state.setCommandOpen)
  const data = usePulseStore((state) => state.data)
  const preferences = usePulseStore((state) => state.preferences)
  const setTheme = usePulseStore((state) => state.setTheme)
  const setLocale = usePulseStore((state) => state.setLocale)
  const createRequest = usePulseStore((state) => state.createRequest)

  const go = (path: string) => {
    navigate(path)
    setOpen(false)
  }
  const pages: Array<{ key: string; path: string; icon: LucideIcon }> = [
    { key: 'nav.http', path: `/w/${data.workspace.id}/request/req-login`, icon: Braces },
    { key: 'nav.grpc', path: `/w/${data.workspace.id}/grpc/req-grpc-profile`, icon: RadioTower },
    { key: 'nav.runner', path: `/w/${data.workspace.id}/runner`, icon: FlaskConical },
    { key: 'nav.variables', path: `/w/${data.workspace.id}/variables`, icon: Variable },
    { key: 'nav.datasets', path: `/w/${data.workspace.id}/datasets`, icon: Database },
    { key: 'nav.automations', path: `/w/${data.workspace.id}/automations`, icon: Clock3 },
  ]
  const create = (protocol: 'http' | 'grpc') => {
    const id = createRequest(
      protocol,
      protocol === 'grpc' ? t('workbench.untitledGrpc') : t('workbench.untitledHttp'),
    )
    go(
      protocol === 'grpc'
        ? `/w/${data.workspace.id}/grpc/${id}`
        : `/w/${data.workspace.id}/request/${id}`,
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className={`${modalBackdropClassName} z-[70]`} />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[14vh] z-[71] w-[min(92vw,620px)] -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface-raised shadow-panel focus:outline-none"
        >
          <Dialog.Title className="sr-only">{t('command.title')}</Dialog.Title>
          <CommandRoot label={t('command.title')} className="text-ink">
            <CommandInput
              autoFocus
              placeholder={t('command.placeholder')}
              className="h-12 w-full border-b border-border bg-transparent px-4 text-sm outline-none placeholder:text-ink-subtle"
            />
            <CommandList className="max-h-[430px] overflow-y-auto p-2">
              <CommandEmpty className="p-8 text-center text-xs text-ink-muted">
                {t('command.noResults')}
              </CommandEmpty>
              <CommandGroup
                heading={t('command.pages')}
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-ink-subtle"
              >
                {pages.map(({ key, path, icon: Icon }) => (
                  <CommandItem
                    key={key}
                    onSelect={() => go(path)}
                    className="flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-xs data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent"
                  >
                    <Icon className="size-4" />
                    {t(key)}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator className="my-1 h-px bg-border" />
              <CommandGroup
                heading={t('command.requests')}
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-ink-subtle"
              >
                {data.requests.map((request) => (
                  <CommandItem
                    key={request.id}
                    value={`${request.name} ${request.method}`}
                    onSelect={() => {
                      go(
                        request.protocol === 'grpc'
                          ? `/w/${data.workspace.id}/grpc/${request.id}`
                          : `/w/${data.workspace.id}/request/${request.id}`,
                      )
                    }}
                    className="flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-xs data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent"
                  >
                    {request.protocol === 'grpc' ? (
                      <Badge tone="info" className="min-w-10 justify-center px-1.5 text-[9px]">
                        RPC
                      </Badge>
                    ) : (
                      <HttpMethodBadge method={request.method} className="px-1.5 text-[9px]" />
                    )}
                    <span>{request.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator className="my-1 h-px bg-border" />
              <CommandGroup
                heading={t('command.actions')}
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-ink-subtle"
              >
                <CommandItem
                  onSelect={() => create('http')}
                  className="flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-xs data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent"
                >
                  <Braces className="size-4" />
                  {t('workbench.newHttp')}
                </CommandItem>
                <CommandItem
                  onSelect={() => create('grpc')}
                  className="flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-xs data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent"
                >
                  <RadioTower className="size-4" />
                  {t('workbench.newGrpc')}
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    setTheme(preferences.theme === 'dark' ? 'light' : 'dark')
                    setOpen(false)
                  }}
                  className="flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-xs data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent"
                >
                  <Moon className="size-4" />
                  {t('command.switchTheme')}
                  <span className="ml-auto text-[10px] text-ink-subtle">T</span>
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    setLocale(preferences.locale === 'vi' ? 'en' : 'vi')
                    setOpen(false)
                  }}
                  className="flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-xs data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent"
                >
                  <Languages className="size-4" />
                  {t('command.switchLanguage')}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </CommandRoot>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
