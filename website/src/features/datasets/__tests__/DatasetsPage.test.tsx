import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'

import DatasetsPage from '@/features/datasets/DatasetsPage'
import { i18n } from '@/lib/i18n/i18n'
import { usePulseStore } from '@/state/pulse-store'

const Subject = () => {
  const location = useLocation()
  return (
    <>
      <DatasetsPage />
      <output aria-label="Current route">{location.pathname}</output>
    </>
  )
}
const renderPage = () => {
  render(
    <MemoryRouter initialEntries={['/w/ws-core/datasets']}>
      <Subject />
    </MemoryRouter>,
  )
  return userEvent.setup()
}

describe('Data Profile controls', () => {
  beforeEach(async () => {
    usePulseStore.getState().resetWorkspace()
    await i18n.changeLanguage('en')
  })
  afterEach(cleanup)

  it('creates a profile immediately and saves later schema edits', async () => {
    const user = renderPage()
    const initialProfileCount = usePulseStore.getState().data.datasets.length
    await user.click(screen.getByRole('button', { name: 'New profile' }))
    expect(usePulseStore.getState().data.datasets).toHaveLength(initialProfileCount + 1)
    expect(screen.queryByText('Draft')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add field' }))
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(usePulseStore.getState().data.datasets.at(-1)?.columns).toHaveLength(2)
  })

  it('generates a copyable sample without navigating away', async () => {
    const user = renderPage()
    await user.click(screen.getByRole('button', { name: 'Generate sample' }))
    expect(screen.getByText('Generated sample')).toBeInTheDocument()
  })

  it('filters the visible schema fields from the editor toolbar', async () => {
    const user = renderPage()

    await user.type(screen.getByRole('textbox', { name: 'Search fields…' }), 'buyer')

    expect(screen.getByDisplayValue('buyer_email')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('customer_id')).not.toBeInTheDocument()
  })
})
