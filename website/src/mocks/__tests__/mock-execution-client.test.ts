import type { GrpcExecutionEvent } from '@/domain/execution/grpc'
import type { TestRunEvent } from '@/domain/runner/types'
import { MockExecutionClient } from '@/mocks/mock-execution-client'
import { ExecutionAbortedError, GrpcTransitionError } from '@/services/execution-client'

const collect = async <Event>(events: AsyncIterable<Event>): Promise<Event[]> => {
  const collected: Event[] = []
  for await (const event of events) collected.push(event)
  return collected
}

describe('MockExecutionClient', () => {
  const httpInput = {
    requestId: 'req-create-order',
    scenario: 'success' as const,
    method: 'POST',
    url: 'https://demo.internal/orders',
    body: '{"quantity":2}',
    seed: 17,
  }

  it('is deterministic for the selected seed without sharing mutable random state', async () => {
    const client = new MockExecutionClient()

    const first = await client.executeHttp(httpInput, { seed: 91 }, new AbortController().signal)
    const replay = await client.executeHttp(httpInput, { seed: 91 }, new AbortController().signal)
    const different = await client.executeHttp(
      httpInput,
      { seed: 92 },
      new AbortController().signal,
    )

    expect(replay).toEqual(first)
    expect(different).not.toEqual(first)
  })

  it('rejects an aborted HTTP execution before publishing a late result', async () => {
    const client = new MockExecutionClient()
    const controller = new AbortController()

    const pending = client.executeHttp(httpInput, {}, controller.signal)
    controller.abort()

    await expect(pending).rejects.toBeInstanceOf(ExecutionAbortedError)
    await expect(pending).rejects.toMatchObject({ code: 'aborted' })
  })

  it('enforces bidi half-close and publishes exactly one terminal event', async () => {
    const client = new MockExecutionClient()
    const session = await client.openGrpc(
      {
        methodId: 'grpc-user-watch',
        callType: 'bidi-stream',
        scenario: 'success',
        body: '{"user_id":"usr_boundary"}',
        seed: 31,
      },
      {},
      new AbortController().signal,
    )

    await session.send({ user_id: 'usr_second' })
    await session.halfClose()
    await expect(session.send({ user_id: 'usr_late' })).rejects.toBeInstanceOf(GrpcTransitionError)

    const events = await collect<GrpcExecutionEvent>(session.events)
    expect(events[0]?.type).toBe('headers')
    expect(events.at(-1)).toMatchObject({ type: 'completed', outcome: 'completed' })
    expect(events.filter((event) => event.type === 'completed')).toHaveLength(1)
  })

  it('converges external gRPC cancellation on one typed terminal event', async () => {
    const client = new MockExecutionClient()
    const controller = new AbortController()
    const session = await client.openGrpc(
      {
        methodId: 'grpc-user-watch',
        callType: 'server-stream',
        scenario: 'success',
        seed: 31,
      },
      {},
      controller.signal,
    )

    controller.abort()

    expect(await collect(session.events)).toEqual([{ type: 'completed', outcome: 'cancelled' }])
  })

  it('does not publish run snapshots after stop', async () => {
    const client = new MockExecutionClient()
    const session = await client.startRun(
      {
        mode: 'race',
        seed: 42,
        durationSeconds: 5,
        targetRate: 20,
        workers: 4,
      },
      {},
      new AbortController().signal,
    )

    session.stop()

    const events = await collect<TestRunEvent>(session.events)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'completed', outcome: 'stopped' })
  })
})
