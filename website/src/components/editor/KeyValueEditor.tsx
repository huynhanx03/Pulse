import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { KeyValueRow } from '@/domain/types'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Field'

interface KeyValueEditorProps {
  rows: KeyValueRow[]
  onChange: (rows: KeyValueRow[]) => void
  allowSecrets?: boolean
}

export const KeyValueEditor = ({ rows, onChange, allowSecrets = false }: KeyValueEditorProps) => {
  const { t } = useTranslation()
  const update = (id: string, patch: Partial<KeyValueRow>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  const add = () =>
    onChange([
      ...rows,
      { id: `row-${crypto.randomUUID()}`, enabled: true, key: '', value: '', description: '' },
    ])

  return (
    <div className="min-w-[620px]">
      <div className="grid grid-cols-[28px_minmax(140px,0.8fr)_minmax(180px,1fr)_minmax(140px,0.8fr)_32px] items-center border-b border-border bg-surface-sunken px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-subtle max-md:grid-cols-[44px_minmax(140px,0.8fr)_minmax(180px,1fr)_minmax(140px,0.8fr)_44px]">
        <span />
        <span>{t('workbench.key')}</span>
        <span>{t('workbench.value')}</span>
        <span>{t('workbench.description')}</span>
        <span />
      </div>
      {rows.map((row) => (
        <div
          key={row.id}
          className="density-row grid grid-cols-[28px_minmax(140px,0.8fr)_minmax(180px,1fr)_minmax(140px,0.8fr)_32px] items-center border-b border-border px-2 hover:bg-surface-hover/50 max-md:grid-cols-[44px_minmax(140px,0.8fr)_minmax(180px,1fr)_minmax(140px,0.8fr)_44px]"
        >
          <label className="flex cursor-pointer items-center gap-1 self-stretch max-md:min-h-11">
            <GripVertical className="size-3 text-ink-subtle" aria-hidden="true" />
            <Checkbox
              checked={row.enabled}
              onCheckedChange={(enabled) => update(row.id, { enabled: enabled === true })}
              aria-label={t('common.enabled')}
            />
          </label>
          <Input
            value={row.key}
            onChange={(event) => update(row.id, { key: event.target.value })}
            aria-label={t('workbench.key')}
            className="density-row-field rounded-none border-0 bg-transparent px-1.5 text-xs focus:ring-1"
          />
          <Input
            value={row.value}
            type={allowSecrets && row.secret ? 'password' : 'text'}
            onChange={(event) => update(row.id, { value: event.target.value })}
            aria-label={t('workbench.value')}
            className="density-row-field rounded-none border-0 bg-transparent px-1.5 font-mono text-xs focus:ring-1"
          />
          <Input
            value={row.description}
            onChange={(event) => update(row.id, { description: event.target.value })}
            aria-label={t('workbench.description')}
            className="density-row-field rounded-none border-0 bg-transparent px-1.5 text-xs text-ink-muted focus:ring-1"
          />
          <IconButton
            label={t('common.delete')}
            icon={<Trash2 className="size-3" />}
            className="size-7 max-md:size-11"
            onClick={() => onChange(rows.filter((candidate) => candidate.id !== row.id))}
          />
        </div>
      ))}
      <div className="p-2">
        <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={add}>
          {t('workbench.addRow')}
        </Button>
      </div>
    </div>
  )
}
