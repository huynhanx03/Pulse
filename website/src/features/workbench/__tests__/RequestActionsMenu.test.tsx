import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'

import { RequestActionsMenu } from '@/features/workbench/RequestActionsMenu'
import { i18n } from '@/lib/i18n/i18n'
import { usePulseStore } from '@/state/pulse-store'

const Subject = ({ requestId }: { requestId: string }) => {
  const request = usePulseStore((state) =>
    state.data.requests.find((entry) => entry.id === requestId),
  )
  const location = useLocation()

  return (
    <main id="main-content" tabIndex={-1}>
      {request ? <RequestActionsMenu request={request} /> : null}
      <output aria-label="Current route">{location.pathname}</output>
    </main>
  )
}

const renderMenu = (requestId = 'req-login') => {
  const request = usePulseStore.getState().data.requests.find((entry) => entry.id === requestId)!
  const segment = request.protocol === 'grpc' ? 'grpc' : 'request'
  render(
    <MemoryRouter initialEntries={[`/w/ws-core/${segment}/${requestId}`]}>
      <Subject requestId={requestId} />
    </MemoryRouter>,
  )
  return userEvent.setup()
}

const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  screen.getByRole('button', { name: 'More actions' }).focus()
  await user.keyboard('{Enter}')
  return screen.findByRole('menu')
}

describe('Request actions', () => {
  beforeEach(async () => {
    usePulseStore.getState().resetWorkspace()
    await i18n.changeLanguage('en')
  })

  afterEach(cleanup)

  it('rejects blank names and saves a trimmed rename', async () => {
    const user = renderMenu()
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }))

    const dialog = await screen.findByRole('dialog', { name: 'Edit' })
    const name = within(dialog).getByRole('textbox', { name: 'Name' })
    expect(name).toHaveFocus()
    expect(name).toHaveValue('Login')

    await user.clear(name)
    await user.type(name, '   ')
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.clear(name)
    await user.type(name, '  Login v2  ')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(
      usePulseStore.getState().data.requests.find((request) => request.id === 'req-login'),
    ).toMatchObject({ name: 'Login v2', dirty: false })
    await waitFor(() => expect(screen.getByRole('button', { name: 'More actions' })).toHaveFocus())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not delete a request when its confirmation is cancelled', async () => {
    const user = renderMenu()
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))

    const dialog = await screen.findByRole('alertdialog', { name: 'Delete' })
    expect(
      usePulseStore.getState().data.requests.some((request) => request.id === 'req-login'),
    ).toBe(true)
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(
      usePulseStore.getState().data.requests.some((request) => request.id === 'req-login'),
    ).toBe(true)
    expect(screen.getByRole('status', { name: 'Current route' })).toHaveTextContent(
      '/w/ws-core/request/req-login',
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'More actions' })).toHaveFocus())
  })

  it('deletes only after confirmation and navigates to the remaining active gRPC request', async () => {
    usePulseStore.getState().selectRequest('req-grpc-profile')
    usePulseStore.getState().selectRequest('req-login')
    const user = renderMenu()
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(
      usePulseStore.getState().data.requests.some((request) => request.id === 'req-login'),
    ).toBe(false)
    expect(screen.getByRole('status', { name: 'Current route' })).toHaveTextContent(
      '/w/ws-core/grpc/req-grpc-profile',
    )
  })

  it('navigates home when deleting the final request', async () => {
    const ids = usePulseStore.getState().data.requests.map((request) => request.id)
    for (const id of ids) {
      if (id !== 'req-login') usePulseStore.getState().deleteRequest(id)
    }
    const user = renderMenu()
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(usePulseStore.getState().data.requests).toHaveLength(0)
    expect(screen.getByRole('status', { name: 'Current route' })).toHaveTextContent(/^\/$/)
  })

  it.each([
    { requestId: 'req-login', name: 'Login (copy)', segment: 'request' },
    { requestId: 'req-grpc-profile', name: 'Watch profiles (copy)', segment: 'grpc' },
  ])('opens the duplicated $segment request', async ({ requestId, name, segment }) => {
    const user = renderMenu(requestId)
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }))

    const data = usePulseStore.getState().data
    const copy = data.requests.find((request) => request.id === data.activeRequestId)!
    expect(copy.id).not.toBe(requestId)
    expect(copy.name).toBe(name)
    expect(screen.getByRole('status', { name: 'Current route' })).toHaveTextContent(
      `/w/ws-core/${segment}/${copy.id}`,
    )
  })

  it('reflects pin changes and omits actions without callbacks', async () => {
    const user = renderMenu()
    const menu = await openMenu(user)
    expect(within(menu).queryByRole('menuitem', { name: 'Import cURL' })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: 'Generate code' })).not.toBeInTheDocument()
    await user.click(within(menu).getByRole('menuitem', { name: 'Unpin tab' }))
    expect(
      usePulseStore.getState().data.openTabs.find((tab) => tab.requestId === 'req-login')?.pinned,
    ).toBe(false)

    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: 'Pin tab' }))
    expect(
      usePulseStore.getState().data.openTabs.find((tab) => tab.requestId === 'req-login')?.pinned,
    ).toBe(true)
  })
})
