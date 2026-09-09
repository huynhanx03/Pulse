import { Pencil, Save } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { RequestActionsMenu } from '@/features/workbench'
import { Input } from '@/components/ui/Field'
import { IconButton } from '@/components/ui/IconButton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { ApiRequest } from '@/domain/types'
import { usePulseStore } from '@/state/pulse-store'

export const RequestTitleBar = ({
  request,
  onImport,
  onGenerateCode,
}: {
  request: ApiRequest
  onImport?: () => void
  onGenerateCode?: () => void
}) => {
  const { t } = useTranslation()
  const [editingName, setEditingName] = useState(false)
  const updateRequest = usePulseStore((state) => state.updateRequest)
  const saveRequest = usePulseStore((state) => state.saveRequest)

  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
      {editingName ? (
        <Input
          id="request-name"
          autoFocus
          value={request.name}
          onChange={(event) => updateRequest(request.id, { name: event.target.value })}
          onBlur={() => setEditingName(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur()
          }}
          aria-label={t('common.name')}
          className="h-7 max-w-72 border-border-strong bg-surface-raised px-2 text-sm font-semibold"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingName(true)}
          aria-label={`${t('common.name')}: ${request.name}`}
          className="group flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm font-semibold text-ink transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span className="truncate">{request.name}</span>
          <Pencil className="size-3 shrink-0 text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        </button>
      )}
      {request.dirty ? (
        <StatusBadge status="draft" className="ml-0.5">
          {t('runs.draftState')}
        </StatusBadge>
      ) : null}
      <div className="ml-auto flex items-center gap-0.5">
        <IconButton
          label={t('workbench.saveRequest')}
          icon={<Save className="size-3.5" />}
          className="size-7 max-md:size-9"
          onClick={() => saveRequest(request.id)}
          disabled={!request.dirty}
        />
        <RequestActionsMenu
          request={request}
          {...(onImport ? { onImport } : {})}
          {...(onGenerateCode ? { onGenerateCode } : {})}
        />
      </div>
    </header>
  )
}
