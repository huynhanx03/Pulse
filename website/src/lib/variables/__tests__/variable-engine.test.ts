import { resolveTemplate } from '@/lib/variables/variable-engine'

describe('variable engine', () => {
  it('resolves by precedence and returns a complete trace', () => {
    const result = resolveTemplate('Bearer {{token}} · {{tenant}}', [
      { scope: 'environment', values: { token: 'environment-token', tenant: 'core' } },
      { scope: 'iteration', values: { token: 'iteration-token' } },
    ])

    expect(result.value).toBe('Bearer iteration-token · core')
    expect(result.trace.find((entry) => entry.key === 'token')?.scope).toBe('iteration')
    expect(result.unresolved).toEqual([])
  })
})
