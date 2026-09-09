import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import type { SimulatedRun } from '@/domain/runner/types'
import TestLabPage from '@/features/test-lab/TestLabPage'
import { i18n } from '@/lib/i18n/i18n'
import { usePulseStore } from '@/state/pulse-store'

const emptyRun: SimulatedRun = {
  metrics: {
    total: 0,
    passed: 0,
    failures: 0,
    dropped: 0,
    throughput: 0,
    p50: 0,
    p95: 0,
    p99: 0,
    collisionRate: 0,
  },
  series: [],
  checks: [],
  collisions: [],
  iterations: [],
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <TestLabPage />
    </MemoryRouter>,
  )

describe('Test Lab terminal states', () => {
  beforeEach(async () => {
    usePulseStore.getState().resetWorkspace()
    await i18n.changeLanguage('en')
  })

  afterEach(cleanup)

  it('renders a failed run as an alert without fabricating results', () => {
    usePulseStore.setState({ runState: 'failed', activeRunResult: null })

    renderPage()

    expect(screen.getByRole('alert')).toHaveTextContent('The run could not finish')
    expect(screen.queryByText('The run produced no results')).not.toBeInTheDocument()
  })

  it('keeps Live metrics visible before and after a zero-result run', () => {
    renderPage()

    expect(screen.getByText('Live metrics')).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()

    cleanup()
    usePulseStore.setState({ runState: 'complete', runProgress: 100, activeRunResult: emptyRun })

    renderPage()

    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows only the configuration that belongs to the selected run model', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Change target' }))
    expect(screen.getByLabelText('Concurrent attempts')).toBeInTheDocument()
    expect(screen.queryByLabelText('Duration')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getByRole('button', { name: /Ramping VUs/i }))
    await user.click(screen.getByRole('button', { name: 'Change target' }))

    expect(screen.getByLabelText('Peak VUs')).toBeInTheDocument()
    expect(screen.getByLabelText('Ramp up')).toBeInTheDocument()
    expect(screen.getByLabelText('Hold')).toBeInTheDocument()
    expect(screen.getByLabelText('Ramp down')).toBeInTheDocument()
    expect(screen.queryByLabelText('Concurrent attempts')).not.toBeInTheDocument()
  })

  it('keeps the run seed in shared Test Lab controls', () => {
    renderPage()

    expect(screen.getByLabelText('Seed')).toBeInTheDocument()
    expect(screen.queryByText('Preflight')).not.toBeInTheDocument()
    expect(screen.queryByText('Run plan')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Run History' })).not.toBeInTheDocument()
  })

  it('stages target edits in the dialog and commits them only on Save', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Change target' }))
    await user.type(screen.getByRole('combobox', { name: 'Target' }), 'profile')

    await user.click(screen.getByText('Get profile'))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByLabelText('Target')).toHaveTextContent('Create order')

    await user.click(screen.getByRole('button', { name: 'Change target' }))
    await user.type(screen.getByRole('combobox', { name: 'Target' }), 'profile')
    await user.click(screen.getByText('Get profile'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByLabelText('Target')).toHaveTextContent('GET')
    expect(screen.getByLabelText('Target')).toHaveTextContent('Get profile')
  })
})
