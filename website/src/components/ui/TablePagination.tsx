import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { SelectMenu } from '@/components/ui/SelectMenu'

interface TablePaginationProps {
  page: number
  pageCount: number
  pageSize: number
  total: number
  pageSizeOptions?: readonly number[]
  rangeLabel: string
  pageLabel: string
  rowsPerPageLabel: string
  previousLabel: string
  nextLabel: string
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

/** Shared, compact pagination for evidence tables. Page state stays with the feature. */
export const TablePagination = ({
  page,
  pageCount,
  pageSize,
  total,
  pageSizeOptions = [10, 25, 50],
  rangeLabel,
  pageLabel,
  rowsPerPageLabel,
  previousLabel,
  nextLabel,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) => (
  <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-3 py-2.5">
    <p className="text-xs text-ink-muted">{rangeLabel}</p>
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2 text-xs text-ink-muted">
        <span className="hidden sm:inline">{rowsPerPageLabel}</span>
        <SelectMenu
          value={String(pageSize)}
          className="h-8 w-[68px] text-xs"
          label={rowsPerPageLabel}
          onValueChange={(value) => onPageSizeChange(Number(value))}
          options={pageSizeOptions.map((option) => ({
            value: String(option),
            label: String(option),
          }))}
        />
      </label>
      <span className="hidden whitespace-nowrap text-xs text-ink-muted sm:inline">{pageLabel}</span>
      <Button
        size="sm"
        variant="ghost"
        icon={<ChevronLeft className="size-3.5" />}
        aria-label={previousLabel}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <span className="hidden sm:inline">{previousLabel}</span>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        icon={<ChevronRight className="size-3.5" />}
        aria-label={nextLabel}
        disabled={page >= pageCount || total === 0}
        onClick={() => onPageChange(page + 1)}
      >
        <span className="hidden sm:inline">{nextLabel}</span>
      </Button>
    </div>
  </footer>
)
