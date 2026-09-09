import { executeHttpRequest } from '@/mocks/simulators/http-simulator'

describe('HTTP mock engine', () => {
  const input = {
    requestId: 'req-create-order',
    scenario: 'success' as const,
    method: 'POST',
    url: 'https://demo.internal/orders',
    body: '{"quantity": 4, "customer_id": "c9"}',
    seed: 42,
  }

  it('reflects the configured order data in the simulated response', async () => {
    expect((await executeHttpRequest(input)).body).toMatchObject({
      data: { quantity: 4, customer_id: 'c9', total: 996_000 },
    })
  })

  it('enforces request timeout and does not invent a response body', async () => {
    const response = await executeHttpRequest({ ...input, timeoutMs: 1 })
    expect(response).toMatchObject({ status: 0, errorCode: 'ETIMEDOUT', rawBody: '' })
    expect(response.timings.total).toBe(1)
  })

  it('stops at a redirect when follow redirects is disabled', async () => {
    const response = await executeHttpRequest({
      ...input,
      scenario: 'redirect',
      followRedirects: false,
    })
    expect(response.status).toBe(302)
    expect(response.headers.some((header) => header.key === 'location')).toBe(true)
  })

  it('marks an explicitly unverified TLS session', async () => {
    const response = await executeHttpRequest({ ...input, scenario: 'tls-error', verifyTls: false })
    expect(response.status).toBe(200)
    expect(response.tls?.verified).toBe(false)
  })

  it('returns no body for a HEAD request', async () => {
    expect(await executeHttpRequest({ ...input, method: 'HEAD' })).toMatchObject({
      rawBody: '',
      size: 0,
    })
  })

  it('reports malformed JSON as a failed parser check', async () => {
    const response = await executeHttpRequest({ ...input, scenario: 'malformed' })
    expect(response.tests.some((check) => !check.passed)).toBe(true)
  })

  it('models empty and binary payloads explicitly', async () => {
    const empty = await executeHttpRequest({ ...input, scenario: 'empty' })
    const binary = await executeHttpRequest({ ...input, scenario: 'binary' })

    expect(empty).toMatchObject({ status: 204, rawBody: '', body: null })
    expect(binary.headers).toContainEqual({
      key: 'content-type',
      value: 'application/octet-stream',
    })
    expect(binary.rawBody).toContain('PNG')
  })

  it('returns deterministic diagnostics for a successful login', async () => {
    const response = await executeHttpRequest({
      requestId: 'req-login',
      scenario: 'success',
      method: 'POST',
      url: 'https://staging.internal.example/v1/auth/login',
      body: '{"email":"dev@pulse.local"}',
      seed: 42,
    })

    expect(response.status).toBe(200)
    expect(response.timings.total).toBeGreaterThan(response.timings.ttfb)
    expect(response.tls?.version).toBe('TLS 1.3')
    expect(response.body).toMatchObject({ ok: true })
  })
})
