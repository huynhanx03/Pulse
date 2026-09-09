import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { App } from '@/app/App'
import { i18n } from '@/lib/i18n/i18n'
import { usePulseStore } from '@/state/pulse-store'

beforeEach(async () => {
  usePulseStore.getState().resetWorkspace()
  usePulseStore.getState().setLocale('vi')
  await i18n.changeLanguage('vi')
  window.history.replaceState({}, '', '/')
})

afterEach(() => {
  cleanup()
  usePulseStore.getState().resetWorkspace()
  window.history.replaceState({}, '', '/')
})

describe('Pulse shell', () => {
  it('renders a localized application shell with primary navigation', async () => {
    render(<App />)

    expect(await screen.findByRole('main')).toBeInTheDocument()
    // jsdom does not apply the responsive CSS that toggles these two variants.
    expect(screen.getAllByRole('navigation', { name: /điều hướng chính/i })).toHaveLength(2)
    expect(await screen.findByRole('button', { name: /gửi yêu cầu/i })).toBeInTheDocument()
  })

  it('opens every primary workspace section from the mobile more menu', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /^Thêm$/ }))

    expect(screen.getByRole('dialog', { name: /thêm/i })).toBeVisible()
    expect(screen.getByRole('link', { name: /biến/i })).toBeVisible()
    expect(screen.getByRole('link', { name: /dữ liệu/i })).toBeVisible()
    expect(screen.getByRole('link', { name: /lịch chạy/i })).toBeVisible()
    expect(screen.getByRole('link', { name: /runner/i })).toBeVisible()
  })
})
