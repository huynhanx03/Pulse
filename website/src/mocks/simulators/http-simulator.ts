import type {
  HttpExecutionInput,
  HttpExecutionResult,
  HttpScenario,
  HttpTiming,
} from '@/domain/execution/http'
import { SeededRandom } from '@/mocks/deterministic-random'

const buildTimings = (random: SeededRandom, secure: boolean): HttpTiming => {
  const queued = random.integer(1, 4)
  const dns = random.integer(2, 9)
  const connect = random.integer(4, 18)
  const tls = secure ? random.integer(12, 32) : 0
  const upload = random.integer(1, 5)
  const ttfb = queued + dns + connect + tls + upload + random.integer(18, 72)
  const download = random.integer(3, 17)
  return { queued, dns, connect, tls, upload, ttfb, download, total: ttfb + download }
}

const responseBody = (requestId: string, scenario: HttpScenario, requestBody: string): unknown => {
  if (scenario === 'unauthorized')
    return { ok: false, error: { code: 'AUTH_401', message: 'Access token expired' } }
  if (scenario === 'validation')
    return { ok: false, error: { code: 'VALIDATION_FAILED', fields: { email: 'Invalid email' } } }
  if (scenario === 'server-error')
    return { ok: false, error: { code: 'INTERNAL_ERROR', traceId: 'trc_mock_51fa' } }
  if (requestId === 'req-login') {
    return {
      ok: true,
      data: {
        accessToken: 'eyJhbGciOiJQUzI1NiJ9.demo-access.signature',
        refreshToken: 'pulse-refresh-demo-internal',
        expiresIn: 900,
        expiresAtIso: '2026-08-30T00:15:00.000Z',
        expiresAtUnix: 1788048900,
        expiresAtUnixMs: 1788048900000,
        user: { id: 'usr_01HX2', name: 'Nguyễn An', roles: ['developer'] },
      },
    }
  }
  if (requestId === 'req-create-order') {
    let input: Record<string, unknown> = {}
    try {
      const parsed: unknown = JSON.parse(requestBody)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed))
        input = parsed as Record<string, unknown>
    } catch {
      /* Non-JSON payloads retain a deterministic default fixture. */
    }
    const quantity = typeof input.quantity === 'number' ? input.quantity : 1
    return {
      ok: true,
      data: {
        ...input,
        id: 'ord_01J6M8TQ',
        status: 'created',
        quantity,
        total: quantity * 249_000,
        currency: 'VND',
      },
    }
  }
  return {
    ok: true,
    data: { id: 'usr_01HX2', name: 'Nguyễn An', team: 'Platform', plan: 'internal' },
  }
}

export const simulateHttpRequest = (input: HttpExecutionInput): HttpExecutionResult => {
  const random = new SeededRandom(`${input.seed}:${input.requestId}:${input.scenario}`)
  const secure = input.url.startsWith('https://')
  const timings = buildTimings(random, secure)
  const timedOut =
    input.scenario === 'timeout' ||
    (typeof input.timeoutMs === 'number' && input.timeoutMs < timings.total)
  if (timedOut && input.timeoutMs) {
    const scale = Math.max(1, input.timeoutMs) / timings.total
    for (const key of Object.keys(timings) as Array<keyof HttpTiming>)
      timings[key] = Math.round(timings[key] * scale)
    timings.total = Math.max(1, input.timeoutMs)
  }
  const statusByScenario: Record<HttpScenario, number> = {
    success: input.scenario === 'success' && input.requestId === 'req-create-order' ? 201 : 200,
    unauthorized: 401,
    validation: 422,
    timeout: 0,
    'tls-error': input.verifyTls === false ? 200 : 0,
    redirect: input.followRedirects === false ? 302 : 200,
    malformed: 200,
    empty: 204,
    binary: 200,
    oversized: 200,
    'server-error': 500,
  }
  const status = timedOut ? 0 : statusByScenario[input.scenario]
  const body =
    status === 0 ||
    status === 204 ||
    input.method === 'HEAD' ||
    input.scenario === 'malformed' ||
    input.scenario === 'binary'
      ? null
      : responseBody(input.requestId, input.scenario, input.body)
  const rawBody =
    input.scenario === 'binary'
      ? '\u0089PNG\r\n\u001a\nPULSE_BINARY_FIXTURE'
      : status === 0 || status === 204 || input.method === 'HEAD'
        ? ''
        : input.scenario === 'malformed'
          ? '{"ok": true, "data": '
          : JSON.stringify(body, null, 2)
  const size =
    input.scenario === 'oversized' && rawBody ? 8_480_392 : new TextEncoder().encode(rawBody).length
  const statusText =
    status === 0
      ? timedOut
        ? 'Request timeout'
        : 'TLS handshake failed'
      : ({
          200: 'OK',
          201: 'Created',
          204: 'No Content',
          302: 'Found',
          401: 'Unauthorized',
          422: 'Unprocessable Entity',
          500: 'Internal Server Error',
        }[status] ?? 'OK')

  return {
    id: `exec-${random.uuid()}`,
    requestId: input.requestId,
    status,
    statusText,
    size,
    body,
    rawBody,
    headers:
      status === 0
        ? []
        : [
            {
              key: 'content-type',
              value:
                input.scenario === 'binary'
                  ? 'application/octet-stream'
                  : 'application/json; charset=utf-8',
            },
            { key: 'x-request-id', value: `req_${random.uuid().slice(0, 8)}` },
            { key: 'cache-control', value: 'no-store' },
            { key: 'server-timing', value: `app;dur=${Math.max(1, timings.ttfb - 31)}` },
            ...(status === 302
              ? [{ key: 'location', value: input.url.replace('http:', 'https:') }]
              : []),
          ],
    cookies:
      input.requestId === 'req-login' && status === 200
        ? [
            {
              name: 'pulse_session',
              value: '••••••••••••',
              flags: 'HttpOnly; Secure; SameSite=Lax',
            },
          ]
        : [],
    tests: [
      {
        name: 'Status is successful',
        passed: status >= 200 && status < 300,
        detail: `Received ${status || 'network error'}`,
      },
      {
        name: 'Response time under 500 ms',
        passed: timings.total < 500,
        detail: `${timings.total} ms`,
      },
      {
        name: 'Content-Type matches payload',
        passed: status !== 0,
        detail: input.scenario === 'binary' ? 'application/octet-stream' : 'application/json',
      },
      ...(rawBody
        ? [
            {
              name: 'Response JSON parses',
              passed: input.scenario !== 'malformed',
              detail:
                input.scenario === 'malformed' ? 'Unexpected end of JSON input' : 'Valid JSON',
            },
          ]
        : []),
    ],
    console: [
      { level: 'info', message: `Resolved ${input.method} ${input.url}` },
      {
        level: 'info',
        message: `${input.headers?.length ?? 0} request headers · ${new TextEncoder().encode(input.body).length} body bytes`,
      },
      {
        level: input.scenario === 'tls-error' ? 'error' : 'info',
        message:
          input.scenario === 'tls-error'
            ? 'Certificate chain rejected by mock trust store'
            : `Scenario: ${input.scenario}`,
      },
    ],
    timings,
    ...(secure
      ? {
          tls: {
            version: 'TLS 1.3',
            cipher: 'TLS_AES_256_GCM_SHA384',
            issuer: 'Pulse Internal CA',
            validUntil: '2027-08-30',
            verified: input.scenario !== 'tls-error' && input.verifyTls !== false,
          },
        }
      : {}),
    redirects:
      input.scenario === 'redirect'
        ? [
            'http://staging.internal.example/v1/profile',
            'https://staging.internal.example/v1/profile',
          ]
        : [],
    ...(timedOut ? { errorCode: 'ETIMEDOUT' } : {}),
    ...(input.scenario === 'tls-error' && input.verifyTls !== false && !timedOut
      ? { errorCode: 'CERT_AUTHORITY_INVALID' }
      : {}),
  }
}

/** Async boundary retained for callers; the current transport is entirely local. */
export const executeHttpRequest = async (input: HttpExecutionInput): Promise<HttpExecutionResult> =>
  simulateHttpRequest(input)
