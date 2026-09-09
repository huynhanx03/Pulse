import type { ApiRequest, Environment } from '@/domain/types'
import type { DatasetRow } from '@/lib/datasets/dataset-engine'
import { resolveTemplate, type VariableScope } from '@/lib/variables/variable-engine'

interface ResolutionOptions {
  seed?: number
  now?: Date
  iteration?: DatasetRow
}

export const prepareRequest = (
  request: ApiRequest,
  environment: Environment,
  options: ResolutionOptions = {},
) => {
  const variables = environment.variables.filter((variable) => variable.enabled)
  const secretKeys = variables.filter((variable) => variable.secret).map((variable) => variable.key)
  const secrets = variables.filter((variable) => variable.secret).map((variable) => variable.value)
  const scopes: VariableScope[] = [
    {
      scope: 'environment',
      values: Object.fromEntries(variables.map((variable) => [variable.key, variable.value])),
    },
  ]
  const iterationScope: VariableScope | null = options.iteration
    ? {
        scope: 'iteration',
        values: Object.fromEntries(
          Object.entries(options.iteration).map(([key, value]) => [key, String(value)]),
        ),
      }
    : null
  const resolveOptions = {
    seed: options.seed ?? 41,
    now: options.now ?? new Date('2026-08-30T00:00:00Z'),
    secretKeys,
  }
  if (iterationScope) scopes.push(iterationScope)
  const resolve = (source: string) => resolveTemplate(source, scopes, resolveOptions)
  const url = resolve(request.url.trim())
  const body = resolve(request.bodyMode === 'none' ? '' : request.body)
  const resolutions = [url, body]
  const headers = (request.protocol === 'grpc' ? request.metadata : request.headers)
    .filter((row) => row.enabled && row.key.trim())
    .map((row) => {
      const value = resolve(row.value)
      resolutions.push(value)
      if (row.secret) secrets.push(value.value)
      return { key: row.key.trim(), value: value.value }
    })
  const query = new URLSearchParams()
  for (const row of request.query.filter((entry) => entry.enabled && entry.key.trim())) {
    const value = resolve(row.value)
    resolutions.push(value)
    query.append(row.key.trim(), value.value)
  }
  const resolveSecret = (source: string) => {
    const result = resolve(source)
    resolutions.push(result)
    secrets.push(result.value)
    return result.value
  }
  const setHeader = (key: string, value: string) => {
    const existing = headers.find((row) => row.key.toLowerCase() === key.toLowerCase())
    if (existing) existing.value = value
    else headers.push({ key, value })
  }
  if (request.protocol === 'http') {
    const cookies = request.cookies
      .filter((row) => row.enabled && row.key.trim())
      .map((row) => {
        const value = resolve(row.value)
        resolutions.push(value)
        if (row.secret) secrets.push(value.value)
        return `${row.key.trim()}=${value.value}`
      })
    if (cookies.length > 0) setHeader('Cookie', cookies.join('; '))
    if (['bearer', 'oauth2', 'inherit'].includes(request.auth.type))
      setHeader('Authorization', `Bearer ${resolveSecret(request.auth.token)}`)
    if (request.auth.type === 'basic') {
      const username = resolve(request.auth.username)
      resolutions.push(username)
      const credential = `${username.value}:${resolveSecret(request.auth.password)}`
      setHeader(
        'Authorization',
        `Basic ${btoa(Array.from(new TextEncoder().encode(credential), (byte) => String.fromCharCode(byte)).join(''))}`,
      )
    }
    if (request.auth.type === 'api-key') {
      const value = resolveSecret(request.auth.value)
      if (request.auth.location === 'query') query.set(request.auth.key, value)
      else setHeader(request.auth.key, value)
    }
  }
  if (query.size > 0) {
    const fragmentAt = url.value.indexOf('#')
    const base = fragmentAt < 0 ? url.value : url.value.slice(0, fragmentAt)
    const fragment = fragmentAt < 0 ? '' : url.value.slice(fragmentAt)
    const separator = base.includes('?') ? (/[?&]$/.test(base) ? '' : '&') : '?'
    url.value = `${base}${separator}${query.toString()}${fragment}`
  }
  const unresolved = [...new Set(resolutions.flatMap((resolution) => resolution.unresolved))]
  let problem: 'missing-variables' | 'invalid-json' | 'invalid-url' | 'invalid-timeout' | null =
    null
  if (unresolved.length > 0) problem = 'missing-variables'
  else if (!Number.isFinite(request.timeoutMs) || request.timeoutMs < 1) problem = 'invalid-timeout'
  else if (request.protocol === 'http' && !URL.canParse(url.value)) problem = 'invalid-url'
  else if (request.protocol === 'http' && !/^https?:\/\//i.test(url.value)) problem = 'invalid-url'
  else if (request.protocol === 'grpc' && !url.value) problem = 'invalid-url'
  if (!problem && request.bodyMode === 'json') {
    try {
      JSON.parse(body.value)
    } catch {
      problem = 'invalid-json'
    }
  }
  return { url, body, headers, secrets, unresolved, problem, valid: !problem }
}
