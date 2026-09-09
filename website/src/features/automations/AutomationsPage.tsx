import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Clock3, Pencil, Play, Plus, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { modalBackdropClassName } from '@/components/ui/dialogStyles'
import { EmptyState } from '@/components/ui/EmptyState'
import { FieldShell, Input } from '@/components/ui/Field'
import { IconButton } from '@/components/ui/IconButton'
import { Panel } from '@/components/ui/Panel'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { SelectMenu } from '@/components/ui/SelectMenu'
import { Switch } from '@/components/ui/Switch'
import { StatusBadge, type StatusKind } from '@/components/ui/StatusBadge'
import { EditorHeader, EditorToolbar, MasterDetailShell } from '@/components/layout/MasterDetail'
import type { WorkspaceSchedule } from '@/domain/types'
import { formatDateTime } from '@/lib/i18n/formatters'
import { cn } from '@/lib/utils/cn'
import { usePulseStore } from '@/state/pulse-store'

const draftKeyFor = (workspaceId: string, scheduleId: string) => `${workspaceId}:${scheduleId}`

const AutomationsPage = () => {
  const { t } = useTranslation()
  const data = usePulseStore((state) => state.data)
  const locale = usePulseStore((state) => state.preferences.locale)
  const createSchedule = usePulseStore((state) => state.createSchedule)
  const updateSchedule = usePulseStore((state) => state.updateSchedule)
  const deleteSchedule = usePulseStore((state) => state.deleteSchedule)
  const runScheduleNow = usePulseStore((state) => state.runScheduleNow)
  const [selectedId, setSelectedId] = useState(data.schedules[0]?.id ?? '')
  const [drafts, setDrafts] = useState<Record<string, WorkspaceSchedule>>({})
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [scheduleQuery, setScheduleQuery] = useState('')
  const schedule = data.schedules.find((item) => item.id === selectedId) ?? data.schedules[0]
  const operations = useMemo(
    () =>
      data.requests.map((request) => ({
        value: request.id,
        label: `${request.protocol === 'grpc' ? 'gRPC' : 'HTTP'} · ${request.name}`,
      })),
    [data.requests],
  )
  const schedules = useMemo(() => {
    const query = scheduleQuery.trim().toLocaleLowerCase()
    if (!query) return data.schedules
    return data.schedules.filter((item) => {
      const operation = data.requests.find((request) => request.id === item.operationId)
      return `${item.name} ${operation?.name ?? ''} ${operation?.method ?? ''}`
        .toLocaleLowerCase()
        .includes(query)
    })
  }, [data.requests, data.schedules, scheduleQuery])
  const create = () => setSelectedId(createSchedule())

  if (!schedule) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-canvas">
        <PageHeader onCreate={create} />
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <EmptyState
            icon={<Clock3 className="size-5" />}
            title={t('automations.emptyTitle')}
            description={t('automations.emptyHint')}
            action={
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={create}>
                {t('automations.newSchedule')}
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  const draftKey = draftKeyFor(data.workspace.id, schedule.id)
  const draft = drafts[draftKey] ?? schedule
  const dirty = JSON.stringify(draft) !== JSON.stringify(schedule)
  const patchDraft = (patch: Partial<WorkspaceSchedule>) =>
    setDrafts((current) => ({ ...current, [draftKey]: { ...draft, ...patch } }))
  const reset = () =>
    setDrafts((current) => {
      const { [draftKey]: _, ...rest } = current
      return rest
    })
  const save = () => {
    updateSchedule(schedule.id, draft)
    reset()
  }
  const startRename = () => {
    setNameDraft(draft.name)
    setRenaming(true)
  }
  const saveNameDraft = () => {
    patchDraft({ name: nameDraft.trim() || draft.name })
    setRenaming(false)
  }
  const deleteSelected = () => {
    const next = data.schedules.find((item) => item.id !== schedule.id)
    deleteSchedule(schedule.id)
    setSelectedId(next?.id ?? '')
    setDeleteOpen(false)
  }
  const minutes = Math.max(1, Math.round(draft.intervalSeconds / 60))
  const lastRunStatus: StatusKind =
    draft.lastRunStatus === 'success'
      ? 'success'
      : draft.lastRunStatus === 'failed'
        ? 'failed'
        : 'ready'
  const nextRun =
    draft.enabled && draft.lastRunAt
      ? new Date(new Date(draft.lastRunAt).getTime() + draft.intervalSeconds * 1000)
      : null

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-canvas">
      <PageHeader onCreate={create} />
      <MasterDetailShell>
        <aside className="flex min-h-0 flex-col border-b border-border bg-surface lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-4 pb-3 pt-4">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-subtle">
              {t('automations.scheduleList')}
            </h2>
            <span className="text-[11px] font-medium text-ink-subtle">{data.schedules.length}</span>
          </div>
          <div className="border-b border-border px-3 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle" />
              <Input
                value={scheduleQuery}
                onChange={(event) => setScheduleQuery(event.target.value)}
                placeholder={t('automations.searchSchedules')}
                aria-label={t('automations.searchSchedules')}
                className="h-9 bg-surface-sunken pl-8 text-xs"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-auto p-2">
            {schedules.map((item) => {
              const operation = data.requests.find((request) => request.id === item.operationId)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-surface-hover',
                    item.id === schedule.id && 'bg-surface-hover',
                  )}
                >
                  <span
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      item.enabled ? 'bg-success' : 'bg-ink-subtle',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{item.name}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-ink-muted">
                      {operation
                        ? `${operation.protocol === 'grpc' ? 'gRPC' : 'HTTP'} · ${operation.name}`
                        : t('automations.noOperation')}
                    </span>
                  </span>
                </button>
              )
            })}
            {schedules.length === 0 ? (
              <p className="px-3 py-5 text-xs text-ink-muted">
                {t('automations.noMatchingSchedules')}
              </p>
            ) : null}
          </div>
        </aside>

        <section className="min-w-0 overflow-auto bg-canvas" aria-label={t('schedules.title')}>
          <div className="w-full px-8 py-6">
            <EditorHeader
              actions={
                <IconButton
                  label={t('automations.deleteSchedule')}
                  icon={<Trash2 className="size-3.5" />}
                  className="size-8 text-ink-subtle hover:bg-danger-soft hover:text-danger"
                  onClick={() => setDeleteOpen(true)}
                />
              }
            >
              <div className="flex min-w-0 items-center gap-2">
                {renaming ? (
                  <div className="flex min-w-64 gap-2">
                    <Input
                      autoFocus
                      value={nameDraft}
                      onChange={(event) => setNameDraft(event.target.value)}
                      aria-label={t('automations.scheduleName')}
                    />
                    <Button
                      size="sm"
                      variant="primary"
                      className="whitespace-nowrap"
                      onClick={saveNameDraft}
                    >
                      {t('variables.saveName')}
                    </Button>
                    <IconButton
                      label={t('common.cancel')}
                      icon={<X className="size-3.5" />}
                      className="size-8"
                      onClick={() => setRenaming(false)}
                    />
                  </div>
                ) : (
                  <>
                    <h2 className="truncate text-lg font-semibold text-ink">{draft.name}</h2>
                    <IconButton
                      label={t('automations.renameSchedule')}
                      icon={<Pencil className="size-3.5" />}
                      className="size-8"
                      onClick={startRename}
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

            <EditorToolbar className="justify-end">
              <Button size="sm" disabled={!dirty} onClick={reset}>
                {t('common.reset')}
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={!dirty || !draft.name.trim() || !draft.operationId}
                onClick={save}
              >
                {t('variables.saveChanges')}
              </Button>
            </EditorToolbar>

            <div className="mt-4 space-y-3">
              <Panel
                title={t('automations.automaticRun')}
                description={t('automations.automaticRunHint')}
                action={
                  <Switch
                    checked={draft.enabled}
                    onCheckedChange={(enabled) => patchDraft({ enabled })}
                    label={t('automations.automaticRun')}
                  />
                }
              >
                <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_180px]">
                  <FieldShell label={t('automations.operation')} htmlFor="schedule-operation">
                    <SelectMenu
                      id="schedule-operation"
                      value={draft.operationId}
                      onValueChange={(operationId) => patchDraft({ operationId })}
                      label={t('automations.operation')}
                      placeholder={t('automations.chooseOperation')}
                      options={operations}
                    />
                  </FieldShell>
                  <FieldShell
                    label={t('automations.runEvery')}
                    htmlFor="schedule-interval"
                    hint={t('automations.minutes')}
                  >
                    <Input
                      id="schedule-interval"
                      type="number"
                      min={1}
                      value={minutes}
                      onChange={(event) =>
                        patchDraft({
                          intervalSeconds: Math.max(60, Number(event.target.value || 1) * 60),
                        })
                      }
                    />
                  </FieldShell>
                </div>
              </Panel>

              <Panel
                title={t('automations.runStatus')}
                action={
                  <StatusBadge status={lastRunStatus}>
                    {t(`automations.status.${draft.lastRunStatus}`)}
                  </StatusBadge>
                }
                className="overflow-hidden"
              >
                <div className="grid gap-px bg-border md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <StatusTime
                    label={t('automations.lastRun')}
                    value={draft.lastRunAt ? formatDateTime(draft.lastRunAt, locale) : '—'}
                  />
                  <StatusTime
                    label={t('automations.nextRun')}
                    value={nextRun ? formatDateTime(nextRun.toISOString(), locale) : '—'}
                  />
                  <div className="flex items-center bg-surface-raised p-3 md:justify-end">
                    <Button
                      className="w-full md:w-auto"
                      icon={<Play className="size-3.5" />}
                      disabled={dirty || !draft.operationId}
                      onClick={() => runScheduleNow(schedule.id)}
                    >
                      {t('automations.runNow')}
                    </Button>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        </section>
      </MasterDetailShell>

      <AlertDialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className={`${modalBackdropClassName} z-50`} />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[51] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface-raised p-5 shadow-panel focus:outline-none">
            <AlertDialog.Title className="text-base font-semibold text-ink">
              {t('automations.deleteSchedule')}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-xs leading-relaxed text-ink-muted">
              {t('automations.deleteHint', { name: schedule.name })}
            </AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button variant="ghost">{t('common.cancel')}</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button variant="danger" onClick={deleteSelected}>
                  {t('common.delete')}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  )
}

const StatusTime = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 bg-surface px-4 py-3.5">
    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">{label}</p>
    <p className="mt-1.5 truncate font-mono text-xs font-medium text-ink" title={value}>
      {value}
    </p>
  </div>
)

const PageHeader = ({ onCreate }: { onCreate: () => void }) => {
  const { t } = useTranslation()
  return (
    <SectionHeading
      eyebrow={t('automations.eyebrow')}
      title={t('automations.title')}
      description={t('automations.subtitle')}
      actions={
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={onCreate}>
          {t('automations.newSchedule')}
        </Button>
      }
    />
  )
}

export default AutomationsPage
