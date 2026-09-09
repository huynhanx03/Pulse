import { captureTokens, shouldRefresh } from '@/lib/auth/auth-engine'

describe('auth engine', () => {
  it('extracts login tokens and calculates the refresh window', () => {
    const captured = captureTokens(
      { data: { accessToken: 'access-demo', refreshToken: 'refresh-demo', expiresIn: 120 } },
      {
        accessTokenPath: '$.data.accessToken',
        refreshTokenPath: '$.data.refreshToken',
        expiresInPath: '$.data.expiresIn',
        expiryFormat: 'expires-in-seconds',
      },
      new Date('2026-08-30T00:00:00.000Z'),
    )

    expect(captured.accessToken).toBe('access-demo')
    expect(captured.refreshToken).toBe('refresh-demo')
    expect(shouldRefresh(captured.expiresAt, new Date('2026-08-30T00:01:35.000Z'), 30)).toBe(true)
  })

  it.each([
    ['iso-8601', '2026-08-30T00:15:00+00:00'],
    ['unix-seconds', 1788048900],
    ['unix-milliseconds', 1788048900000],
  ] as const)('normalizes an explicitly declared %s expiry', (expiryFormat, expiry) => {
    const captured = captureTokens(
      { data: { accessToken: 'access-demo', refreshToken: 'refresh-demo', expiry } },
      {
        accessTokenPath: '$.data.accessToken',
        refreshTokenPath: '$.data.refreshToken',
        expiresInPath: '$.data.expiry',
        expiryFormat,
      },
      new Date('2026-08-30T00:00:00.000Z'),
    )

    expect(captured.expiresAt.toISOString()).toBe('2026-08-30T00:15:00.000Z')
  })

  it('rejects a value that does not match the declared format instead of guessing', () => {
    expect(() =>
      captureTokens(
        { data: { accessToken: 'access-demo', refreshToken: 'refresh-demo', expiry: 1788048900 } },
        {
          accessTokenPath: '$.data.accessToken',
          refreshTokenPath: '$.data.refreshToken',
          expiresInPath: '$.data.expiry',
          expiryFormat: 'iso-8601',
        },
        new Date('2026-08-30T00:00:00.000Z'),
      ),
    ).toThrow('ISO-8601')
  })
})
