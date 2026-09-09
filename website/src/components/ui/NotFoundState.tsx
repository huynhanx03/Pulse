import { FileQuestion } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'

export const NotFoundState = ({
  descriptionKey = 'errors.notFoundHint',
}: {
  descriptionKey?: string
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div className="flex h-full items-center justify-center bg-canvas">
      <EmptyState
        icon={<FileQuestion className="size-5" />}
        title={t('errors.notFound')}
        description={t(descriptionKey)}
        action={
          <Button variant="primary" onClick={() => navigate('/')}>
            {t('common.backToWorkbench')}
          </Button>
        }
      />
    </div>
  )
}
