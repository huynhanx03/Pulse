import * as AlertDialog from '@radix-ui/react-alert-dialog'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { FolderPlus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { FieldShell, Input } from '@/components/ui/Field'
import { IconButton } from '@/components/ui/IconButton'
import type { CollectionNode, FolderNode } from '@/domain/types'
import { modalBackdropClassName } from '@/components/ui/dialogStyles'
import { cn } from '@/lib/utils/cn'
import { usePulseStore } from '@/state/pulse-store'

const itemClassName =
  'flex min-h-9 cursor-default select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-xs outline-none data-[highlighted]:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-40 max-md:min-h-11'
const dialogClassName =
  'fixed left-1/2 top-1/2 z-[91] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface-raised p-5 text-ink shadow-panel focus:outline-none'
const overlayClassName = `${modalBackdropClassName} z-[90]`

interface ExplorerNodeMenuProps {
  collection: CollectionNode
  folder?: FolderNode
  onCreateFolder(collectionId: string): void
}

export const ExplorerNodeMenu = ({ collection, folder, onCreateFolder }: ExplorerNodeMenuProps) => {
  const { t } = useTranslation()
  const nameId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const afterClose = useRef<(() => void) | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null)
  const [name, setName] = useState(folder?.name ?? collection.name)
  const collections = usePulseStore((state) => state.data.collections)
  const renameCollection = usePulseStore((state) => state.renameCollection)
  const deleteCollection = usePulseStore((state) => state.deleteCollection)
  const renameFolder = usePulseStore((state) => state.renameFolder)
  const deleteFolder = usePulseStore((state) => state.deleteFolder)
  const entityName = folder?.name ?? collection.name
  const canDelete = folder ? collection.folders.length > 1 : collections.length > 1

  const rename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) return
    if (folder) renameFolder(collection.id, folder.id, nextName)
    else renameCollection(collection.id, nextName)
    setDialog(null)
  }

  const remove = () => {
    if (folder) deleteFolder(collection.id, folder.id)
    else deleteCollection(collection.id)
    setDialog(null)
  }

  const restoreFocus = (event: Event) => {
    event.preventDefault()
    triggerRef.current?.focus()
  }

  return (
    <>
      <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenu.Trigger asChild>
          <IconButton
            ref={triggerRef}
            label={t('common.moreActions')}
            icon={<MoreHorizontal className="size-3.5" aria-hidden="true" />}
            className="size-7 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100 max-md:size-10 max-md:opacity-100"
          />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            collisionPadding={12}
            className="z-[90] w-52 rounded-lg border border-border bg-surface-raised p-1 text-ink shadow-panel"
            onCloseAutoFocus={() => {
              const action = afterClose.current
              afterClose.current = null
              if (action) queueMicrotask(action)
            }}
          >
            <DropdownMenu.Label className="truncate px-2.5 py-1.5 text-[10px] font-semibold text-ink-subtle">
              {entityName}
            </DropdownMenu.Label>
            <DropdownMenu.Separator className="mx-1 mb-1 h-px bg-border" />
            {!folder ? (
              <DropdownMenu.Item
                className={itemClassName}
                onSelect={() => {
                  afterClose.current = () => onCreateFolder(collection.id)
                }}
              >
                <FolderPlus className="size-3.5 text-ink-subtle" aria-hidden="true" />
                {t('workbench.newFolder')}
              </DropdownMenu.Item>
            ) : null}
            <DropdownMenu.Item
              className={itemClassName}
              onSelect={() => {
                setName(entityName)
                afterClose.current = () => setDialog('rename')
              }}
            >
              <Pencil className="size-3.5 text-ink-subtle" aria-hidden="true" />
              {t('common.edit')}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              disabled={!canDelete}
              className={cn(itemClassName, 'text-danger data-[highlighted]:bg-danger-soft')}
              onSelect={() => {
                afterClose.current = () => setDialog('delete')
              }}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              {t('common.delete')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Dialog.Root open={dialog === 'rename'} onOpenChange={(open) => !open && setDialog(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className={overlayClassName} />
          <Dialog.Content className={dialogClassName} onCloseAutoFocus={restoreFocus}>
            <Dialog.Title className="text-sm font-semibold">
              {t(folder ? 'workbench.renameFolder' : 'workbench.renameCollection')}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-ink-muted">
              {entityName}
            </Dialog.Description>
            <form onSubmit={rename} className="mt-5">
              <FieldShell label={t('common.name')} htmlFor={nameId}>
                <Input
                  id={nameId}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoFocus
                  required
                />
              </FieldShell>
              <div className="mt-5 flex justify-end gap-2">
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
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className={overlayClassName} />
          <AlertDialog.Content className={dialogClassName} onCloseAutoFocus={restoreFocus}>
            <AlertDialog.Title className="text-sm font-semibold">
              {t(folder ? 'workbench.deleteFolder' : 'workbench.deleteCollection')}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-xs leading-relaxed text-ink-muted">
              {t(folder ? 'workbench.deleteFolderWarning' : 'workbench.deleteCollectionWarning', {
                name: entityName,
              })}
            </AlertDialog.Description>
            <div className="mt-5 flex justify-end gap-2">
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
