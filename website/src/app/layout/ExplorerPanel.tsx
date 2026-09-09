import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  Library,
  Plus,
  RadioTower,
  Search,
  X,
} from 'lucide-react'
import { useId, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { ExplorerNodeMenu } from '@/app/layout/ExplorerNodeMenu'
import { NewRequestDialog, type NewRequestValues } from '@/components/request/NewRequestDialog'
import { Button } from '@/components/ui/Button'
import { modalBackdropClassName } from '@/components/ui/dialogStyles'
import { FieldShell, Input } from '@/components/ui/Field'
import { HttpMethodBadge } from '@/components/ui/HttpMethodBadge'
import { IconButton } from '@/components/ui/IconButton'
import { SelectMenu } from '@/components/ui/SelectMenu'
import { cn } from '@/lib/utils/cn'
import { usePulseStore } from '@/state/pulse-store'

type DraggedNode =
  | { kind: 'collection'; collectionId: string }
  | { kind: 'folder'; collectionId: string; folderId: string }
  | { kind: 'request'; requestId: string }

type DropTarget =
  | { kind: 'collection'; collectionId: string }
  | { kind: 'folder'; collectionId: string; folderId: string }

const ExplorerContent = ({ onClose }: { onClose?: () => void }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const data = usePulseStore((state) => state.data)
  const createRequest = usePulseStore((state) => state.createRequest)
  const updateRequest = usePulseStore((state) => state.updateRequest)
  const createCollection = usePulseStore((state) => state.createCollection)
  const createFolder = usePulseStore((state) => state.createFolder)
  const toggleCollection = usePulseStore((state) => state.toggleCollection)
  const toggleFolder = usePulseStore((state) => state.toggleFolder)
  const moveCollection = usePulseStore((state) => state.moveCollection)
  const moveFolder = usePulseStore((state) => state.moveFolder)
  const moveRequest = usePulseStore((state) => state.moveRequest)
  const [query, setQuery] = useState('')
  const [draggedNode, setDraggedNode] = useState<DraggedNode | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [createDialog, setCreateDialog] = useState<'collection' | 'folder' | null>(null)
  const [newRequestOpen, setNewRequestOpen] = useState(false)
  const [entityName, setEntityName] = useState('')
  const [parentCollectionId, setParentCollectionId] = useState(data.collections[0]?.id ?? '')
  const entityNameId = useId()
  const parentCollectionIdField = useId()

  const visibleRequests = useMemo(
    () =>
      data.requests.filter((request) => request.name.toLowerCase().includes(query.toLowerCase())),
    [data.requests, query],
  )
  const openRequest = (requestId: string, protocol: 'http' | 'grpc') => {
    navigate(
      protocol === 'grpc'
        ? `/w/${data.workspace.id}/grpc/${requestId}`
        : `/w/${data.workspace.id}/request/${requestId}`,
    )
    onClose?.()
  }
  const create = ({ protocol, name, method, url, grpcMethodId }: NewRequestValues) => {
    const id = createRequest(
      protocol,
      name || t(protocol === 'grpc' ? 'workbench.untitledGrpc' : 'workbench.untitledHttp'),
    )
    if (url || protocol === 'http' || grpcMethodId) {
      const grpcDefinition = data.grpcDefinitions.find((definition) =>
        definition.methods.some((entry) => entry.id === grpcMethodId),
      )
      const grpcMethod = grpcDefinition?.methods.find((entry) => entry.id === grpcMethodId)
      updateRequest(id, {
        method: protocol === 'http' ? method : 'POST',
        ...(url ? { url } : {}),
        ...(protocol === 'grpc' && grpcMethod && grpcDefinition
          ? {
              grpcDefinitionId: grpcDefinition.id,
              grpcMethodId: grpcMethod.id,
              grpcType: grpcMethod.type,
            }
          : {}),
      })
    }
    setNewRequestOpen(false)
    openRequest(id, protocol)
  }

  const openCreateDialog = (type: 'collection' | 'folder', collectionId?: string) => {
    setCreateDialog(type)
    setEntityName('')
    setParentCollectionId(collectionId ?? data.collections[0]?.id ?? '')
  }

  const submitEntity = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!entityName.trim() || !createDialog) return
    if (createDialog === 'collection') createCollection(entityName)
    else createFolder(parentCollectionId, entityName)
    setCreateDialog(null)
  }

  const reorderCollection = (targetCollectionId: string) => {
    if (!draggedNode || draggedNode.kind !== 'collection') return
    const fromIndex = data.collections.findIndex(
      (collection) => collection.id === draggedNode.collectionId,
    )
    const toIndex = data.collections.findIndex((collection) => collection.id === targetCollectionId)
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return
    const direction = fromIndex < toIndex ? 1 : -1
    Array.from({ length: Math.abs(toIndex - fromIndex) }).forEach(() =>
      moveCollection(draggedNode.collectionId, direction),
    )
  }

  const reorderFolder = (collectionId: string, targetFolderId: string) => {
    if (!draggedNode || draggedNode.kind !== 'folder' || draggedNode.collectionId !== collectionId)
      return
    const folders =
      data.collections.find((collection) => collection.id === collectionId)?.folders ?? []
    const fromIndex = folders.findIndex((folder) => folder.id === draggedNode.folderId)
    const toIndex = folders.findIndex((folder) => folder.id === targetFolderId)
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return
    const direction = fromIndex < toIndex ? 1 : -1
    Array.from({ length: Math.abs(toIndex - fromIndex) }).forEach(() =>
      moveFolder(collectionId, draggedNode.folderId, direction),
    )
  }

  const clearDragState = () => {
    setDraggedNode(null)
    setDropTarget(null)
  }

  const isActiveDropTarget = (target: DropTarget) =>
    dropTarget?.kind === target.kind &&
    dropTarget.collectionId === target.collectionId &&
    (target.kind === 'collection' ||
      (dropTarget.kind === 'folder' && dropTarget.folderId === target.folderId))

  const moveDraggedRequest = (collectionId: string, folderId: string) => {
    if (draggedNode?.kind !== 'request') return false
    const request = data.requests.find((entry) => entry.id === draggedNode.requestId)
    if (!request || (request.collectionId === collectionId && request.folderId === folderId))
      return false
    moveRequest(request.id, collectionId, folderId)
    return true
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">
          {t('nav.workspace')}
        </span>
        <div className="flex items-center gap-0.5">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <IconButton
                label={t('workbench.newRequest')}
                icon={<Plus className="size-3.5" />}
                className="size-7 max-md:size-10"
              />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                className="z-[80] min-w-44 rounded-md border border-border bg-surface-raised p-1 text-xs text-ink shadow-panel"
              >
                <DropdownMenu.Item
                  onSelect={() => setNewRequestOpen(true)}
                  className="flex cursor-default items-center gap-2 rounded px-2 py-2 outline-none data-[highlighted]:bg-surface-hover"
                >
                  <Plus className="size-3.5 text-accent" />
                  {t('workbench.newRequest')}
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="mx-1 my-1 h-px bg-border" />
                <DropdownMenu.Item
                  onSelect={() => openCreateDialog('collection')}
                  className="flex cursor-default items-center gap-2 rounded px-2 py-2 outline-none data-[highlighted]:bg-surface-hover"
                >
                  <Library className="size-3.5 text-ink-muted" />
                  {t('workbench.newCollection')}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => openCreateDialog('folder')}
                  className="flex cursor-default items-center gap-2 rounded px-2 py-2 outline-none data-[highlighted]:bg-surface-hover"
                >
                  <FolderPlus className="size-3.5 text-ink-muted" />
                  {t('workbench.newFolder')}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          {onClose ? (
            <IconButton
              label={t('common.close')}
              icon={<X className="size-4" />}
              className="size-8"
              onClick={onClose}
            />
          ) : null}
        </div>
      </div>
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle"
            aria-hidden="true"
          />
          <Input
            id="explorer-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={t('common.search')}
            placeholder={t('common.search')}
            className="h-8 bg-surface-sunken pl-8 text-xs max-md:h-10"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {visibleRequests.length === 0 ? (
          <div
            role="status"
            className="mx-1 mt-2 flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-sunken/50 p-4 text-center"
          >
            <Search className="mb-2 size-5 text-ink-subtle" aria-hidden="true" />
            <p className="text-xs font-semibold text-ink">
              {t(query ? 'workbench.noMatchingRequests' : 'workbench.noRequestsYet')}
            </p>
            {query ? (
              <Button size="sm" variant="ghost" className="mt-2" onClick={() => setQuery('')}>
                {t('common.clear')}
              </Button>
            ) : null}
          </div>
        ) : null}
        {data.collections.map((collection) => {
          const collectionRequests = visibleRequests.filter(
            (request) => request.collectionId === collection.id,
          )
          if (query && collectionRequests.length === 0) return null
          return (
            <div key={collection.id} className="mb-1">
              <div
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move'
                  setDraggedNode({ kind: 'collection', collectionId: collection.id })
                }}
                onDragEnd={clearDragState}
                onDragOver={(event) => {
                  if (!draggedNode) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  setDropTarget({ kind: 'collection', collectionId: collection.id })
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node))
                    setDropTarget(null)
                }}
                onDrop={() => {
                  if (draggedNode?.kind === 'request') {
                    const destination = collection.folders[0]
                    if (destination && moveDraggedRequest(collection.id, destination.id)) {
                      if (collection.collapsed) toggleCollection(collection.id)
                    }
                  } else {
                    reorderCollection(collection.id)
                  }
                  clearDragState()
                }}
                className={cn(
                  'group flex items-center rounded-md transition-[background-color,box-shadow] hover:bg-surface-hover focus-within:bg-surface-hover',
                  draggedNode?.kind === 'collection' &&
                    draggedNode.collectionId === collection.id &&
                    'opacity-50',
                  isActiveDropTarget({ kind: 'collection', collectionId: collection.id }) &&
                    'bg-accent-soft ring-1 ring-inset ring-accent/55',
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleCollection(collection.id)}
                  className="density-row flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 text-left text-xs font-semibold text-ink"
                >
                  {collection.collapsed ? (
                    <ChevronRight className="size-3.5 shrink-0 text-ink-subtle" />
                  ) : (
                    <ChevronDown className="size-3.5 shrink-0 text-ink-subtle" />
                  )}
                  {collection.collapsed ? (
                    <Folder className="size-3.5 shrink-0 text-ink-muted" />
                  ) : (
                    <FolderOpen className="size-3.5 shrink-0 text-ink-muted" />
                  )}
                  <span className="truncate">{collection.name}</span>
                </button>
                <ExplorerNodeMenu
                  collection={collection}
                  onCreateFolder={(collectionId) => openCreateDialog('folder', collectionId)}
                />
              </div>
              {!collection.collapsed ? (
                <div className="ml-3 border-l border-border pl-1.5">
                  {collection.folders.map((folder) => {
                    const folderRequests = collectionRequests.filter(
                      (request) => request.folderId === folder.id,
                    )
                    if (query && folderRequests.length === 0) return null
                    return (
                      <div key={folder.id}>
                        <div
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'move'
                            setDraggedNode({
                              kind: 'folder',
                              collectionId: collection.id,
                              folderId: folder.id,
                            })
                          }}
                          onDragEnd={clearDragState}
                          onDragOver={(event) => {
                            if (!draggedNode) return
                            event.preventDefault()
                            event.dataTransfer.dropEffect = 'move'
                            setDropTarget({
                              kind: 'folder',
                              collectionId: collection.id,
                              folderId: folder.id,
                            })
                          }}
                          onDragLeave={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                              setDropTarget(null)
                            }
                          }}
                          onDrop={() => {
                            if (draggedNode?.kind === 'request') {
                              if (
                                moveDraggedRequest(collection.id, folder.id) &&
                                folder.collapsed
                              ) {
                                toggleFolder(collection.id, folder.id)
                              }
                            } else {
                              reorderFolder(collection.id, folder.id)
                            }
                            clearDragState()
                          }}
                          className={cn(
                            'group flex items-center rounded-md transition-[background-color,box-shadow] hover:bg-surface-hover focus-within:bg-surface-hover',
                            draggedNode?.kind === 'folder' &&
                              draggedNode.folderId === folder.id &&
                              'opacity-50',
                            isActiveDropTarget({
                              kind: 'folder',
                              collectionId: collection.id,
                              folderId: folder.id,
                            }) && 'bg-accent-soft ring-1 ring-inset ring-accent/55',
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => toggleFolder(collection.id, folder.id)}
                            className="density-row flex min-w-0 flex-1 items-center gap-1.5 px-2 text-left text-[11px] font-medium text-ink-subtle"
                          >
                            {folder.collapsed ? (
                              <ChevronRight className="size-3 shrink-0" />
                            ) : (
                              <ChevronDown className="size-3 shrink-0" />
                            )}
                            {folder.collapsed ? (
                              <Folder className="size-3 shrink-0" />
                            ) : (
                              <FolderOpen className="size-3 shrink-0" />
                            )}
                            <span className="truncate">{folder.name}</span>
                          </button>
                          <ExplorerNodeMenu
                            collection={collection}
                            folder={folder}
                            onCreateFolder={(collectionId) =>
                              openCreateDialog('folder', collectionId)
                            }
                          />
                        </div>
                        {!folder.collapsed
                          ? folderRequests.map((request) => (
                              <button
                                key={request.id}
                                type="button"
                                draggable
                                onDragStart={(event) => {
                                  event.dataTransfer.effectAllowed = 'move'
                                  setDraggedNode({ kind: 'request', requestId: request.id })
                                }}
                                onDragEnd={clearDragState}
                                onClick={() => openRequest(request.id, request.protocol)}
                                className={cn(
                                  'density-row flex w-full cursor-grab items-center gap-1.5 rounded-md px-2 text-left text-xs text-ink-muted transition-[background-color,opacity] hover:bg-surface-hover hover:text-ink active:cursor-grabbing',
                                  request.id === data.activeRequestId &&
                                    'bg-accent-soft text-accent',
                                  draggedNode?.kind === 'request' &&
                                    draggedNode.requestId === request.id &&
                                    'opacity-45',
                                )}
                              >
                                {request.protocol === 'grpc' ? (
                                  <RadioTower className="size-3.5 shrink-0" />
                                ) : (
                                  <HttpMethodBadge
                                    method={request.method}
                                    className="shrink-0 px-1.5 text-[9px]"
                                  />
                                )}
                                {request.protocol === 'grpc' ? (
                                  <span className="w-10 shrink-0 text-[9px] font-extrabold">
                                    RPC
                                  </span>
                                ) : null}
                                <span className="truncate">{request.name}</span>
                                {request.dirty ? (
                                  <span
                                    className="ml-auto size-1.5 rounded-full bg-warning"
                                    aria-label={t('workbench.requestDirty')}
                                  />
                                ) : null}
                              </button>
                            ))
                          : null}
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      <Dialog.Root
        open={createDialog !== null}
        onOpenChange={(open) => {
          if (!open) setCreateDialog(null)
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={`${modalBackdropClassName} z-[90]`} />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[91] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface-raised p-5 text-ink shadow-panel focus:outline-none">
            <Dialog.Title className="text-sm font-semibold">
              {t(createDialog === 'collection' ? 'workbench.newCollection' : 'workbench.newFolder')}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-ink-muted">
              {t('workbench.organizeHint')}
            </Dialog.Description>
            <form onSubmit={submitEntity} className="mt-5 grid gap-4">
              {createDialog === 'folder' ? (
                <FieldShell label={t('workbench.collection')} htmlFor={parentCollectionIdField}>
                  <SelectMenu
                    id={parentCollectionIdField}
                    value={parentCollectionId}
                    onValueChange={setParentCollectionId}
                    label={t('workbench.collection')}
                    options={data.collections.map((collection) => ({
                      value: collection.id,
                      label: collection.name,
                    }))}
                  />
                </FieldShell>
              ) : null}
              <FieldShell label={t('common.name')} htmlFor={entityNameId}>
                <Input
                  id={entityNameId}
                  value={entityName}
                  onChange={(event) => setEntityName(event.target.value)}
                  autoFocus
                  required
                />
              </FieldShell>
              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button type="button">{t('common.cancel')}</Button>
                </Dialog.Close>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={
                    !entityName.trim() || (createDialog === 'folder' && !parentCollectionId)
                  }
                >
                  {t('common.create')}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {newRequestOpen ? (
        <NewRequestDialog open onOpenChange={setNewRequestOpen} onCreate={create} />
      ) : null}
    </div>
  )
}

export const ExplorerPanel = () => {
  const { t } = useTranslation()
  const explorerOpen = usePulseStore((state) => state.explorerOpen)
  const setExplorerOpen = usePulseStore((state) => state.setExplorerOpen)
  return (
    <>
      <aside
        className="desktop-explorer hidden min-h-0 w-[var(--explorer-width)] shrink-0 border-r border-border md:block"
        aria-label={t('nav.explorer')}
      >
        <ExplorerContent />
      </aside>
      <Dialog.Root open={explorerOpen} onOpenChange={setExplorerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay
            className={`${modalBackdropClassName} z-50 data-[state=open]:animate-in`}
          />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-[min(88vw,340px)] border-r border-border bg-surface shadow-panel focus:outline-none"
          >
            <Dialog.Title className="sr-only">{t('nav.explorer')}</Dialog.Title>
            <ExplorerContent onClose={() => setExplorerOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
