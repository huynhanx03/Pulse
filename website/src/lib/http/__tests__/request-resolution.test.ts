import { createDemoWorkspace } from '@/mocks/fixtures/demo-workspace'
import { prepareRequest } from '@/lib/http/request-resolution'
import type { EnvironmentVariable } from '@/domain/types'

const scopedVariable = (id: string, key: string, value: string): EnvironmentVariable => ({
  id,
  key,
  value: value,
  enabled: true,
  secret: false,
  description: '',
})

describe('request snapshot resolution', () => {
  it('detects unresolved Basic usernames and appends query before a URL fragment', () => {
    const data = createDemoWorkspace()
    const request = data.requests[1]!
    const basic = {
      ...request,
      auth: {
        ...request.auth,
        type: 'basic' as const,
        username: '{{missing_user}}',
        password: 'demo',
      },
    }
    expect(prepareRequest(basic, data.environments[0]!).unresolved).toContain('missing_user')
    expect(
      prepareRequest({ ...request, url: 'https://api.test/profile#section' }, data.environments[0]!)
        .url.value,
    ).toBe('https://api.test/profile?expand=roles%2Cteam#section')
  })
  it('applies enabled query, headers and Bearer auth to the resolved snapshot', () => {
    const data = createDemoWorkspace()
    const result = prepareRequest(data.requests[1]!, data.environments[0]!)
    expect(result.url.value).toBe('https://api.staging.internal/v1/users/me?expand=roles%2Cteam')
    expect(result.headers.find((row) => row.key === 'Authorization')?.value).toContain('Bearer eyJ')
    expect(result.valid).toBe(true)
  })

  it('resolves enabled request cookies into one Cookie header', () => {
    const data = createDemoWorkspace()
    const request = {
      ...data.requests[1]!,
      cookies: [
        {
          id: 'cookie-session',
          enabled: true,
          key: 'tenant',
          value: '{{tenant_id}}',
          description: '',
          secret: true,
        },
      ],
    }
    const result = prepareRequest(request, data.environments[0]!)

    expect(result.headers).toContainEqual({ key: 'Cookie', value: 'tenant=tenant_core' })
    expect(result.secrets).toContain('tenant_core')
  })

  it('resolves dataset cells before the request is prepared', () => {
    const data = createDemoWorkspace()
    const result = prepareRequest(data.requests[2]!, data.environments[0]!, {
      iteration: { quantity: '4', sku: 'demo', customer_id: 'customer_9' },
    })
    expect(result.body.value).toContain('"customer_id": "customer_9"')
  })

  it('applies environment values, then lets an iteration override them', () => {
    const data = createDemoWorkspace()
    const request = {
      ...data.requests[0]!,
      url: 'https://scope.test/{{environment_wins}}',
      bodyMode: 'json' as const,
      body: JSON.stringify({
        environment: '{{environment_wins}}',
        iteration: '{{iteration_wins}}',
      }),
      query: [],
      headers: [],
      cookies: [],
      auth: { ...data.requests[0]!.auth, type: 'none' as const },
    }
    const environment = {
      ...data.environments[0]!,
      variables: [
        scopedVariable('environment-winner', 'environment_wins', 'environment-value'),
        scopedVariable('environment-iteration', 'iteration_wins', 'environment-shadow'),
      ],
    }
    const result = prepareRequest(request, environment, {
      iteration: { iteration_wins: 'iteration-value' },
    })

    expect(JSON.parse(result.body.value)).toEqual({
      environment: 'environment-value',
      iteration: 'iteration-value',
    })
    expect(
      Object.fromEntries(result.body.trace.map(({ key, scope }) => [key, scope])),
    ).toMatchObject({
      environment_wins: 'environment',
      iteration_wins: 'iteration',
    })
  })

  it('blocks invalid JSON and unknown variables with actionable reasons', () => {
    const data = createDemoWorkspace()
    const request = { ...data.requests[0]!, body: '{bad' }
    expect(prepareRequest(request, data.environments[0]!).problem).toBe('invalid-json')
    expect(
      prepareRequest({ ...request, body: '"{{missing}}"' }, data.environments[0]!).problem,
    ).toBe('missing-variables')
  })
})
