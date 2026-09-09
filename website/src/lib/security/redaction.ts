import type { ApiRequest, KeyValueRow } from '@/domain/types'

const SENSITIVE_KEY =
  /(?:access[_-]?token|refresh[_-]?token|password|secret|authorization|api[_-]?key|cookie)/i

export const redactSensitiveData = (
  value: unknown,
  key = '',
  secrets: readonly string[] = [],
): unknown => {
  if (SENSITIVE_KEY.test(key)) return '[redacted]'
  if (Array.isArray(value)) return value.map((entry) => redactSensitiveData(entry, '', secrets))
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactSensitiveData(entryValue, entryKey, secrets),
      ]),
    )
  }
  if (typeof value === 'string') {
    const firstCharacter = value.trimStart()[0]
    if (firstCharacter === '{' || firstCharacter === '[') {
      try {
        const parsed: unknown = JSON.parse(value)
        return JSON.stringify(redactSensitiveData(parsed, '', secrets), null, 2)
      } catch {
        // Malformed JSON and ordinary console text still get literal masking.
      }
    }
    const masked = value
      .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+/g, '[redacted]')
      .replace(/pulse-refresh-[A-Za-z0-9._-]+/gi, '[redacted]')
    return secrets
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .reduce(
        (text, secret) =>
          text
            .replaceAll(secret, '[redacted]')
            .replaceAll(encodeURIComponent(secret), '[redacted]'),
        masked,
      )
  }
  return value
}

const sanitizeRows = (rows: readonly KeyValueRow[], secrets: readonly string[]): KeyValueRow[] =>
  rows.map((row) => ({
    ...structuredClone(row),
    value: row.secret ? '' : (redactSensitiveData(row.value, row.key, secrets) as string),
  }))

/** Builds a history snapshot without changing field types or retaining credentials. */
export const createSafeRequestSnapshot = (request: ApiRequest): ApiRequest => {
  const secrets = [
    request.auth.token,
    request.auth.password,
    request.auth.type === 'api-key' ? request.auth.value : '',
    ...request.headers.filter((row) => row.secret).map((row) => row.value),
    ...request.cookies.filter((row) => row.secret).map((row) => row.value),
    ...request.metadata.filter((row) => row.secret).map((row) => row.value),
  ].filter(Boolean)

  return {
    ...structuredClone(request),
    url: redactSensitiveData(request.url, '', secrets) as string,
    body: redactSensitiveData(request.body, '', secrets) as string,
    query: sanitizeRows(request.query, secrets),
    headers: sanitizeRows(request.headers, secrets),
    cookies: sanitizeRows(request.cookies, secrets),
    metadata: sanitizeRows(request.metadata, secrets),
    auth: {
      ...structuredClone(request.auth),
      token: '',
      password: '',
      value: request.auth.type === 'api-key' ? '' : request.auth.value,
    },
  }
}
