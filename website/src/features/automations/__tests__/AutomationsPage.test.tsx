import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import AutomationsPage from '@/features/automations/AutomationsPage'
import { i18n } from '@/lib/i18n/i18n'
import { usePulseStore } from '@/state/pulse-store'

describe('Scheduled runs', () => {
  beforeEach(async () => {
    usePulseStore.getState().resetWorkspace()
    await i18n.changeLanguage('en')
  })

  afterEach(() => {
    cleanup()
    usePulseStore.getState().resetWorkspace()
  })

  it('keeps the schedule workspace-scoped without a separate Environment setting', () => {
    render(<AutomationsPage />)

    expect(usePulseStore.getState().data.schedules[0]).not.toHaveProperty('environmentId')
    expect(screen.queryByText(/execution context/i)).not.toBeInTheDocument()
  })

  it('keeps edits as a draft until Save changes', async () => {
    const user = userEvent.setup()
    render(<AutomationsPage />)

    await user.click(screen.getByRole('button', { name: 'Rename schedule' }))
    const name = screen.getByRole('textbox', { name: 'Schedule name' })
    await user.clear(name)
    await user.type(name, 'Refresh session')
    await user.click(screen.getByRole('button', { name: 'Save name' }))

    expect(usePulseStore.getState().data.schedules[0]?.name).toBe('Keep connection')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(usePulseStore.getState().data.schedules[0]?.name).toBe('Refresh session')
  })

  it('creates a generic disabled schedule without changing workspace state', async () => {
    const user = userEvent.setup()
    render(<AutomationsPage />)
    await user.click(screen.getByRole('button', { name: 'New schedule' }))

    expect(usePulseStore.getState().data.schedules).toHaveLength(2)
    expect(usePulseStore.getState().data.schedules[1]?.enabled).toBe(false)
    expect(usePulseStore.getState().data.activeEnvironmentId).toBe('env-staging')
  })
})
