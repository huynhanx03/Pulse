import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import type { HttpExecutionResult, RequestExecution, RunRecord } from '@/domain/types'
import HistoryPage from '@/features/history/HistoryPage'
import { i18n } from '@/lib/i18n/i18n'
import { usePulseStore } from '@/state/pulse-store'

const createHttpResult = ({
  id,
  requestId,
  status,
  statusText,
  size,
  duration,
  tests,
}: {
  id: string
  requestId: string
  status: number
  statusText: string
  size: number
  duration: number
  tests: HttpExecutionResult['tests']
}): HttpExecutionResult => ({
  id,
  requestId,
  status,
  statusText,
  size,
  body: { ok: status < 400 },
  rawBody: JSON.stringify({ ok: status < 400 }),
  headers: [{ key: 'content-type', value: 'application/json' }],
  cookies: [],
  tests,
  console: [],
  timings: {
    queued: 1,
    dns: 1,
    connect: 1,
    tls: 1,
    upload: 1,
    ttfb: Math.max(1, duration - 6),
    download: 1,
    total: duration,
  },
  redirects: [],
})

const executions: RequestExecution[] = [
  {
    id: 'execution-login',
    requestId: 'req-login',
    requestName: 'Login',
    protocol: 'http',
    scenario: 'success',
    startedAt: '2026-09-03T01:00:00.000Z',
    duration: 120,
    status: 200,
    statusText: 'OK',
    environmentId: 'env-staging',
    environmentName: 'Staging',
    http: createHttpResult({
      id: 'response-login',
      requestId: 'req-login',
      status: 200,
      statusText: 'OK',
      size: 1024,
      duration: 120,
      tests: [
        { name: 'status', passed: true, detail: '200' },
        { name: 'token', passed: true, detail: 'present' },
      ],
    }),
  },
  {
    id: 'execution-profile',
    requestId: 'req-profile',
    requestName: 'Get profile',
    protocol: 'http',
    scenario: 'unauthorized',
    startedAt: '2026-09-03T01:01:00.000Z',
    duration: 80,
    status: 401,
    statusText: 'Unauthorized',
    environmentId: 'env-staging',
    environmentName: 'Staging',
    http: createHttpResult({
      id: 'response-profile',
      requestId: 'req-profile',
      status: 401,
      statusText: 'Unauthorized',
      size: 256,
      duration: 80,
      tests: [{ name: 'status', passed: false, detail: 'expected 200' }],
    }),
  },
  {
    id: 'execution-watch',
    requestId: 'req-grpc-profile',
    requestName: 'Watch profiles',
    protocol: 'grpc',
    scenario: 'deadline',
    startedAt: '2026-09-03T01:02:00.000Z',
    duration: 50,
    status: 4,
    statusText: 'DEADLINE_EXCEEDED',
    environmentId: 'env-local',
    environmentName: 'Local',
    grpc: {
      status: 4,
      statusName: 'DEADLINE_EXCEEDED',
      duration: 50,
      messages: [
        { id: 'message-1', direction: 'outbound', atMs: 1, payload: '{}' },
        { id: 'message-2', direction: 'inbound', atMs: 20, payload: '{}' },
      ],
      headers: [{ key: 'content-type', value: 'application/grpc' }],
      trailers: [{ key: 'grpc-status', value: '4' }],
    },
  },
]

const runs: RunRecord[] = [
  {
    id: 'run-race',
    name: 'Create order · race',
    requestId: 'req-create-order',
    mode: 'race',
    startedAt: '2026-09-03T01:03:00.000Z',
    durationSeconds: 15,
    workers: 8,
    targetRate: 0,
    seed: 42,
    environmentId: 'env-staging',
    environmentName: 'Staging',
    status: 'passed',
    trace: {
      target: {
        name: 'Create order',
        protocol: 'http',
        operation: 'POST',
        endpoint: 'https://api.staging.internal/v1/orders',
      },
      estimatedIterations: 8,
    },
    result: {
      metrics: {
        total: 8,
        passed: 7,
        failures: 1,
        dropped: 0,
        throughput: 12,
        p50: 50,
        p95: 80,
        p99: 90,
        collisionRate: 0.125,
      },
      checks: [{ name: 'Status is successful', passed: 7, failed: 1 }],
      collisions: [{ resource: 'order:42', attempts: 8, winners: 7, conflicts: 1 }],
      iterations: [
        {
          label: 'Attempt 1',
          status: 201,
          duration: 50,
          passed: true,
          checks: [{ name: 'Status is successful', passed: true }],
          input: '{"sku":"SKU-1"}',
        },
      ],
      series: [{ second: 1, throughput: 12, p95: 80, errors: 1, active: 8, dropped: 0 }],
    },
  },
]

const renderPage = () => {
  render(
    <MemoryRouter initialEntries={['/w/ws-core/runs']}>
      <HistoryPage />
    </MemoryRouter>,
  )
  return userEvent.setup()
}

describe('execution history', () => {
  beforeEach(async () => {
    usePulseStore.getState().resetWorkspace()
    usePulseStore.getState().setLocale('en')
    await i18n.changeLanguage('en')
    usePulseStore.setState((state) => ({
      data: { ...state.data, executions, runs },
    }))
  })

  afterEach(() => {
    cleanup()
    usePulseStore.getState().resetWorkspace()
  })

  it('keeps advanced filters collapsed and does not expose a run action', () => {
    renderPage()

    expect(screen.getByRole('button', { name: 'Filters' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByRole('combobox', { name: 'Protocol' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start run' })).not.toBeInTheDocument()
  })

  it('translates shared protocol-evidence labels instead of rendering their keys', async () => {
    expect(i18n.t('runner.protocolDetails')).toBe('Protocol details')
    expect(i18n.t('runner.requestHeaders')).toBe('Request headers')
    expect(i18n.t('runner.responseHeaders')).toBe('Response headers')

    await i18n.changeLanguage('vi')
    expect(i18n.t('runner.protocolDetails')).toBe('Chi tiết giao thức')
    expect(i18n.t('runner.requestHeaders')).toBe('Header gửi đi')
    expect(i18n.t('runner.responseHeaders')).toBe('Header phản hồi')
  })

  it('opens the compact filter drawer with all execution filter controls', async () => {
    const user = renderPage()

    await user.click(screen.getByRole('button', { name: 'Filters' }))

    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Protocol' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Environment' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Filter by date' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument()
  })

  it('paginates the evidence table', async () => {
    usePulseStore.setState((state) => ({
      data: {
        ...state.data,
        executions: Array.from({ length: 11 }, (_, index) => ({
          ...executions[0]!,
          id: `execution-page-${index + 1}`,
          requestName: `Request ${index + 1}`,
          startedAt: `2026-09-03T01:${String(index).padStart(2, '0')}:00.000Z`,
        })),
      },
    }))
    const user = renderPage()

    expect(screen.getByText('1–10 of 11')).toBeInTheDocument()
    expect(screen.queryByText('Request 11')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('11–11 of 11')).toBeInTheDocument()
    expect(screen.getByText('Request 11')).toBeInTheDocument()

    expect(screen.getByRole('combobox', { name: 'Rows per page' })).toHaveTextContent('10')
  })

  it('selects at most two executions and compares their response summaries', async () => {
    const user = renderPage()
    const login = screen.getByRole('checkbox', { name: /Select execution Login/ })
    const profile = screen.getByRole('checkbox', { name: /Select execution Get profile/ })
    const watch = screen.getByRole('checkbox', { name: /Select execution Watch profiles/ })

    await user.click(login)
    await user.click(profile)

    expect(screen.getByRole('button', { name: 'Compare 2/2' })).toBeEnabled()
    expect(watch).toBeDisabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Compare 2/2' }))

    const comparison = screen.getByRole('dialog', { name: 'Compare executions' })
    expect(within(comparison).getAllByText('200 OK')).not.toHaveLength(0)
    expect(within(comparison).getAllByText('401 Unauthorized')).not.toHaveLength(0)
    expect(within(comparison).getByText('1 KB')).toBeInTheDocument()
    expect(within(comparison).getByText('256 B')).toBeInTheDocument()
    expect(within(comparison).queryByText('2 / 2')).not.toBeInTheDocument()
    expect(within(comparison).queryByText('0 / 1')).not.toBeInTheDocument()
    expect(within(comparison).getAllByText('POST')).not.toHaveLength(0)
    expect(within(comparison).getAllByText('GET')).not.toHaveLength(0)

    await user.click(within(comparison).getAllByRole('button', { name: 'Close' }).at(-1)!)
    await user.click(login)
    expect(screen.queryByRole('heading', { name: 'Compare executions' })).not.toBeInTheDocument()
    expect(watch).toBeEnabled()

    await user.click(watch)
    await user.click(screen.getByRole('button', { name: 'Compare 2/2' }))
    expect(screen.getByRole('note')).toHaveTextContent(
      'Protocol-specific response fields cannot be compared directly.',
    )
  })

  it('opens captured request details from a history row', async () => {
    const user = renderPage()

    await user.click(screen.getByRole('checkbox', { name: /Select execution Login/ }))
    expect(screen.queryByRole('dialog', { name: 'Login' })).not.toBeInTheDocument()

    await user.click(screen.getByText('Login'))

    const dialog = screen.getByRole('dialog', { name: 'Login' })
    expect(within(dialog).getByText('Captured request and response evidence')).toBeInTheDocument()
    expect(within(dialog).getAllByText('200 OK')).toHaveLength(1)
    expect(within(dialog).getByText(/1 KB/)).toBeInTheDocument()
    expect(within(dialog).getByText('Checks')).toBeInTheDocument()
    expect(within(dialog).getByText('Protocol details')).toBeInTheDocument()
    expect(within(dialog).getAllByRole('button', { name: 'Copy' }).length).toBeGreaterThan(0)
    expect(within(dialog).queryByText('History details')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Response details')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open as draft' })).not.toBeInTheDocument()
  })

  it('keeps gRPC trace evidence open and copyable in the captured request detail', async () => {
    const user = renderPage()

    await user.click(screen.getByText('Watch profiles'))

    const dialog = screen.getByRole('dialog', { name: 'Watch profiles' })
    expect(within(dialog).getByText('Protocol details')).toBeInTheDocument()
    expect(within(dialog).getByText('Response headers')).toBeInTheDocument()
    expect(within(dialog).getByText('Trailers')).toBeInTheDocument()
    expect(within(dialog).getByText('Messages')).toBeInTheDocument()
    expect(within(dialog).getAllByRole('button', { name: 'Copy' }).length).toBeGreaterThan(1)
  })

  it('keeps test-run configuration, checks, and immutable evidence together', async () => {
    const user = renderPage()

    await user.click(screen.getByRole('tab', { name: /Test runs/ }))
    await user.click(screen.getByText('Create order · race'))

    const dialog = screen.getByRole('dialog', { name: 'Create order' })
    expect(
      within(dialog).getByText('Captured configuration and performance evidence'),
    ).toBeVisible()
    expect(within(dialog).getByText('Run plan')).toBeInTheDocument()
    expect(within(dialog).getByText('Checks')).toBeInTheDocument()
    expect(within(dialog).getByText('Status is successful')).toBeInTheDocument()
    expect(within(dialog).getByText('Run result')).toBeInTheDocument()
    expect(within(dialog).getByText('Performance')).toBeInTheDocument()
    expect(within(dialog).getByText('Race collisions')).toBeInTheDocument()
    expect(within(dialog).getByText('Iteration results')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  })
})
