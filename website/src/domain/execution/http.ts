export type HttpScenario =
  | 'success'
  | 'unauthorized'
  | 'validation'
  | 'timeout'
  | 'tls-error'
  | 'redirect'
  | 'malformed'
  | 'empty'
  | 'binary'
  | 'oversized'
  | 'server-error'

export interface HttpExecutionInput {
  requestId: string
  scenario: HttpScenario
  method: string
  url: string
  body: string
  seed: number
  timeoutMs?: number
  followRedirects?: boolean
  verifyTls?: boolean
  headers?: Array<{ key: string; value: string }>
}

export interface HttpTiming {
  queued: number
  dns: number
  connect: number
  tls: number
  upload: number
  ttfb: number
  download: number
  total: number
}

export interface HttpExecutionResult {
  id: string
  requestId: string
  status: number
  statusText: string
  size: number
  body: unknown
  rawBody: string
  headers: Array<{ key: string; value: string }>
  cookies: Array<{ name: string; value: string; flags: string }>
  tests: Array<{ name: string; passed: boolean; detail: string }>
  console: Array<{ level: 'info' | 'warn' | 'error'; message: string }>
  timings: HttpTiming
  tls?: { version: string; cipher: string; issuer: string; validUntil: string; verified: boolean }
  redirects: string[]
  errorCode?: string
}
