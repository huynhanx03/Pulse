import { JsonPathSyntaxError, parseJsonPath, readJsonPath } from '@/domain/auth/json-path'

const payload = {
  data: {
    'auth.token': 'access',
    items: [{ token: 'first' }],
  },
}

describe('safe JSON path grammar', () => {
  it.each([
    ['$', payload],
    ['$.data["auth.token"]', 'access'],
    ["$.data['auth.token']", 'access'],
    ['$.data.items[0].token', 'first'],
  ])('reads %s', (path, expected) => {
    expect(readJsonPath(payload, path)).toEqual(expected)
  })

  it.each(['$..token', '$.items[?(@.ok)]', '$.fn()', 'data.token'])('rejects %s', (path) => {
    expect(() => parseJsonPath(path)).toThrow(JsonPathSyntaxError)
  })

  it('returns undefined for a valid path that does not resolve', () => {
    expect(readJsonPath(payload, '$.data.missing')).toBeUndefined()
  })

  it('never traverses inherited object properties', () => {
    const inherited = Object.create({ token: 'prototype-secret' }) as Record<string, unknown>
    expect(readJsonPath(inherited, '$.token')).toBeUndefined()
    expect(readJsonPath({}, '$.constructor')).toBeUndefined()
  })
})
