import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Copy, Database, Pencil, Plus, Search, Sparkles, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { modalBackdropClassName } from '@/components/ui/dialogStyles'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Field'
import { IconButton } from '@/components/ui/IconButton'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { SelectMenu } from '@/components/ui/SelectMenu'
import { EditorHeader, EditorToolbar, MasterDetailShell } from '@/components/layout/MasterDetail'
import type { Dataset, DatasetColumn } from '@/domain/types'
import { usePulseStore } from '@/state/pulse-store'

const generators: Array<{ value: DatasetColumn['mode']; label: string }> = [
  { value: 'fixed', label: 'datasets.fixedValue' },
  { value: 'sequence', label: 'datasets.sequence' },
  { value: 'random-email', label: 'datasets.randomEmail' },
  { value: 'random-uuid', label: 'datasets.randomUuid' },
  { value: 'random-int', label: 'datasets.randomInt' },
  { value: 'pick', label: 'datasets.pickList' },
]
const types: Array<NonNullable<DatasetColumn['valueType']>> = ['string', 'number', 'boolean']
const typeKey = (type: NonNullable<DatasetColumn['valueType']>) =>
  `datasets.type${type.replace(/^./, (value) => value.toUpperCase())}`

const DatasetsPage = () => {
  const { t } = useTranslation()
  const data = usePulseStore((state) => state.data)
  const createDataset = usePulseStore((state) => state.createDataset)
  const updateDataset = usePulseStore((state) => state.updateDataset)
  const deleteDataset = usePulseStore((state) => state.deleteDataset)
  const generateDatasetSample = usePulseStore((state) => state.generateDatasetSample)
  const showToast = usePulseStore((state) => state.showToast)
  const [selectedId, setSelectedId] = useState(data.datasets[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [fieldQuery, setFieldQuery] = useState('')
  const [draft, setDraft] = useState<Dataset | null>(null)
  const [sample, setSample] = useState<Record<string, string | number | boolean> | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const savedDataset = data.datasets.find((item) => item.id === selectedId) ?? data.datasets[0]
  const dataset = draft?.id === selectedId ? draft : savedDataset
  const profiles = useMemo(
    () =>
      data.datasets.filter((item) =>
        `${item.name} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [data.datasets, query],
  )
  const visibleColumns = useMemo(() => {
    if (!dataset) return []
    const normalizedQuery = fieldQuery.trim().toLowerCase()
    if (!normalizedQuery) return dataset.columns
    return dataset.columns.filter((column) =>
      `${column.key} ${column.valueType ?? ''} ${column.mode} ${column.value}`
        .toLowerCase()
        .includes(normalizedQuery),
    )
  }, [dataset, fieldQuery])
  const updateDraft = (patch: Partial<Dataset>) => {
    if (!dataset) return
    setDraft({ ...(draft?.id === dataset.id ? draft : structuredClone(dataset)), ...patch })
  }
  const selectNewProfile = () => {
    const id = createDataset(t('datasets.newDataset'))
    setDraft(null)
    setSelectedId(id)
    setSample(null)
    setNameDraft(t('datasets.newDataset'))
    setRenaming(true)
  }

  if (!dataset) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-canvas">
        <SectionHeading
          eyebrow={t('datasets.eyebrow')}
          title={t('datasets.title')}
          description={t('datasets.subtitle')}
          actions={
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={selectNewProfile}>
              {t('datasets.createFirst')}
            </Button>
          }
        />
        <div className="grid min-h-0 flex-1 place-items-center p-4">
          <EmptyState
            icon={<Database className="size-5" />}
            title={t('datasets.emptyTitle')}
            description={t('datasets.emptyHint')}
          />
        </div>
      </div>
    )
  }

  const patchColumn = (columnId: string, patch: Partial<DatasetColumn>) =>
    updateDraft({
      columns: dataset.columns.map((column) =>
        column.id === columnId ? { ...column, ...patch } : column,
      ),
    })
  const addColumn = () => {
    let index = dataset.columns.length + 1
    while (dataset.columns.some((column) => column.key === `field_${index}`)) index += 1
    updateDraft({
      columns: [
        ...dataset.columns,
        {
          id: `column-${crypto.randomUUID()}`,
          key: `field_${index}`,
          valueType: 'string',
          mode: 'fixed',
          value: '',
        },
      ],
    })
  }
  const removeColumn = (columnId: string) => {
    if (dataset.columns.length > 1)
      updateDraft({
        columns: dataset.columns.filter((column) => column.id !== columnId),
      })
  }
  const saveDraft = () => {
    if (!draft) return
    updateDataset(draft.id, draft)
    setDraft(null)
    showToast(t('common.save'))
  }
  const resetDraft = () => {
    setDraft(null)
    setSample(null)
  }
  const saveName = () => {
    const name = nameDraft.trim()
    if (name) updateDraft({ name })
    setRenaming(false)
  }
  const generateSample = () => {
    setSample(generateDatasetSample(dataset) ?? {})
  }
  const copySample = async () => {
    if (!sample) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(sample, null, 2))
      showToast(t('common.copied'))
    } catch {
      showToast(t('errors.generic'))
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-canvas">
      <SectionHeading
        eyebrow={t('datasets.eyebrow')}
        title={t('datasets.title')}
        description={t('datasets.subtitle')}
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={selectNewProfile}>
            {t('datasets.newProfile')}
          </Button>
        }
      />
      <MasterDetailShell>
        <aside className="flex min-h-0 flex-col border-b border-border bg-surface lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-4 pb-3 pt-4">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-subtle">
              {t('datasets.profiles')}
            </h2>
            <span className="text-[11px] font-medium text-ink-subtle">{data.datasets.length}</span>
          </div>
          <div className="border-b border-border px-3 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('datasets.searchProfiles')}
                aria-label={t('datasets.searchProfiles')}
                className="h-9 bg-surface-sunken pl-8 text-xs"
              />
            </div>
          </div>
          <nav
            className="min-h-0 flex-1 space-y-1 overflow-auto p-2"
            aria-label={t('datasets.profiles')}
          >
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                disabled={Boolean(draft && draft.id !== profile.id)}
                onClick={() => {
                  setSelectedId(profile.id)
                  setSample(null)
                }}
                className={`flex w-full items-start gap-2.5 rounded-md px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${profile.id === dataset.id ? 'bg-surface-hover text-ink' : 'text-ink-muted hover:bg-surface-hover hover:text-ink'}`}
              >
                <Database className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{profile.name}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-ink-subtle">
                    {profile.columns.length} {t('datasets.fields')}
                    {draft?.id === profile.id ? ` · ${t('datasets.draft')}` : ''}
                  </span>
                </span>
              </button>
            ))}
            {profiles.length === 0 ? (
              <p className="px-3 py-5 text-xs text-ink-muted">{t('datasets.noMatchingProfiles')}</p>
            ) : null}
          </nav>
        </aside>
        <section
          className="w-0 min-w-full max-w-full overflow-x-hidden overflow-y-auto bg-canvas"
          aria-label={t('datasets.title')}
        >
          <div className="min-w-0 max-w-full px-4 py-5 sm:px-8 sm:py-6">
            <EditorHeader
              actions={
                <AlertDialog.Root>
                  <AlertDialog.Trigger asChild>
                    <IconButton
                      label={t('datasets.deleteDataset')}
                      icon={<Trash2 className="size-3.5" />}
                      className="size-8 text-ink-subtle hover:bg-danger-soft hover:text-danger"
                    />
                  </AlertDialog.Trigger>
                  <AlertDialog.Portal>
                    <AlertDialog.Overlay className={`${modalBackdropClassName} z-50`} />
                    <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface-raised p-5 shadow-panel">
                      <AlertDialog.Title className="text-base font-semibold text-ink">
                        {t('datasets.deleteDataset')}
                      </AlertDialog.Title>
                      <AlertDialog.Description className="mt-2 text-sm leading-relaxed text-ink-muted">
                        {t('datasets.deleteDatasetHint', { name: dataset.name })}
                      </AlertDialog.Description>
                      <div className="mt-5 flex justify-end gap-2">
                        <AlertDialog.Cancel asChild>
                          <Button>{t('common.cancel')}</Button>
                        </AlertDialog.Cancel>
                        <AlertDialog.Action asChild>
                          <Button
                            variant="danger"
                            onClick={() => {
                              const next = data.datasets.find(
                                (profile) => profile.id !== dataset.id,
                              )
                              if (data.datasets.some((profile) => profile.id === dataset.id))
                                deleteDataset(dataset.id)
                              setDraft(null)
                              setSelectedId(next?.id ?? '')
                            }}
                          >
                            {t('common.delete')}
                          </Button>
                        </AlertDialog.Action>
                      </div>
                    </AlertDialog.Content>
                  </AlertDialog.Portal>
                </AlertDialog.Root>
              }
            >
              <div className="flex min-w-0 items-center gap-2">
                {renaming ? (
                  <div className="flex min-w-0 flex-1 items-center gap-2 sm:min-w-64">
                    <Input
                      autoFocus
                      value={nameDraft}
                      onChange={(event) => setNameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') saveName()
                        if (event.key === 'Escape') setRenaming(false)
                      }}
                      aria-label={t('common.name')}
                      className="h-9"
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
                    <h2 className="truncate text-lg font-semibold text-ink">{dataset.name}</h2>
                    <IconButton
                      label={t('datasets.renameProfile')}
                      icon={<Pencil className="size-3.5" />}
                      className="size-8"
                      onClick={() => {
                        setNameDraft(dataset.name)
                        setRenaming(true)
                      }}
                    />
                    {draft ? (
                      <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-warning">
                        <span className="size-1.5 rounded-full bg-warning" />
                        {t('datasets.draft')}
                      </span>
                    ) : null}
                  </>
                )}
              </div>
            </EditorHeader>
            <EditorToolbar>
              <div className="relative min-w-0 flex-1 sm:min-w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle" />
                <Input
                  value={fieldQuery}
                  onChange={(event) => setFieldQuery(event.target.value)}
                  placeholder={t('datasets.searchFields')}
                  aria-label={t('datasets.searchFields')}
                  className="h-8 bg-surface-sunken pl-8 text-xs"
                />
              </div>
              <Button
                size="sm"
                className="whitespace-nowrap"
                onClick={resetDraft}
                disabled={!draft}
              >
                {t('common.reset')}
              </Button>
              <Button
                size="sm"
                variant="primary"
                className="whitespace-nowrap"
                onClick={saveDraft}
                disabled={!draft}
              >
                {t('variables.saveChanges')}
              </Button>
            </EditorToolbar>
            <section className="mt-4 overflow-hidden rounded-lg border border-border bg-surface-raised">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-ink">{t('datasets.schema')}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                    {t('datasets.schemaHint')}
                  </p>
                </div>
              </div>
              <div className="min-w-0 max-w-full overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-surface-sunken text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
                    <tr>
                      <th className="px-4 py-2.5">{t('datasets.fieldName')}</th>
                      <th className="w-40 px-3 py-2.5">{t('datasets.valueType')}</th>
                      <th className="w-48 px-3 py-2.5">{t('datasets.generator')}</th>
                      <th className="px-3 py-2.5">{t('datasets.generatorConfig')}</th>
                      <th className="relative w-12 px-2 py-2.5">
                        <span className="sr-only">{t('common.actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visibleColumns.map((column) => (
                      <tr
                        key={column.id}
                        className="bg-surface-raised transition-colors hover:bg-surface-hover/50"
                      >
                        <td className="px-4 py-2">
                          <Input
                            value={column.key}
                            onChange={(event) =>
                              patchColumn(column.id, { key: event.target.value })
                            }
                            aria-label={t('datasets.fieldName')}
                            className="h-8 border-transparent bg-transparent px-0 font-mono text-xs hover:border-border focus:border-accent"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <SelectMenu
                            value={column.valueType ?? 'string'}
                            onValueChange={(valueType) =>
                              patchColumn(column.id, {
                                valueType: valueType as NonNullable<DatasetColumn['valueType']>,
                              })
                            }
                            options={types.map((type) => ({
                              value: type,
                              label: t(typeKey(type)),
                            }))}
                            placeholder={t('datasets.valueType')}
                            label={t('datasets.valueType')}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <SelectMenu
                            value={column.mode}
                            onValueChange={(mode) =>
                              patchColumn(column.id, { mode: mode as DatasetColumn['mode'] })
                            }
                            options={generators.map((option) => ({
                              value: option.value,
                              label: t(option.label),
                            }))}
                            placeholder={t('datasets.generator')}
                            label={t('datasets.generator')}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={column.value}
                            onChange={(event) =>
                              patchColumn(column.id, { value: event.target.value })
                            }
                            placeholder={t('datasets.generatorConfigPlaceholder')}
                            aria-label={t('datasets.generatorConfig')}
                            className="h-8 font-mono text-xs"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <IconButton
                            label={t('datasets.removeColumn', { name: column.key })}
                            icon={<Trash2 className="size-3.5" />}
                            disabled={dataset.columns.length === 1}
                            onClick={() => removeColumn(column.id)}
                            className="size-8 text-ink-subtle hover:bg-danger-soft hover:text-danger disabled:pointer-events-none disabled:opacity-35"
                          />
                        </td>
                      </tr>
                    ))}
                    {visibleColumns.length === 0 ? (
                      <tr className="bg-surface-raised">
                        <td colSpan={5} className="px-4 py-8 text-center text-xs text-ink-muted">
                          {t('datasets.noMatchingFields')}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-border p-2">
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Plus className="size-3.5" />}
                  onClick={addColumn}
                >
                  {t('datasets.addField')}
                </Button>
              </div>
            </section>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-ink-muted">{t('datasets.sampleHint')}</p>
              <Button size="sm" icon={<Sparkles className="size-3.5" />} onClick={generateSample}>
                {t('datasets.generateSample')}
              </Button>
            </div>
            {sample ? (
              <section className="mt-3 overflow-hidden rounded-lg border border-border bg-surface-raised">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <h2 className="text-xs font-semibold text-ink">
                    {t('datasets.generatedSample')}
                  </h2>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Copy className="size-3.5" />}
                    onClick={() => void copySample()}
                  >
                    {t('common.copy')}
                  </Button>
                </div>
                <pre className="max-h-72 overflow-auto bg-surface-sunken p-4 text-xs leading-relaxed text-ink-muted">
                  {JSON.stringify(sample, null, 2)}
                </pre>
              </section>
            ) : null}
          </div>
        </section>
      </MasterDetailShell>
    </div>
  )
}

export default DatasetsPage
