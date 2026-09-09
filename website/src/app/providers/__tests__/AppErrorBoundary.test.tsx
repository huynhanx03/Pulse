import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AppErrorBoundary } from '@/app/providers/AppErrorBoundary'
import { i18n } from '@/lib/i18n/i18n'

const PRIVATE_ERROR_DETAIL = 'PRIVATE_STACK_DETAIL_MUST_NOT_RENDER'

const BrokenFeature = () => {
  throw new Error(PRIVATE_ERROR_DETAIL)
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('offers English reset and reload actions without exposing the error', async () => {
    await i18n.changeLanguage('en')
    const user = userEvent.setup()
    const onResetWorkspace = vi.fn()
    const onReload = vi.fn()

    render(
      <AppErrorBoundary onReload={onReload} onResetWorkspace={onResetWorkspace}>
        <BrokenFeature />
      </AppErrorBoundary>,
    )

    const recovery = screen.getByRole('alert')
    expect(recovery).toHaveTextContent('Pulse needs a safe restart')
    expect(recovery).not.toHaveTextContent(PRIVATE_ERROR_DETAIL)

    await user.click(screen.getByRole('button', { name: 'Reset workspace' }))
    expect(onResetWorkspace).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Reload Pulse' }))
    expect(onReload).toHaveBeenCalledOnce()
  })

  it('renders the recovery interface in Vietnamese', async () => {
    await i18n.changeLanguage('vi')

    render(
      <AppErrorBoundary onResetWorkspace={vi.fn()}>
        <BrokenFeature />
      </AppErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Pulse cần khởi động lại an toàn')
    expect(screen.getByRole('button', { name: 'Đặt lại workspace' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Tải lại Pulse' })).toBeEnabled()
  })

  it('renders children unchanged while the application is healthy', () => {
    render(
      <AppErrorBoundary onResetWorkspace={vi.fn()}>
        <main>Workbench ready</main>
      </AppErrorBoundary>,
    )

    expect(screen.getByRole('main')).toHaveTextContent('Workbench ready')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
