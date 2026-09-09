import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { App } from '@/app/App'
import { ActivityRail } from '@/app/layout/ActivityRail'
import { usePulseStore } from '@/state/pulse-store'

const deleteAllRequests = () => {
  for (const request of usePulseStore.getState().data.requests)
    usePulseStore.getState().deleteRequest(request.id)
}

beforeEach(() => {
  usePulseStore.getState().resetWorkspace()
  usePulseStore.getState().setLocale('en')
  window.history.replaceState({}, '', '/')
})

afterEach(() => {
  cleanup()
  usePulseStore.getState().resetWorkspace()
  window.history.replaceState({}, '', '/')
})

describe('workspace root routing', () => {
  it('keeps workspace chrome out of tool routes so their content gets the available width', async () => {
    window.history.replaceState({}, '', '/w/ws-core/runner')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Test Lab' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Explorer' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('separator', { name: 'Resize workspace explorer' }),
    ).not.toBeInTheDocument()
  })

  it('opens the active HTTP request after the seeded login has been deleted', async () => {
    usePulseStore.getState().deleteRequest('req-login')
    usePulseStore.getState().selectRequest('req-create-order')
    render(<App />)

    await waitFor(() =>
      expect(window.location.pathname).toBe('/w/ws-core/request/req-create-order'),
    )
    expect(await screen.findByRole('button', { name: 'Send request' })).toBeInTheDocument()
  })

  it('opens the active gRPC request with the gRPC route', async () => {
    usePulseStore.getState().deleteRequest('req-login')
    usePulseStore.getState().selectRequest('req-grpc-profile')
    render(<App />)

    await waitFor(() => expect(window.location.pathname).toBe('/w/ws-core/grpc/req-grpc-profile'))
    expect(await screen.findByRole('main')).toBeInTheDocument()
  })

  it('falls back to the first existing request when the active ID no longer exists', async () => {
    usePulseStore.getState().deleteRequest('req-login')
    usePulseStore.setState((state) => ({
      data: { ...state.data, activeRequestId: 'deleted-request' },
    }))
    usePulseStore.getState().saveRequest('deleted-request')
    render(<App />)

    await waitFor(() => expect(window.location.pathname).toBe('/w/ws-core/request/req-profile'))
    expect(await screen.findByRole('button', { name: 'Send request' })).toBeInTheDocument()
  })

  it('shows create actions inside the application shell when no requests remain', async () => {
    deleteAllRequests()
    render(<App />)

    const main = await screen.findByRole('main')
    expect(
      await within(main).findByRole('heading', { name: 'Start with your first request' }),
    ).toBeInTheDocument()
    expect(within(main).getByRole('button', { name: 'Create HTTP request' })).toBeInTheDocument()
    expect(within(main).getByRole('button', { name: 'Create gRPC request' })).toBeInTheDocument()
    expect(screen.getAllByRole('navigation', { name: 'Primary navigation' })).toHaveLength(2)
    expect(window.location.pathname).toBe('/')
  })

  it.each([
    {
      protocol: 'http' as const,
      label: 'Create HTTP request',
      name: 'Untitled HTTP request',
      route: 'request',
    },
    {
      protocol: 'grpc' as const,
      label: 'Create gRPC request',
      name: 'Untitled gRPC request',
      route: 'grpc',
    },
  ])(
    'creates and opens the first $protocol request from the empty state',
    async ({ protocol, label, name, route }) => {
      const user = userEvent.setup()
      deleteAllRequests()
      render(<App />)
      const main = await screen.findByRole('main')
      await user.click(await within(main).findByRole('button', { name: label }))

      const requests = usePulseStore.getState().data.requests
      expect(requests).toHaveLength(1)
      expect(requests[0]).toMatchObject({ protocol, name })
      await waitFor(() =>
        expect(window.location.pathname).toBe(`/w/ws-core/${route}/${requests[0]?.id}`),
      )
      expect(usePulseStore.getState().data.activeRequestId).toBe(requests[0]?.id)
    },
  )

  it('returns from an invalid route to the empty workspace without a redirect loop', async () => {
    const user = userEvent.setup()
    deleteAllRequests()
    window.history.replaceState({}, '', '/missing-page')
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Back to Workbench' }))

    expect(
      await screen.findByRole('heading', { name: 'Start with your first request' }),
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })
})

describe('request navigation after deletion', () => {
  it.each([
    { protocol: 'http' as const, seeded: 'req-login', route: 'request' },
    { protocol: 'grpc' as const, seeded: 'req-grpc-profile', route: 'grpc' },
  ])(
    'prefers the active $protocol request for the workspace rail link and mobile workbench',
    ({ protocol, seeded, route }) => {
      const createdId = usePulseStore.getState().createRequest(protocol, 'Custom request')
      usePulseStore.getState().deleteRequest(seeded)
      render(
        <MemoryRouter>
          <ActivityRail />
        </MemoryRouter>,
      )

      expect(screen.getByRole('link', { name: 'Workspace' })).toHaveAttribute(
        'href',
        `/w/ws-core/${route}/${createdId}`,
      )
      expect(screen.getByRole('link', { name: 'Workbench' })).toHaveAttribute(
        'href',
        `/w/ws-core/${route}/${createdId}`,
      )
    },
  )

  it('updates the workspace link to an existing fallback when its active request is deleted', () => {
    usePulseStore.getState().deleteRequest('req-login')
    usePulseStore.getState().selectRequest('req-create-order')
    render(
      <MemoryRouter>
        <ActivityRail />
      </MemoryRouter>,
    )

    act(() => usePulseStore.getState().deleteRequest('req-create-order'))

    expect(screen.getByRole('link', { name: 'Workspace' })).toHaveAttribute(
      'href',
      '/w/ws-core/request/req-profile',
    )
    expect(screen.getByRole('link', { name: 'Workbench' })).toHaveAttribute(
      'href',
      '/w/ws-core/request/req-profile',
    )
  })

  it('uses the valid root route when no matching request exists', () => {
    deleteAllRequests()
    render(
      <MemoryRouter>
        <ActivityRail />
      </MemoryRouter>,
    )

    for (const name of ['Workspace', 'Workbench']) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', '/')
    }
  })
})
