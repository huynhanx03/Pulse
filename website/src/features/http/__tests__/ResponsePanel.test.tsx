import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ResponsePanel } from '@/features/http/components/ResponsePanel'
import type { HttpExecutionInput } from '@/domain/execution/http'
import { simulateHttpRequest } from '@/mocks/simulators/http-simulator'
import { i18n } from '@/lib/i18n/i18n'
import { usePulseStore } from '@/state/pulse-store'

const renderResponse = (patch: Partial<HttpExecutionInput> = {}) => {
  const response = simulateHttpRequest({
    requestId: 'req-login',
    method: 'POST',
    scenario: 'success',
    url: 'https://demo.internal/login',
    body: '{}',
    seed: 42,
    ...patch,
  })
  usePulseStore.setState({ lastHttpResponse: response, executionState: 'complete' })
  return { ...render(<ResponsePanel />), response }
}

describe('Response body presentation', () => {
  beforeEach(async () => {
    usePulseStore.getState().resetWorkspace()
    await i18n.changeLanguage('en')
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it.each([{ method: 'HEAD' }, { scenario: 'timeout' as const }])(
    'does not invent a null payload for an empty response: %j',
    (patch) => {
      renderResponse(patch)
      expect(screen.getByRole('heading', { name: 'Response has no body' })).toBeVisible()
    },
  )

  it('treats binary payloads as bytes and only exposes them in Hex', async () => {
    const user = userEvent.setup()
    const { container } = renderResponse({ scenario: 'binary' })
    expect(screen.getByRole('heading', { name: 'Binary response' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Hex' }))
    expect(container.querySelector('pre')?.textContent).toContain('00000000')
  })

  it('preserves invalid JSON as received instead of fabricating a parsed body', () => {
    const { container, response } = renderResponse({ scenario: 'malformed' })
    expect(container.querySelector('pre')?.textContent).toBe(response.rawBody)
  })

  it('reports a clipboard failure without showing a copied confirmation', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Clipboard blocked'))
    renderResponse()
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    await waitFor(() =>
      expect(usePulseStore.getState().toastMessage).toBe(i18n.t('errors.generic')),
    )
  })

  it('redacts token-shaped values from every body view and clipboard output', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const { container } = renderResponse()

    expect(container).not.toHaveTextContent('demo-access')
    expect(container).not.toHaveTextContent('pulse-refresh-demo-internal')
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith(expect.not.stringContaining('demo-access'))
    expect(writeText).toHaveBeenCalledWith(
      expect.not.stringContaining('pulse-refresh-demo-internal'),
    )
  })
})
