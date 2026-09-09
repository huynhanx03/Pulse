import { Command as CommandRoot, CommandInput, CommandItem, CommandList } from 'cmdk'
import { Check, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { ApiRequest, CollectionNode } from '@/domain/types'
import { Badge } from '@/components/ui/Badge'
import { HttpMethodBadge } from '@/components/ui/HttpMethodBadge'
import { cn } from '@/lib/utils/cn'

interface RequestSource {
  requests: ApiRequest[]
  collections: CollectionNode[]
}

interface RequestTargetSummaryProps extends RequestSource {
  value: string
  label: string
}

interface RequestSearchListProps extends RequestSource {
  value: string
  onValueChange: (requestId: string) => void
  label: string
  placeholder: string
  emptyLabel: string
  /** Optional server-query seam for workspaces that page request results. */
  onQueryChange?: (query: string) => void
  pageSize?: number
  previousPageLabel?: string
  nextPageLabel?: string
  pageLabel?: (page: number, total: number) => string
  columns?: {
    method: string
    request: string
    collection: string
    route: string
    selected: string
  }
  resultCountLabel?: (count: number) => string
}

const requestMethod = (request: ApiRequest) =>
  request.protocol === 'grpc' ? 'RPC' : request.method

const RequestMethodBadge = ({ request }: { request: ApiRequest }) =>
  request.protocol === 'http' ? (
    <HttpMethodBadge method={request.method} />
  ) : (
    <Badge tone="info" className="min-w-10 justify-center font-bold tracking-wide">
      RPC
    </Badge>
  )

const requestPath = (request: ApiRequest) => {
  if (request.protocol === 'grpc') return request.grpcMethodId || request.grpcType

  return request.url.replace(/^\{\{[^}]+\}\}/, '') || request.url
}

const useRequestContext = ({ requests, collections }: RequestSource) => {
  const context = useMemo(() => {
    const collectionNames = new Map(
      collections.map((collection) => [collection.id, collection.name]),
    )
    const folderNames = new Map(
      collections.flatMap((collection) =>
        collection.folders.map((folder) => [folder.id, folder.name]),
      ),
    )

    return new Map(
      requests.map((request) => [
        request.id,
        [collectionNames.get(request.collectionId), folderNames.get(request.folderId)]
          .filter(Boolean)
          .join(' / '),
      ]),
    )
  }, [collections, requests])
  const groups = useMemo(
    () =>
      collections
        .map((collection) => ({
          name: collection.name,
          requests: requests.filter((request) => request.collectionId === collection.id),
        }))
        .filter((group) => group.requests.length > 0),
    [collections, requests],
  )
  const ungrouped = requests.filter(
    (request) => !collections.some((collection) => collection.id === request.collectionId),
  )

  return { context, groups, ungrouped }
}

/** A compact, read-only target summary. The parent owns when editing is allowed. */
export const RequestTargetSummary = ({
  value,
  requests,
  collections,
  label,
}: RequestTargetSummaryProps) => {
  const selected = requests.find((request) => request.id === value) ?? requests[0]
  const { context } = useRequestContext({ requests, collections })

  if (!selected) return null

  return (
    <div
      aria-label={label}
      className="flex min-h-14 items-center gap-3 rounded-lg border border-border bg-surface-raised px-3 shadow-sm"
    >
      <RequestMethodBadge request={selected} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{selected.name}</span>
        <span className="mt-0.5 block truncate text-[11px] text-ink-muted">
          {context.get(selected.id)} · {requestPath(selected)}
        </span>
      </span>
    </div>
  )
}

/** Searchable request list. It can consume a paged server query when the backend is wired. */
export const RequestSearchList = ({
  value,
  onValueChange,
  requests,
  collections,
  label,
  placeholder,
  emptyLabel,
  onQueryChange,
  pageSize = 6,
  previousPageLabel = 'Previous',
  nextPageLabel = 'Next',
  pageLabel = (page, total) => `Page ${page} of ${total}`,
  columns = {
    method: 'Method',
    request: 'Request',
    collection: 'Collection',
    route: 'Route',
    selected: 'Selected',
  },
  resultCountLabel = (count) => `${count} requests`,
}: RequestSearchListProps) => {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const { context: allContext } = useRequestContext({ requests, collections })
  const filteredRequests = useMemo(() => {
    if (onQueryChange || !query.trim()) return requests

    const normalizedQuery = query.trim().toLocaleLowerCase()
    return requests.filter((request) =>
      `${requestMethod(request)} ${request.name} ${requestPath(request)} ${allContext.get(request.id)}`
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    )
  }, [allContext, onQueryChange, query, requests])
  const pageCount = Math.max(1, Math.ceil(filteredRequests.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageRequests = filteredRequests.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const { context } = useRequestContext({ requests: pageRequests, collections })

  return (
    <CommandRoot label={label} shouldFilter={false} className="text-ink">
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface-raised px-3 shadow-sm">
        <Search className="size-4 shrink-0 text-ink-subtle" />
        <CommandInput
          autoFocus
          value={query}
          onValueChange={(nextQuery) => {
            setQuery(nextQuery)
            setPage(1)
            onQueryChange?.(nextQuery)
          }}
          placeholder={placeholder}
          className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-ink-subtle"
        />
        <span className="hidden shrink-0 text-[11px] font-medium text-ink-subtle sm:inline">
          {resultCountLabel(filteredRequests.length)}
        </span>
      </div>
      <div className="mt-4 border-t border-border pt-3">
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <div className="grid grid-cols-[58px_minmax(130px,1.25fr)_minmax(130px,1fr)_minmax(110px,1fr)_28px] gap-3 border-b border-border bg-surface-sunken px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-subtle max-md:grid-cols-[52px_minmax(0,1fr)_28px]">
            <span>{columns.method}</span>
            <span>{columns.request}</span>
            <span className="max-md:hidden">{columns.collection}</span>
            <span className="max-md:hidden">{columns.route}</span>
            <span className="sr-only">{columns.selected}</span>
          </div>
          <CommandList className="max-h-[min(22rem,42vh)] overflow-y-auto">
            {!pageRequests.length ? (
              <p className="p-8 text-center text-xs text-ink-muted">{emptyLabel}</p>
            ) : null}
            {pageRequests.map((request) => (
              <CommandItem
                key={request.id}
                value={`${requestMethod(request)} ${request.name} ${requestPath(request)} ${context.get(request.id)}`}
                onSelect={() => onValueChange(request.id)}
                className={cn(
                  'grid cursor-default grid-cols-[58px_minmax(130px,1.25fr)_minmax(130px,1fr)_minmax(110px,1fr)_28px] items-center gap-3 border-b border-l-2 border-border border-l-transparent px-3 py-2.5 text-left transition-colors last:border-b-0 max-md:grid-cols-[52px_minmax(0,1fr)_28px]',
                  request.id === value
                    ? 'border-l-accent bg-accent-soft/70 text-ink'
                    : 'hover:bg-surface-hover data-[selected=true]:bg-surface-hover',
                )}
              >
                <RequestMethodBadge request={request} />
                <span className="min-w-0 truncate text-sm font-semibold">{request.name}</span>
                <span className="truncate text-xs text-ink-muted max-md:hidden">
                  {context.get(request.id) || '—'}
                </span>
                <span className="truncate font-mono text-[11px] text-ink-muted max-md:hidden">
                  {requestPath(request)}
                </span>
                {request.id === value ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Check className="size-3.5" />
                  </span>
                ) : null}
              </CommandItem>
            ))}
          </CommandList>
          {pageCount > 1 ? (
            <div className="flex items-center justify-between border-t border-border px-3 py-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="min-h-8 rounded-md px-2 text-[11px] font-semibold text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink disabled:pointer-events-none disabled:opacity-45"
              >
                {previousPageLabel}
              </button>
              <p className="text-[11px] text-ink-muted">{pageLabel(currentPage, pageCount)}</p>
              <button
                type="button"
                disabled={currentPage === pageCount}
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                className="min-h-8 rounded-md px-2 text-[11px] font-semibold text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink disabled:pointer-events-none disabled:opacity-45"
              >
                {nextPageLabel}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </CommandRoot>
  )
}
