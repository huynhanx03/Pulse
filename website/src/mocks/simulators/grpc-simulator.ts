import type {
  GrpcCallOptions,
  GrpcCallType,
  GrpcMessage,
  GrpcResult,
  GrpcScenario,
} from '@/domain/execution/grpc'
import { SeededRandom } from '@/mocks/deterministic-random'

export type {
  GrpcCallOptions,
  GrpcCallType,
  GrpcMessage,
  GrpcResult,
  GrpcScenario,
} from '@/domain/execution/grpc'

const readUserId = (body: string): string | undefined => {
  try {
    const payload: unknown = JSON.parse(body)
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'user_id' in payload &&
      typeof payload.user_id === 'string'
    ) {
      return payload.user_id
    }
  } catch {
    // Preserve non-JSON request text in the outbound event without crashing the workbench.
  }
  return undefined
}

export const simulateGrpcCall = (
  methodId: string,
  type: GrpcCallType,
  scenario: GrpcScenario,
  seed = 2026,
  options: GrpcCallOptions = {},
): GrpcResult => {
  const random = new SeededRandom(`${methodId}:${type}:${scenario}:${seed}`)
  const simulatedDuration = random.integer(84, 460)
  const deadline =
    typeof options.deadlineMs === 'number' && Number.isFinite(options.deadlineMs)
      ? Math.max(1, options.deadlineMs)
      : simulatedDuration
  const duration = Math.min(simulatedDuration, deadline)
  const status =
    deadline < simulatedDuration
      ? 4
      : scenario === 'success'
        ? 0
        : scenario === 'not-found'
          ? 5
          : scenario === 'deadline'
            ? 4
            : 14
  const statusName =
    (
      { 0: 'OK', 4: 'DEADLINE_EXCEEDED', 5: 'NOT_FOUND', 14: 'UNAVAILABLE' } as Record<
        number,
        string
      >
    )[status] ?? 'UNKNOWN'
  const body = options.body ?? '{ "user_id": "usr_01HX2" }'
  const userId = readUserId(body)
  const streamingResponse = type === 'server-stream' || type === 'bidi-stream'
  const inboundCount = streamingResponse ? 7 : 1
  const canReceive =
    status === 0 ||
    (streamingResponse && status === 4 && (scenario === 'success' || scenario === 'deadline'))
  const messages: GrpcMessage[] = [
    { id: random.uuid(), direction: 'outbound', atMs: 0, payload: body },
  ]
  for (let index = 0; index < inboundCount; index += 1) {
    const message: GrpcMessage = {
      id: random.uuid(),
      direction: 'inbound',
      atMs: Math.floor((simulatedDuration * (index + 1)) / (inboundCount + 1)),
      payload: JSON.stringify(
        {
          sequence: index + 1,
          user: { id: userId ?? `usr_${String(index + 1).padStart(2, '0')}`, active: true },
        },
        null,
        2,
      ),
    }
    if (canReceive && message.atMs <= duration) messages.push(message)
  }
  messages.push({
    id: random.uuid(),
    direction: 'system',
    atMs: duration,
    payload: `grpc-status: ${status} (${statusName})`,
  })

  const headers = [
    { key: 'content-type', value: 'application/grpc+proto' },
    {
      key: 'x-envoy-upstream-service-time',
      value: String(Math.min(duration, random.integer(31, 90))),
    },
  ]
  const requestId = options.metadata?.find(
    (entry) => entry.key.toLowerCase() === 'x-request-id',
  )?.value
  if (requestId) headers.push({ key: 'x-request-id', value: requestId })

  return {
    status,
    statusName,
    duration,
    messages,
    headers,
    trailers: [
      { key: 'grpc-status', value: String(status) },
      { key: 'grpc-message', value: statusName },
    ],
  }
}
