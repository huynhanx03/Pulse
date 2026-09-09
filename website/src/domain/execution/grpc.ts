export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type GrpcCallType = 'unary' | 'server-stream' | 'client-stream' | 'bidi-stream'
export type GrpcScenario = 'success' | 'not-found' | 'deadline' | 'unavailable'

export interface GrpcCallOptions {
  body?: string
  deadlineMs?: number
  metadata?: Array<{ key: string; value: string }>
}

export interface GrpcExecutionInput {
  methodId: string
  callType: GrpcCallType
  scenario: GrpcScenario
  seed?: number
  body?: string
  deadlineMs?: number
  metadata?: Array<{ key: string; value: string }>
}

export interface GrpcMessage {
  id: string
  direction: 'outbound' | 'inbound' | 'system'
  atMs: number
  payload: string
}

export interface GrpcResult {
  status: number
  statusName: string
  duration: number
  messages: GrpcMessage[]
  headers: Array<{ key: string; value: string }>
  trailers: Array<{ key: string; value: string }>
}

export type GrpcExecutionEvent =
  | { type: 'headers'; headers: GrpcResult['headers'] }
  | { type: 'message'; message: GrpcMessage }
  | { type: 'trailers'; trailers: GrpcResult['trailers'] }
  | { type: 'completed'; outcome: 'completed' | 'failed'; result: GrpcResult }
  | { type: 'completed'; outcome: 'cancelled' }
