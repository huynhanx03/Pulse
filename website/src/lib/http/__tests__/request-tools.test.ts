import {
  createSourceFile,
  forEachChild,
  isStringLiteral,
  ScriptKind,
  ScriptTarget,
  type SourceFile,
} from 'typescript'

import type { ApiRequest, KeyValueRow } from '@/domain/types'
import { createDemoWorkspace } from '@/mocks/fixtures/demo-workspace'
import { generateRequestSnippets, parseCurl } from '@/lib/http/request-tools'

const row = (key: string, value: string, enabled = true): KeyValueRow => ({
  id: key,
  key,
  value,
  enabled,
  description: '',
})
const request = (patch: Partial<ApiRequest> = {}): ApiRequest => {
  const seed = createDemoWorkspace().requests[0]!
  return {
    ...seed,
    url: '{{base_url}}/items',
    method: 'GET',
    bodyMode: 'none',
    body: '',
    headers: [],
    query: [],
    ...patch,
  }
}

describe('text-only cURL import', () => {
  it.each(['https://api.example/v1', 'http://localhost:8080/v1', '{{base_url}}/v1'])(
    'imports an unquoted %s URL',
    (url) => {
      expect(parseCurl(`curl ${url}`)).toEqual({
        method: 'GET',
        url,
        body: '',
        bodyMode: 'none',
        headers: [],
      })
    },
  )

  it('imports explicit URLs, attached request flags, headers and JSON', () => {
    expect(
      parseCurl(
        String.raw`curl --url '{{base_url}}/orders' -XPOST -H 'Content-Type: application/json' --header='X-Trace: request:42' --data '{"name":"A\"B"}'`,
      ),
    ).toEqual({
      method: 'POST',
      url: '{{base_url}}/orders',
      body: String.raw`{"name":"A\"B"}`,
      bodyMode: 'json',
      headers: [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'X-Trace', value: 'request:42' },
      ],
    })
  })

  it('handles double-quoted escapes and backslash line continuations', () => {
    const source =
      'curl \\\n  --request patch \\\r\n  "https://api.example/v1?a=1&b=2" \\\n  --data "{\\"name\\":\\"A\\\\\\"B\\"}"'
    expect(parseCurl(source)).toMatchObject({
      method: 'PATCH',
      url: 'https://api.example/v1?a=1&b=2',
      body: String.raw`{"name":"A\"B"}`,
      bodyMode: 'json',
    })
  })

  it('joins adjacent shell quotes without changing apostrophes', () => {
    expect(
      parseCurl(`curl 'https://api.example/O'"'"'Brien' --data-raw 'don'"'"'t'`),
    ).toMatchObject({ url: "https://api.example/O'Brien", body: "don't", method: 'POST' })
  })

  it.each(['-d', '--data', '--data-raw', '--data-binary'])(
    'infers POST from %s, including an empty payload',
    (flag) => {
      expect(parseCurl(`curl https://api.example ${flag} ''`)).toMatchObject({
        method: 'POST',
        body: '',
        bodyMode: 'text',
      })
    },
  )

  it('preserves an explicit method with a body and supports attached header/data values', () => {
    expect(
      parseCurl(
        `curl --request=PUT --url=https://api.example -HContent-Type:application/x-www-form-urlencoded -d'a=1'`,
      ),
    ).toMatchObject({
      method: 'PUT',
      body: 'a=1',
      bodyMode: 'form',
      headers: [{ key: 'Content-Type', value: 'application/x-www-form-urlencoded' }],
    })
  })

  it('treats quoted substitutions and raw @ payloads as inert text', () => {
    const body = '$(printf should-not-run) `printf also-inert` ${HOME}'
    expect(parseCurl(`curl https://api.example --data-raw '${body}'`)?.body).toBe(body)
    expect(parseCurl('curl https://api.example --data-raw "$(printf should-not-run)"')?.body).toBe(
      '$(printf should-not-run)',
    )
    expect(parseCurl("curl https://api.example --data-raw '@literal'")?.body).toBe('@literal')
  })

  it('accepts common non-payload display/transport flags', () => {
    expect(parseCurl('curl -s -S -L --compressed --globoff https://api.example')?.url).toBe(
      'https://api.example',
    )
  })

  it.each([
    '',
    'https://api.example',
    'curl',
    'curl --request GET',
    'curl ftp://api.example',
    'curl https://',
    "curl 'https://api.example/a b'",
    'curl {{base_url}}oops',
    'curl https://api.example https://other.example',
    "curl 'https://api.example",
    'curl "https://api.example',
    'curl https://api.example \\',
    'curl https://api.example --proxy http://proxy.example',
    'curl --config config.txt https://api.example',
    'curl https://api.example --output target.txt',
    'curl https://api.example --unknown',
    "curl https://api.example -d '@secret.txt'",
    'curl https://api.example --data-binary @secret.txt',
    'curl https://api.example -H @headers.txt',
    'curl https://api.example -XTRACE',
    'curl https://api.example | another-command',
    'curl https://api.example && another-command',
    'curl https://api.example; another-command',
    'curl https://api.example > output.txt',
    'curl https://api.example &',
    'curl https://api.example\nanother-command',
    'curl https://api.example --data-raw foo\\' + String.fromCharCode(0) + 'bar',
    "curl https://api.example -H 'Invalid Header: value'",
    "curl https://api.example -H 'Missing-colon'",
  ])('rejects unsupported or malformed input: %s', (source) => {
    expect(parseCurl(source)).toBeNull()
  })
})

describe('educational request snippets', () => {
  it('round-trips escaped cURL text with enabled headers, template auth and query before fragments', () => {
    const source = request({
      method: 'PATCH',
      url: "{{base_url}}/people/O'Brien?existing=1#details",
      bodyMode: 'json',
      body: JSON.stringify({ name: 'Đặng "An"', note: "one\ntwo's `literal` $(inert)" }),
      query: [row('q', 'a b & c'), row('cursor', '{{cursor}}'), row('disabled', 'hidden', false)],
      headers: [
        row('Content-Type', 'application/json'),
        row('X-Note', "don't replace {{trace}}"),
        row('X-Disabled', 'hidden', false),
      ],
      auth: { ...request().auth, type: 'bearer', token: '{{access_token}}' },
    })
    const before = structuredClone(source)
    const snippets = generateRequestSnippets(source)
    expect(parseCurl(snippets.curl)).toEqual({
      method: 'PATCH',
      url: "{{base_url}}/people/O'Brien?existing=1&q=a%20b%20%26%20c&cursor={{cursor}}#details",
      body: source.body,
      bodyMode: 'json',
      headers: [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'X-Note', value: "don't replace {{trace}}" },
        { key: 'Authorization', value: 'Bearer {{access_token}}' },
      ],
    })
    Object.values(snippets).forEach((snippet) => {
      expect(snippet).toContain('{{access_token}}')
      expect(snippet).toContain('{{cursor}}')
      expect(snippet).not.toContain('hidden')
    })
    expect(source).toEqual(before)
  })

  it.each(['none', 'bearer', 'oauth2', 'inherit'] as const)(
    'represents %s auth without resolving environment secrets',
    (type) => {
      const snippets = generateRequestSnippets(
        request({ auth: { ...request().auth, type, token: '{{session_token}}' } }),
      )
      for (const snippet of Object.values(snippets)) {
        if (type === 'none') expect(snippet).not.toContain('Authorization')
        else expect(snippet).toContain('Bearer {{session_token}}')
        expect(snippet).not.toContain('demo-access')
      }
    },
  )

  it('uses Basic auth helpers while keeping credential placeholders visible', () => {
    const snippets = generateRequestSnippets(
      request({
        auth: {
          ...request().auth,
          type: 'basic',
          username: '{{username}}',
          password: '{{password}}',
        },
      }),
    )
    for (const snippet of Object.values(snippets)) {
      expect(snippet).toContain('{{username}}')
      expect(snippet).toContain('{{password}}')
    }
    expect(snippets.curl).toContain("--user '{{username}}:{{password}}'")
    expect(snippets.go).toContain('SetBasicAuth("{{username}}", "{{password}}")')
    expect(snippets.python).toContain('auth=("{{username}}", "{{password}}")')
  })

  it.each(['header', 'query'] as const)(
    'includes API key templates in the configured %s location',
    (location) => {
      const snippets = generateRequestSnippets(
        request({
          auth: {
            ...request().auth,
            type: 'api-key',
            key: 'api_key',
            value: '{{api_key}}',
            location,
          },
        }),
      )
      const imported = parseCurl(snippets.curl)
      if (location === 'query') {
        expect(imported?.url).toBe('{{base_url}}/items?api_key={{api_key}}')
        expect(imported?.headers).toEqual([])
      } else {
        expect(imported?.headers).toEqual([{ key: 'api_key', value: '{{api_key}}' }])
        expect(imported?.url).toBe('{{base_url}}/items')
      }
      Object.values(snippets).forEach((snippet) => expect(snippet).toContain('{{api_key}}'))
    },
  )

  it('overrides explicit authorization when an auth template is enabled', () => {
    const snippets = generateRequestSnippets(
      request({
        headers: [row('authorization', 'stale')],
        auth: { ...request().auth, type: 'bearer', token: '{{token}}' },
      }),
    )
    expect(parseCurl(snippets.curl)?.headers).toEqual([
      { key: 'Authorization', value: 'Bearer {{token}}' },
    ])
    Object.values(snippets).forEach((snippet) => expect(snippet).not.toContain('stale'))
  })

  it('omits stored body text when body mode is none in every language', () => {
    const snippets = generateRequestSnippets(
      request({ body: 'BODY-MUST-NOT-APPEAR', bodyMode: 'none' }),
    )
    Object.values(snippets).forEach((snippet) =>
      expect(snippet).not.toContain('BODY-MUST-NOT-APPEAR'),
    )
    expect(snippets.curl).not.toContain('--data')
    expect(snippets.python).not.toContain('data=')
    expect(snippets.go).toContain('nil)')
    expect(snippets.go).not.toContain('"strings"')
  })

  it('emits syntactically valid JavaScript with lossless quotes, Unicode, backslashes and newlines', () => {
    const source = request({
      method: 'POST',
      bodyMode: 'text',
      body: 'Đặng\n"quotes" \\ backticks ` ${inert}',
      headers: [row('X-Quote', '"quoted" \\ value')],
    })
    const snippets = generateRequestSnippets(source)
    const parsed = createSourceFile(
      'example.js',
      snippets.fetch,
      ScriptTarget.Latest,
      true,
      ScriptKind.JS,
    )
    expect(
      (parsed as SourceFile & { parseDiagnostics: readonly unknown[] }).parseDiagnostics,
    ).toEqual([])
    const literals: string[] = []
    const visit = (node: import('typescript').Node) => {
      if (isStringLiteral(node)) literals.push(node.text)
      forEachChild(node, visit)
    }
    visit(parsed)
    expect(literals).toContain(source.body)
    expect(literals).toContain('"quoted" \\ value')
    expect(snippets.go).toContain('strings.NewReader(')
    expect(snippets.python).toContain('data=')
  })
})
