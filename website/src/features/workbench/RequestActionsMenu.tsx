import * as AlertDialog from '@radix-ui/react-alert-dialog'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Circle,
  Code2,
  Copy,
  FileInput,
  FolderInput,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from 'lucide-react'
import { useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { modalBackdropClassName } from '@/components/ui/dialogStyles'
import { FieldShell, Input } from '@/components/ui/Field'
import { IconButton } from '@/components/ui/IconButton'
import type { ApiRequest } from '@/domain/types'
import { usePulseStore } from '@/state/pulse-store'
import { cn } from '@/lib/utils/cn'

interface RequestActionsMenuProps {
  request: ApiRequest
  onImport?: () => void
  onGenerateCode?: () => void
}

const itemClassName =
  'flex min-h-9 cursor-default select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-xs outline-none transition-colors data-[highlighted]:bg-surface-hover max-md:min-h-11 motion-reduce:transition-none'
const dialogClassName =
  'fixed left-1/2 top-1/2 z-[81] max-h-[calc(100dvh-2rem)] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-surface-raised p-5 text-ink shadow-panel focus:outline-none'
const overlayClassName = `${modalBackdropClassName} z-[80]`

export const RequestActionsMenu = ({
  request,
  onImport,
  onGenerateCode,
}: RequestActionsMenuProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const nameId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const afterMenuClose = useRef<(() => void) | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null)
  const [name, setName] = useState(request.name)
  const pinned = usePulseStore((state) =>
    state.data.openTabs.some((tab) => tab.requestId === request.id && tab.pinned),
  )
  const collections = usePulseStore((state) => state.data.collections)
  const updateRequest = usePulseStore((state) => state.updateRequest)
  const saveRequest = usePulseStore((state) => state.saveRequest)
  const duplicateRequest = usePulseStore((state) => state.duplicateRequest)
  const deleteRequest = usePulseStore((state) => state.deleteRequest)
  const moveRequest = usePulseStore((state) => state.moveRequest)
  const pinTab = usePulseStore((state) => state.pinTab)

  const restoreFocus = (event: Event) => {
    event.preventDefault()
    const target = triggerRef.current ?? document.getElementById('main-content')
    target?.focus()
  }

  const rename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return
    updateRequest(request.id, { name: trimmedName })
    saveRequest(request.id)
    setDialog(null)
  }

  const duplicate = () => {
    const id = duplicateRequest(request.id, t('workbench.copyName', { name: request.name }))
    if (!id) return
    const { data } = usePulseStore.getState()
    const copy = data.requests.find((entry) => entry.id === id)
    if (copy)
      navigate(`/w/${data.workspace.id}/${copy.protocol === 'grpc' ? 'grpc' : 'request'}/${id}`)
  }

  const remove = () => {
    deleteRequest(request.id)
    setDialog(null)
    const { data } = usePulseStore.getState()
    const activeRequest = data.requests.find((entry) => entry.id === data.activeRequestId)
    navigate(
      activeRequest
        ? `/w/${data.workspace.id}/${activeRequest.protocol === 'grpc' ? 'grpc' : 'request'}/${activeRequest.id}`
        : '/',
    )
  }

  return (
    <>
      <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenu.Trigger asChild>
          <IconButton
            ref={triggerRef}
            label={t('common.moreActions')}
            active={menuOpen}
            icon={<MoreHorizontal className="size-4" aria-hidden="true" />}
          />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            collisionPadding={12}
            aria-label={t('common.moreActions')}
            className="z-[80] max-h-[var(--radix-dropdown-menu-content-available-height)] w-56 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-lg border border-border bg-surface-raised p-1 text-ink shadow-panel"
            onCloseAutoFocus={() => {
              const action = afterMenuClose.current
              afterMenuClose.current = null
              // Restore the trigger first so the next dialog can return focus to it.
              if (action) queueMicrotask(action)
            }}
          >
            <DropdownMenu.Label className="px-2.5 pb-2 pt-1.5">
              <span className="block truncate text-[11px] font-semibold text-ink-muted">
                {request.name}
              </span>
              {request.dirty ? (
                <span className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-warning">
                  <Circle className="size-1.5 fill-current" aria-hidden="true" />
                  {t('workbench.requestDirty')}
                </span>
              ) : null}
            </DropdownMenu.Label>
            <DropdownMenu.Separator className="mx-1 mb-1 h-px bg-border" />
            <DropdownMenu.Item
              className={itemClassName}
              onSelect={() => {
                setName(request.name)
                afterMenuClose.current = () => setDialog('rename')
              }}
            >
              <Pencil className="size-3.5 text-ink-subtle" aria-hidden="true" />
              {t('common.edit')}
            </DropdownMenu.Item>
            <DropdownMenu.Item className={itemClassName} onSelect={duplicate}>
              <Copy className="size-3.5 text-ink-subtle" aria-hidden="true" />
              {t('common.duplicate')}
            </DropdownMenu.Item>
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className={itemClassName}>
                <FolderInput className="size-3.5 text-ink-subtle" aria-hidden="true" />
                {t('workbench.moveTo')}
                <span className="ml-auto text-ink-subtle">›</span>
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent
                  sideOffset={4}
                  collisionPadding={12}
                  className="z-[81] max-h-[var(--radix-dropdown-menu-content-available-height)] w-56 overflow-y-auto rounded-lg border border-border bg-surface-raised p-1 text-ink shadow-panel"
                >
                  {collections.flatMap((collection) => [
                    <DropdownMenu.Label
                      key={`${collection.id}-label`}
                      className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-ink-subtle"
                    >
                      {collection.name}
                    </DropdownMenu.Label>,
                    ...collection.folders.map((folder) => {
                      const current =
                        request.collectionId === collection.id && request.folderId === folder.id
                      return (
                        <DropdownMenu.Item
                          key={folder.id}
                          disabled={current}
                          className={itemClassName}
                          onSelect={() => moveRequest(request.id, collection.id, folder.id)}
                        >
                          <span className="truncate">{folder.name}</span>
                          {current ? (
                            <span className="ml-auto text-[10px] text-accent">
                              {t('common.current')}
                            </span>
                          ) : null}
                        </DropdownMenu.Item>
                      )
                    }),
                  ])}
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>
            <DropdownMenu.Item className={itemClassName} onSelect={() => pinTab(request.id)}>
              {pinned ? (
                <PinOff className="size-3.5 text-ink-subtle" aria-hidden="true" />
              ) : (
                <Pin className="size-3.5 text-ink-subtle" aria-hidden="true" />
              )}
              {t(pinned ? 'workbench.unpinTab' : 'workbench.pinTab')}
            </DropdownMenu.Item>
            {onImport || onGenerateCode ? (
              <DropdownMenu.Separator className="mx-1 my-1 h-px bg-border" />
            ) : null}
            {onImport ? (
              <DropdownMenu.Item
                className={itemClassName}
                onSelect={() => {
                  afterMenuClose.current = onImport
                }}
              >
                <FileInput className="size-3.5 text-ink-subtle" aria-hidden="true" />
                {t('workbench.importCurl')}
              </DropdownMenu.Item>
            ) : null}
            {onGenerateCode ? (
              <DropdownMenu.Item
                className={itemClassName}
                onSelect={() => {
                  afterMenuClose.current = onGenerateCode
                }}
              >
                <Code2 className="size-3.5 text-ink-subtle" aria-hidden="true" />
                {t('workbench.generateCode')}
              </DropdownMenu.Item>
            ) : null}
            <DropdownMenu.Separator className="mx-1 my-1 h-px bg-border" />
            <DropdownMenu.Item
              className={cn(itemClassName, 'text-danger data-[highlighted]:bg-danger-soft')}
              onSelect={() => {
                afterMenuClose.current = () => setDialog('delete')
              }}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              {t('common.delete')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Dialog.Root
        open={dialog === 'rename'}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={overlayClassName} />
          <Dialog.Content className={dialogClassName} onCloseAutoFocus={restoreFocus}>
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Pencil className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <Dialog.Title className="text-sm font-semibold">{t('common.edit')}</Dialog.Title>
                <Dialog.Description className="mt-1 truncate text-xs text-ink-muted">
                  {request.name}
                </Dialog.Description>
              </div>
            </div>
            <form onSubmit={rename} className="mt-5">
              <FieldShell htmlFor={nameId} label={t('common.name')}>
                <Input
                  id={nameId}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="off"
                  required
                />
              </FieldShell>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Dialog.Close asChild>
                  <Button type="button">{t('common.cancel')}</Button>
                </Dialog.Close>
                <Button type="submit" variant="primary" disabled={!name.trim()}>
                  {t('common.save')}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <AlertDialog.Root
        open={dialog === 'delete'}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className={overlayClassName} />
          <AlertDialog.Content className={dialogClassName} onCloseAutoFocus={restoreFocus}>
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-danger">
                <Trash2 className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <AlertDialog.Title className="text-sm font-semibold">
                  {t('common.delete')}
                </AlertDialog.Title>
                <AlertDialog.Description className="mt-2 break-words text-xs leading-relaxed text-ink-muted">
                  {t('workbench.deleteWarning', { name: request.name })}
                </AlertDialog.Description>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button type="button">{t('common.cancel')}</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button type="button" variant="danger" onClick={remove}>
                  {t('common.delete')}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  )
}
