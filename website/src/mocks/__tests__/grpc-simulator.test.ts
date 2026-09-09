import type { GrpcCallType, GrpcScenario } from '@/domain/execution/grpc'
import { simulateGrpcCall } from '@/mocks/simulators/grpc-simulator'

const callTypes: GrpcCallType[] = ['unary', 'server-stream', 'client-stream', 'bidi-stream']
const scenarios: Array<{ scenario: GrpcScenario; status: number; statusName: string }> = [
  { scenario: 'success', status: 0, statusName: 'OK' },
  { scenario: 'not-found', status: 5, statusName: 'NOT_FOUND' },
  { scenario: 'deadline', status: 4, statusName: 'DEADLINE_EXCEEDED' },
  { scenario: 'unavailable', status: 14, statusName: 'UNAVAILABLE' },
]

describe.each(callTypes)('gRPC %s mock calls', (type) => {
  it.each(scenarios)(
    'keeps $scenario messages, timing, and trailers consistent',
    ({ scenario, status, statusName }) => {
      const result = simulateGrpcCall('grpc-user-watch', type, scenario)
      const inbound = result.messages.filter((message) => message.direction === 'inbound')

      expect(result).toMatchObject({ status, statusName })
      expect(result.headers).toContainEqual({
        key: 'content-type',
        value: 'application/grpc+proto',
      })
      expect(result.trailers).toContainEqual({ key: 'grpc-status', value: String(status) })
      expect(result.trailers).toContainEqual({ key: 'grpc-message', value: statusName })
      expect(result.duration).toBeGreaterThan(0)
      expect(Number.isFinite(result.duration)).toBe(true)
      expect(new Set(result.messages.map((message) => message.id)).size).toBe(
        result.messages.length,
      )
      result.messages.forEach((message, index) => {
        expect(message.atMs).toBeGreaterThanOrEqual(result.messages[index - 1]?.atMs ?? 0)
        expect(message.atMs).toBeLessThanOrEqual(result.duration)
      })
      expect(result.messages.at(-1)).toMatchObject({ direction: 'system', atMs: result.duration })
      expect(result.messages.at(-1)?.payload).toContain(statusName)
      if (status !== 0) expect(result.messages.at(-1)?.payload).not.toMatch(/stream completed/i)

      if (scenario === 'success') {
        expect(inbound).toHaveLength(type === 'unary' || type === 'client-stream' ? 1 : 7)
      } else if (type === 'unary' || type === 'client-stream' || scenario !== 'deadline') {
        expect(inbound).toHaveLength(0)
      }
    },
  )

  it('uses the edited payload and requested user in mock messages', () => {
    const body = '{ "user_id": "usr_edited", "include_roles": false }'
    const result = simulateGrpcCall('grpc-user-watch', type, 'success', 2026, { body })

    expect(result.messages[0]).toMatchObject({ direction: 'outbound', payload: body })
    const inbound = result.messages.filter((message) => message.direction === 'inbound')
    expect(inbound.length).toBeGreaterThan(0)
    inbound.forEach((message) =>
      expect(JSON.parse(message.payload)).toMatchObject({ user: { id: 'usr_edited' } }),
    )
  })

  it('ends at a short deadline without publishing later messages', () => {
    const result = simulateGrpcCall('grpc-user-watch', type, 'success', 2026, { deadlineMs: 1 })

    expect(result).toMatchObject({ status: 4, statusName: 'DEADLINE_EXCEEDED', duration: 1 })
    expect(result.messages.map((message) => message.direction)).toEqual(['outbound', 'system'])
    expect(result.messages.at(-1)).toMatchObject({ atMs: 1 })
    expect(result.messages.at(-1)?.payload).toContain('DEADLINE_EXCEEDED')
    expect(result.trailers).toContainEqual({ key: 'grpc-status', value: '4' })
  })
})

describe('gRPC request options', () => {
  it.each<GrpcCallType>(['server-stream', 'bidi-stream'])(
    'retains only the %s messages delivered before a deadline',
    (type) => {
      const complete = simulateGrpcCall('grpc-user-watch', type, 'success')
      const deadlineMs = Math.floor(complete.duration / 2)
      const partial = simulateGrpcCall('grpc-user-watch', type, 'success', 2026, { deadlineMs })
      const received = partial.messages.filter((message) => message.direction === 'inbound')

      expect(partial).toMatchObject({ status: 4, duration: deadlineMs })
      expect(received.length).toBeGreaterThan(0)
      expect(received.length).toBeLessThan(7)
      expect(received).toEqual(
        complete.messages.filter(
          (message) => message.direction === 'inbound' && message.atMs <= deadlineMs,
        ),
      )
      expect(partial.messages.at(-1)?.atMs).toBe(deadlineMs)
    },
  )

  it.each([-10, 0, 0.25])('clamps a finite deadline of %s to one millisecond', (deadlineMs) => {
    expect(
      simulateGrpcCall('grpc-user-get', 'unary', 'success', 2026, { deadlineMs }),
    ).toMatchObject({ status: 4, duration: 1 })
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'ignores the non-finite deadline %s',
    (deadlineMs) => {
      expect(simulateGrpcCall('grpc-user-get', 'unary', 'success', 2026, { deadlineMs })).toEqual(
        simulateGrpcCall('grpc-user-get', 'unary', 'success'),
      )
    },
  )

  it('allows a call that completes exactly at its deadline', () => {
    const complete = simulateGrpcCall('grpc-user-get', 'unary', 'success')
    expect(
      simulateGrpcCall('grpc-user-get', 'unary', 'success', 2026, {
        deadlineMs: complete.duration,
      }),
    ).toEqual(complete)
  })

  it('preserves a non-JSON outbound message without crashing', () => {
    const result = simulateGrpcCall('grpc-user-get', 'unary', 'success', 2026, { body: 'not JSON' })
    expect(result.messages[0]?.payload).toBe('not JSON')
  })

  it('echoes correlation metadata without reflecting credentials or overriding protocol headers', () => {
    const result = simulateGrpcCall('grpc-user-get', 'unary', 'success', 2026, {
      metadata: [
        { key: 'X-Request-Id', value: 'trace-edited-request' },
        { key: 'authorization', value: 'Bearer review-secret' },
        { key: 'content-type', value: 'text/plain' },
        { key: 'grpc-status', value: '14' },
      ],
    })

    expect(result.headers).toContainEqual({ key: 'x-request-id', value: 'trace-edited-request' })
    expect(result.headers).toContainEqual({ key: 'content-type', value: 'application/grpc+proto' })
    expect(result.trailers).toContainEqual({ key: 'grpc-status', value: '0' })
    expect(JSON.stringify(result)).not.toContain('review-secret')
    expect(result.headers).not.toContainEqual({ key: 'content-type', value: 'text/plain' })
  })

  it('reproduces the same request for a seed and varies generated timing or IDs for another seed', () => {
    const options = {
      body: '{"user_id":"usr_edited"}',
      deadlineMs: 10_000,
      metadata: [{ key: 'x-request-id', value: 'trace-seeded' }],
    }
    const first = simulateGrpcCall('grpc-user-watch', 'server-stream', 'success', 97, options)

    expect(simulateGrpcCall('grpc-user-watch', 'server-stream', 'success', 97, options)).toEqual(
      first,
    )
    expect(
      simulateGrpcCall('grpc-user-watch', 'server-stream', 'success', 98, options),
    ).not.toEqual(first)
  })
})
