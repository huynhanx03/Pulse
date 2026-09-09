import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { ExplorerPanel } from '@/app/layout/ExplorerPanel'
import { i18n } from '@/lib/i18n/i18n'
import { usePulseStore } from '@/state/pulse-store'

describe('Explorer states', () => {
  beforeEach(async () => {
    usePulseStore.getState().resetWorkspace()
    await i18n.changeLanguage('en')
  })

  afterEach(cleanup)

  it('shows a recoverable filtered-empty state without a redundant request count', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ExplorerPanel />
      </MemoryRouter>,
    )

    await user.type(screen.getByRole('textbox', { name: 'Search' }), 'does-not-exist')

    expect(screen.getByRole('status')).toHaveTextContent('No requests match this filter')
    expect(screen.queryByText('4 requests')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.queryByText('No requests match this filter')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Login/ })).toBeInTheDocument()
  })

  it('collapses and restores a folder without changing its requests', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ExplorerPanel />
      </MemoryRouter>,
    )

    const usersFolder = screen.getByRole('button', { name: /^Users$/ })
    await user.click(usersFolder)
    expect(screen.queryByRole('button', { name: /Get profile/ })).not.toBeInTheDocument()

    await user.click(usersFolder)
    expect(screen.getByRole('button', { name: /Get profile/ })).toBeInTheDocument()
  })

  it('moves a request into a folder through the tree drop target', () => {
    render(
      <MemoryRouter>
        <ExplorerPanel />
      </MemoryRouter>,
    )

    const login = screen.getByRole('button', { name: /Login$/ })
    const orders = screen.getByRole('button', { name: /^Orders$/ })
    const dataTransfer = { effectAllowed: '', dropEffect: '' }

    fireEvent.dragStart(login, { dataTransfer })
    fireEvent.dragOver(orders, { dataTransfer })
    fireEvent.drop(orders, { dataTransfer })

    expect(
      usePulseStore.getState().data.requests.find((request) => request.id === 'req-login'),
    ).toMatchObject({
      collectionId: 'col-commerce',
      folderId: 'fld-commerce-order',
    })
  })

  it('creates a configured gRPC request from the scalable request-creation flow', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ExplorerPanel />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'New request' }))
    await user.click(screen.getByRole('menuitem', { name: 'New request' }))
    await user.click(screen.getByRole('radio', { name: /Create gRPC request/i }))
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Watch orders')
    await user.type(
      screen.getByRole('textbox', { name: 'gRPC endpoint' }),
      'orders.example.com:443',
    )
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(usePulseStore.getState().data.requests.at(-1)).toMatchObject({
      protocol: 'grpc',
      name: 'Watch orders',
      url: 'orders.example.com:443',
    })
  })
})
