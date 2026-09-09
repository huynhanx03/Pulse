import { createSafeRequestSnapshot, redactSensitiveData } from '@/lib/security/redaction'
import { createDemoWorkspace } from '@/mocks/fixtures/demo-workspace'

describe('secret redaction', () => {
  it('redacts secret keys inside serialized JSON used by reports and raw history', () => {
    const serialized = JSON.stringify({
      password: 'diagnostic-password-Q7',
      data: { apiKey: 'hidden-key', quantity: 5 },
    })
    const redacted = redactSensitiveData(serialized) as string
    expect(JSON.parse(redacted)).toEqual({
      password: '[redacted]',
      data: { apiKey: '[redacted]', quantity: 5 },
    })
    expect(redactSensitiveData('{invalid-json')).toBe('{invalid-json')
  })
  it('redacts credentials recursively while preserving non-sensitive diagnostics', () => {
    expect(
      redactSensitiveData({
        ok: true,
        data: {
          accessToken: 'access-demo',
          refresh_token: 'refresh-demo',
          profile: { id: 'usr_01', password: 'never-persist-me' },
        },
      }),
    ).toEqual({
      ok: true,
      data: {
        accessToken: '[redacted]',
        refresh_token: '[redacted]',
        profile: { id: 'usr_01', password: '[redacted]' },
      },
    })
  })

  it('redacts credentials embedded inside console messages', () => {
    expect(redactSensitiveData('Attaching Bearer eyJhbGciOiJ.demo.signature')).toBe(
      'Attaching Bearer [redacted]',
    )
    expect(redactSensitiveData('refresh=pulse-refresh-demo-internal')).toBe('refresh=[redacted]')
  })

  it('keeps request snapshot field types valid while removing credentials', () => {
    const request = structuredClone(createDemoWorkspace().requests[0]!)
    request.auth.token = 'secret-token'
    request.headers.push({
      id: 'secret-header',
      enabled: true,
      key: 'x-internal-key',
      value: 'secret-header-value',
      description: '',
      secret: true,
    })

    const snapshot = createSafeRequestSnapshot(request)

    expect(snapshot.auth.token).toBe('')
    expect(snapshot.headers.at(-1)).toMatchObject({ secret: true, value: '' })
    expect(typeof snapshot.headers.at(-1)?.secret).toBe('boolean')
  })
})
