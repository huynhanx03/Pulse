import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import VariablesPage from '@/features/variables/VariablesPage'
import { i18n } from '@/lib/i18n/i18n'
import { usePulseStore } from '@/state/pulse-store'

describe('environment variable editor', () => {
  beforeEach(async () => {
    usePulseStore.getState().resetWorkspace()
    await i18n.changeLanguage('en')
  })
  afterEach(() => cleanup())

  it('edits a value in the active environment only', async () => {
    const user = userEvent.setup()
    render(<VariablesPage />)
    const value = screen.getAllByRole('textbox', { name: 'Value' })[0]!
    await user.clear(value)
    await user.type(value, 'https://changed.internal')
    expect(usePulseStore.getState().data.environments[0]?.variables[0]?.value).not.toBe(
      'https://changed.internal',
    )
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(usePulseStore.getState().data.environments[0]?.variables[0]?.value).toBe(
      'https://changed.internal',
    )
    expect(usePulseStore.getState().data.environments[1]?.variables[0]?.value).toBe(
      'http://localhost:8080',
    )
  })

  it('edits a non-active environment without changing the request execution context', async () => {
    const user = userEvent.setup()
    render(<VariablesPage />)
    await user.click(screen.getByRole('button', { name: /Local/ }))
    await user.click(screen.getByRole('button', { name: 'Add variable' }))
    expect(usePulseStore.getState().data.activeEnvironmentId).toBe('env-staging')
    expect(usePulseStore.getState().data.environments[1]?.variables.at(-1)?.key).not.toBe('')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(usePulseStore.getState().data.environments[1]?.variables.at(-1)?.key).toBe('')
  })

  it('creates a blank environment for editing without making it active', async () => {
    const user = userEvent.setup()
    render(<VariablesPage />)
    await user.click(screen.getByRole('button', { name: 'Create environment' }))
    await user.type(screen.getByRole('textbox', { name: 'Environment name' }), 'QA')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(usePulseStore.getState().data.activeEnvironmentId).toBe('env-staging')
    expect(usePulseStore.getState().data.environments.at(-1)).toMatchObject({
      name: 'QA',
      variables: [],
    })
    expect(screen.getByRole('heading', { name: 'QA' })).toBeInTheDocument()
  })
})
