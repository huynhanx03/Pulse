import * as AlertDialog from '@radix-ui/react-alert-dialog'
import * as Dialog from '@radix-ui/react-dialog'
import { Eye, EyeOff, KeyRound, Layers3, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { modalBackdropClassName } from '@/components/ui/dialogStyles'
import { EnvironmentMarker } from '@/components/environment/EnvironmentMarker'
import { FieldShell, Input } from '@/components/ui/Field'
import { IconButton } from '@/components/ui/IconButton'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { SelectMenu } from '@/components/ui/SelectMenu'
import { Switch } from '@/components/ui/Switch'
import { EditorHeader, EditorToolbar, MasterDetailShell } from '@/components/layout/MasterDetail'
import type { EnvironmentVariable } from '@/domain/types'
import { cn } from '@/lib/utils/cn'
import { maskSecret } from '@/lib/utils/secret'
import { usePulseStore } from '@/state/pulse-store'

const EMPTY_ENVIRONMENT_SOURCE = '__empty__'

const VariablesPage = () => {
  const { t } = useTranslation()
  const data = usePulseStore((state) => state.data)
  const createEnvironment = usePulseStore((state) => state.createEnvironment)
  const duplicateEnvironment = usePulseStore((state) => state.duplicateEnvironment)
  const updateEnvironment = usePulseStore((state) => state.updateEnvironment)
  const deleteEnvironment = usePulseStore((state) => state.deleteEnvironment)
  const replaceEnvironmentVariables = usePulseStore((state) => state.replaceEnvironmentVariables)
  const activeEnvironment =
    data.environments.find((environment) => environment.id === data.activeEnvironmentId) ??
    data.environments[0]
  const [editingEnvironmentId, setEditingEnvironmentId] = useState(data.activeEnvironmentId)
  const [environmentQuery, setEnvironmentQuery] = useState('')
  const [variableQuery, setVariableQuery] = useState('')
  const [drafts, setDrafts] = useState<Record<string, EnvironmentVariable[]>>({})
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [cloneSourceId, setCloneSourceId] = useState(EMPTY_ENVIRONMENT_SOURCE)
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const environment =
    data.environments.find((item) => item.id === editingEnvironmentId) ?? activeEnvironment
  const draftKey = environment ? `${data.workspace.id}:${environment.id}` : ''

  const environments = useMemo(
    () =>
      data.environments.filter((item) =>
        item.name.toLocaleLowerCase().includes(environmentQuery.toLocaleLowerCase()),
      ),
    [data.environments, environmentQuery],
  )
  const draftVariables = drafts[draftKey] ?? environment?.variables ?? []
  const variables = draftVariables.filter((item) =>
    `${item.key} ${item.description}`
      .toLocaleLowerCase()
      .includes(variableQuery.toLocaleLowerCase()),
  )

  if (!environment) return null

  const dirty = JSON.stringify(draftVariables) !== JSON.stringify(environment.variables)
  const patchDraftVariable = (id: string, patch: Partial<EnvironmentVariable>) =>
    setDrafts((current) => ({
      ...current,
      [draftKey]: draftVariables.map((variable) =>
        variable.id === id ? { ...variable, ...patch } : variable,
      ),
    }))
  const addDraftVariable = () =>
    setDrafts((current) => ({
      ...current,
      [draftKey]: [
        ...draftVariables,
        {
          id: `var-${crypto.randomUUID()}`,
          key: '',
          value: '',
          enabled: true,
          secret: false,
          description: '',
        },
      ],
    }))
  const removeDraftVariable = (id: string) =>
    setDrafts((current) => ({
      ...current,
      [draftKey]: draftVariables.filter((variable) => variable.id !== id),
    }))
  const saveVariables = () => {
    replaceEnvironmentVariables(environment.id, draftVariables)
    setDrafts((current) => {
      const { [draftKey]: _, ...rest } = current
      return rest
    })
  }
  const resetVariables = () =>
    setDrafts((current) => {
      const { [draftKey]: _, ...rest } = current
      return rest
    })
  const hasUnsavedDraft = (item: (typeof data.environments)[number]) => {
    const itemDraft = drafts[`${data.workspace.id}:${item.id}`]
    return itemDraft !== undefined && JSON.stringify(itemDraft) !== JSON.stringify(item.variables)
  }

  const create = () => {
    const id =
      cloneSourceId !== EMPTY_ENVIRONMENT_SOURCE
        ? duplicateEnvironment(cloneSourceId, newName)
        : createEnvironment(newName)
    if (!id) return
    setEditingEnvironmentId(id)
    setNewName('')
    setCloneSourceId(EMPTY_ENVIRONMENT_SOURCE)
    setCreateOpen(false)
  }
  const saveName = () => {
    updateEnvironment(environment.id, { name: nameDraft.trim() || environment.name })
    setRenaming(false)
  }
  const toggleReveal = (id: string) =>
    setRevealed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-canvas">
      <SectionHeading
        eyebrow={t('variables.eyebrow')}
        title={t('variables.title')}
        description={t('variables.subtitle')}
        actions={
          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() => setCreateOpen(true)}
          >
            {t('variables.createEnvironment')}
          </Button>
        }
      />

      <MasterDetailShell>
        <aside className="flex min-h-0 flex-col border-b border-border bg-surface lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-4 pb-3 pt-4">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-subtle">
              {t('variables.environmentList')}
            </h2>
            <span className="text-[11px] font-medium text-ink-subtle">
              {data.environments.length}
            </span>
            <Dialog.Root
              open={createOpen}
              onOpenChange={(open) => {
                setCreateOpen(open)
                if (!open) {
                  setNewName('')
                  setCloneSourceId(EMPTY_ENVIRONMENT_SOURCE)
                }
              }}
            >
              <Dialog.Portal>
                <Dialog.Overlay className={`${modalBackdropClassName} z-50`} />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-[51] w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-surface-raised shadow-panel focus:outline-none">
                  <div className="flex items-start gap-3 border-b border-border px-6 py-5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent-soft text-accent">
                      <Layers3 className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <Dialog.Title className="text-base font-semibold text-ink">
                        {t('variables.createEnvironment')}
                      </Dialog.Title>
                      <Dialog.Description className="mt-1 text-xs leading-relaxed text-ink-muted">
                        {t('variables.createEnvironmentHint')}
                      </Dialog.Description>
                    </div>
                    <Dialog.Close asChild>
                      <IconButton
                        label={t('common.close')}
                        icon={<X className="size-4" />}
                        className="ml-auto size-8"
                      />
                    </Dialog.Close>
                  </div>
                  <div className="space-y-5 px-6 py-5">
                    <FieldShell label={t('variables.environmentName')} htmlFor="environment-name">
                      <Input
                        id="environment-name"
                        autoFocus
                        value={newName}
                        onChange={(event) => setNewName(event.target.value)}
                      />
                    </FieldShell>
                    <FieldShell
                      label={t('variables.copyFrom')}
                      htmlFor="environment-copy-source"
                      hint={t('common.optional')}
                    >
                      <SelectMenu
                        id="environment-copy-source"
                        value={cloneSourceId}
                        onValueChange={setCloneSourceId}
                        label={t('variables.copyFrom')}
                        placeholder={t('variables.emptyEnvironmentOption')}
                        options={[
                          {
                            value: EMPTY_ENVIRONMENT_SOURCE,
                            label: t('variables.emptyEnvironmentOption'),
                          },
                          ...data.environments.map((item) => ({
                            value: item.id,
                            label: item.name,
                          })),
                        ]}
                      />
                      <p className="text-[11px] leading-relaxed text-ink-subtle">
                        {t('variables.copyFromHint')}
                      </p>
                    </FieldShell>
                  </div>
                  <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-sunken px-6 py-4">
                    <Dialog.Close asChild>
                      <Button variant="ghost">{t('common.cancel')}</Button>
                    </Dialog.Close>
                    <Button variant="primary" disabled={!newName.trim()} onClick={create}>
                      {t('common.create')}
                    </Button>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
          <div className="border-b border-border px-3 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle" />
              <Input
                value={environmentQuery}
                onChange={(event) => setEnvironmentQuery(event.target.value)}
                placeholder={t('variables.searchEnvironments')}
                aria-label={t('variables.searchEnvironments')}
                className="h-9 bg-surface-sunken pl-8 text-xs"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-auto p-2">
            {environments.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setEditingEnvironmentId(item.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink',
                  item.id === environment.id && 'bg-surface-hover text-ink',
                )}
              >
                <EnvironmentMarker active={item.id === data.activeEnvironmentId} />
                {item.name}
                {hasUnsavedDraft(item) ? (
                  <span
                    className="ml-auto size-1.5 rounded-full bg-warning"
                    aria-label={t('variables.unsavedChanges')}
                  />
                ) : null}
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0 overflow-auto bg-canvas" aria-label={t('variables.title')}>
          <div className="w-full px-8 py-6">
            <EditorHeader
              actions={
                <IconButton
                  label={t('variables.deleteEnvironment')}
                  icon={<Trash2 className="size-3.5" />}
                  className="size-8 text-ink-subtle hover:bg-danger-soft hover:text-danger"
                  disabled={data.environments.length === 1}
                  onClick={() => setDeleteOpen(true)}
                />
              }
            >
              <div className="flex min-w-0 items-center gap-2">
                {renaming ? (
                  <div className="flex min-w-64 gap-2">
                    <Input
                      value={nameDraft}
                      onChange={(event) => setNameDraft(event.target.value)}
                      aria-label={t('variables.environmentName')}
                    />
                    <Button
                      size="sm"
                      variant="primary"
                      className="whitespace-nowrap"
                      onClick={saveName}
                    >
                      {t('variables.saveName')}
                    </Button>
                    <IconButton
                      label={t('common.cancel')}
                      icon={<X className="size-3.5" />}
                      onClick={() => setRenaming(false)}
                    />
                  </div>
                ) : (
                  <>
                    <h2 className="truncate text-lg font-semibold text-ink">{environment.name}</h2>
                    <IconButton
                      label={t('variables.renameEnvironment')}
                      icon={<Pencil className="size-3.5" />}
                      className="size-8"
                      onClick={() => {
                        setNameDraft(environment.name)
                        setRenaming(true)
                      }}
                    />
                    {dirty ? (
                      <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-warning">
                        <span className="size-1.5 rounded-full bg-warning" />
                        {t('variables.unsavedChanges')}
                      </span>
                    ) : null}
                  </>
                )}
              </div>
            </EditorHeader>
            <AlertDialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialog.Portal>
                <AlertDialog.Overlay className={`${modalBackdropClassName} z-50`} />
                <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[61] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface-raised p-5 shadow-panel focus:outline-none">
                  <AlertDialog.Title className="text-base font-semibold text-ink">
                    {t('variables.deleteEnvironment')}
                  </AlertDialog.Title>
                  <AlertDialog.Description className="mt-2 text-xs text-ink-muted">
                    {t('variables.deleteEnvironmentHint', { name: environment.name })}
                  </AlertDialog.Description>
                  <div className="mt-6 flex justify-end gap-2">
                    <AlertDialog.Cancel asChild>
                      <Button variant="ghost">{t('common.cancel')}</Button>
                    </AlertDialog.Cancel>
                    <AlertDialog.Action asChild>
                      <Button
                        variant="danger"
                        onClick={() => {
                          deleteEnvironment(environment.id)
                          setDeleteOpen(false)
                        }}
                      >
                        {t('common.delete')}
                      </Button>
                    </AlertDialog.Action>
                  </div>
                </AlertDialog.Content>
              </AlertDialog.Portal>
            </AlertDialog.Root>

            <EditorToolbar>
              <div className="relative min-w-56 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle" />
                <Input
                  value={variableQuery}
                  onChange={(event) => setVariableQuery(event.target.value)}
                  placeholder={t('variables.searchVariables')}
                  aria-label={t('variables.searchVariables')}
                  className="h-8 bg-surface-sunken pl-8 text-xs"
                />
              </div>
              <Button
                size="sm"
                className="whitespace-nowrap"
                disabled={!dirty}
                onClick={resetVariables}
              >
                {t('common.reset')}
              </Button>
              <Button
                size="sm"
                variant="primary"
                className="whitespace-nowrap"
                disabled={!dirty}
                onClick={saveVariables}
              >
                {t('variables.saveChanges')}
              </Button>
            </EditorToolbar>

            <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface">
              <div className="min-w-[820px]">
                <div className="grid grid-cols-[64px_minmax(220px,.8fr)_minmax(320px,1.25fr)_minmax(240px,.9fr)_78px_92px] border-b border-border bg-surface-sunken text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
                  <span className="border-r border-border px-3 py-2.5 text-center">
                    {t('common.enabledShort')}
                  </span>
                  <span className="border-r border-border px-3 py-2.5">
                    {t('variables.variable')}
                  </span>
                  <span className="border-r border-border px-3 py-2.5">{t('variables.value')}</span>
                  <span className="border-r border-border px-3 py-2.5">
                    {t('common.description')}
                  </span>
                  <span className="border-r border-border px-3 py-2.5 text-center whitespace-nowrap">
                    {t('common.secret')}
                  </span>
                  <span className="px-3 py-2.5 text-center">{t('common.actions')}</span>
                </div>
                {variables.map((variable) => {
                  const visible = revealed.has(variable.id)
                  return (
                    <div
                      key={variable.id}
                      className="grid min-h-12 grid-cols-[64px_minmax(220px,.8fr)_minmax(320px,1.25fr)_minmax(240px,.9fr)_78px_92px] border-b border-border last:border-b-0 hover:bg-surface-hover/50"
                    >
                      <div className="flex items-center border-r border-border px-3">
                        <Switch
                          checked={variable.enabled}
                          onCheckedChange={(enabled) =>
                            patchDraftVariable(variable.id, { enabled })
                          }
                          label={t('common.enabled')}
                        />
                      </div>
                      <Input
                        value={variable.key}
                        onChange={(event) =>
                          patchDraftVariable(variable.id, { key: event.target.value })
                        }
                        aria-label={t('workbench.key')}
                        className="h-full rounded-none border-0 border-r border-border bg-transparent px-3 font-mono text-xs"
                      />
                      <Input
                        value={
                          variable.secret && !visible ? maskSecret(variable.value) : variable.value
                        }
                        onChange={(event) =>
                          patchDraftVariable(variable.id, { value: event.target.value })
                        }
                        readOnly={variable.secret && !visible}
                        aria-label={t('variables.value')}
                        className="h-full rounded-none border-0 border-r border-border bg-transparent px-3 font-mono text-xs"
                      />
                      <Input
                        value={variable.description}
                        title={variable.description}
                        onChange={(event) =>
                          patchDraftVariable(variable.id, {
                            description: event.target.value,
                          })
                        }
                        aria-label={t('common.description')}
                        className="h-full rounded-none border-0 border-r border-border bg-transparent px-3 text-xs"
                      />
                      <div className="flex items-center justify-center border-r border-border">
                        <IconButton
                          label={t('variables.markSecret')}
                          icon={<KeyRound className="size-3.5" />}
                          className={cn(
                            'size-8',
                            variable.secret && 'text-warning hover:bg-warning-soft',
                          )}
                          onClick={() =>
                            patchDraftVariable(variable.id, {
                              secret: !variable.secret,
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-center gap-0.5">
                        {variable.secret ? (
                          <IconButton
                            label={visible ? t('common.hide') : t('common.reveal')}
                            icon={
                              visible ? (
                                <EyeOff className="size-3.5" />
                              ) : (
                                <Eye className="size-3.5" />
                              )
                            }
                            className="size-8"
                            onClick={() => toggleReveal(variable.id)}
                          />
                        ) : null}
                        <IconButton
                          label={t('common.delete')}
                          icon={<Trash2 className="size-3.5" />}
                          className="size-8 text-ink-subtle hover:bg-danger-soft hover:text-danger"
                          onClick={() => removeDraftVariable(variable.id)}
                        />
                      </div>
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={addDraftVariable}
                  className="flex h-11 w-full items-center gap-2 px-3 text-left text-xs font-medium text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
                >
                  <Plus className="size-3.5" />
                  {t('variables.addVariable')}
                </button>
              </div>
            </div>
          </div>
        </section>
      </MasterDetailShell>
    </div>
  )
}

export default VariablesPage
