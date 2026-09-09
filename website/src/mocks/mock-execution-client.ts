import type {
  GrpcCallType,
  GrpcExecutionEvent,
  GrpcExecutionInput,
  GrpcResult,
  JsonValue,
} from '@/domain/execution/grpc'
import type { HttpExecutionInput, HttpExecutionResult } from '@/domain/execution/http'
import type { SimulatedRun, TestRunEvent, TestRunPlan } from '@/domain/runner/types'
import { projectRunProgress } from '@/domain/runner/run-analysis'
import { simulateGrpcCall } from '@/mocks/simulators/grpc-simulator'
import { simulateHttpRequest } from '@/mocks/simulators/http-simulator'
import { simulateRun } from '@/mocks/simulators/run-simulator'
import {
  ExecutionAbortedError,
  GrpcTransitionError,
  RunTransitionError,
  type ExecutionClient,
  type ExecutionOptions,
  type GrpcExecutionSession,
  type TestRunSession,
} from '@/services/execution-client'

const yieldAbortableTurn = (signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new ExecutionAbortedError())
      return
    }

    let settled = false
    const onAbort = () => {
      if (settled) return
      settled = true
      reject(new ExecutionAbortedError())
    }
    signal.addEventListener('abort', onAbort, { once: true })
    queueMicrotask(() => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', onAbort)
      resolve()
    })
  })

const throwIfAborted = (signal: AbortSignal): void => {
  if (signal.aborted) throw new ExecutionAbortedError()
}

const asyncTurn = (): Promise<void> => Promise.resolve()

class MockGrpcExecutionSession implements GrpcExecutionSession {
  readonly #callType: GrpcCallType
  readonly #deferredEvents: GrpcExecutionEvent[]
  readonly #eventWaiters = new Set<() => void>()
  readonly #resumeWaiters = new Set<() => void>()
  readonly #signal: AbortSignal
  readonly #onAbort: () => void
  #events: GrpcExecutionEvent[]
  #cursor = 0
  #sentCount = 0
  #paused = false
  #halfClosed = false
  #done = false

  constructor(callType: GrpcCallType, result: GrpcResult, signal: AbortSignal) {
    this.#callType = callType
    this.#signal = signal
    this.#onAbort = () => this.cancel()

    const terminal: GrpcExecutionEvent =
      result.status === 0
        ? { type: 'completed', outcome: 'completed', result }
        : { type: 'completed', outcome: 'failed', result }
    const responseEvents: GrpcExecutionEvent[] = [
      ...result.messages
        .slice(1)
        .map((message): GrpcExecutionEvent => ({ type: 'message', message })),
      { type: 'trailers', trailers: result.trailers },
      terminal,
    ]
    const openingEvents: GrpcExecutionEvent[] = [
      { type: 'headers', headers: result.headers },
      ...(result.messages[0] ? [{ type: 'message' as const, message: result.messages[0] }] : []),
    ]

    if (callType === 'client-stream' || callType === 'bidi-stream') {
      this.#events = openingEvents
      this.#deferredEvents = responseEvents
    } else {
      this.#events = [...openingEvents, ...responseEvents]
      this.#deferredEvents = []
    }

    signal.addEventListener('abort', this.#onAbort, { once: true })
    if (signal.aborted) this.cancel()
  }

  get events(): AsyncIterable<GrpcExecutionEvent> {
    return {
      [Symbol.asyncIterator]: () => ({ next: () => this.#nextEvent() }),
    }
  }

  async send(message: JsonValue): Promise<void> {
    this.#assertOpen()
    if (this.#callType !== 'client-stream' && this.#callType !== 'bidi-stream') {
      throw new GrpcTransitionError(
        'unsupported-operation',
        'This gRPC call type does not accept client stream messages.',
      )
    }
    if (this.#halfClosed) {
      throw new GrpcTransitionError('already-half-closed', 'The client stream is half-closed.')
    }

    this.#sentCount += 1
    this.#events.push({
      type: 'message',
      message: {
        id: `client-message-${this.#sentCount}`,
        direction: 'outbound',
        atMs: 0,
        payload: JSON.stringify(message, null, 2) ?? 'null',
      },
    })
    this.#wakeEventWaiters()
    await asyncTurn()
  }

  pause(): void {
    this.#assertOpen()
    if (this.#paused) {
      throw new GrpcTransitionError('already-paused', 'The gRPC session is already paused.')
    }
    this.#paused = true
  }

  resume(): void {
    this.#assertOpen()
    if (!this.#paused) {
      throw new GrpcTransitionError('not-paused', 'The gRPC session is not paused.')
    }
    this.#paused = false
    this.#wakeResumeWaiters()
  }

  async halfClose(): Promise<void> {
    this.#assertOpen()
    if (this.#callType !== 'client-stream' && this.#callType !== 'bidi-stream') {
      throw new GrpcTransitionError(
        'unsupported-operation',
        'This gRPC call type does not support client half-close.',
      )
    }
    if (this.#halfClosed) {
      throw new GrpcTransitionError('already-half-closed', 'The client stream is half-closed.')
    }

    this.#halfClosed = true
    this.#events.push(...this.#deferredEvents)
    this.#wakeEventWaiters()
    await asyncTurn()
  }

  cancel(): void {
    if (this.#done) return
    this.#events = [{ type: 'completed', outcome: 'cancelled' }]
    this.#cursor = 0
    this.#paused = false
    this.#halfClosed = true
    this.#wakeResumeWaiters()
    this.#wakeEventWaiters()
  }

  #assertOpen(): void {
    if (this.#done || this.#events[this.#cursor]?.type === 'completed') {
      throw new GrpcTransitionError('session-closed', 'The gRPC session is closed.')
    }
  }

  async #nextEvent(): Promise<IteratorResult<GrpcExecutionEvent>> {
    while (true) {
      if (this.#done) return { done: true, value: undefined }
      if (this.#paused) await this.#waitUntilResumed()
      await asyncTurn()
      if (this.#paused) continue

      const event = this.#events[this.#cursor]
      if (!event) {
        await this.#waitForEvent()
        continue
      }

      this.#cursor += 1
      if (event.type === 'completed') {
        this.#done = true
        this.#signal.removeEventListener('abort', this.#onAbort)
      }
      return { done: false, value: event }
    }
  }

  #waitForEvent(): Promise<void> {
    return new Promise((resolve) => this.#eventWaiters.add(resolve))
  }

  #waitUntilResumed(): Promise<void> {
    return new Promise((resolve) => this.#resumeWaiters.add(resolve))
  }

  #wakeEventWaiters(): void {
    for (const resolve of this.#eventWaiters) resolve()
    this.#eventWaiters.clear()
  }

  #wakeResumeWaiters(): void {
    for (const resolve of this.#resumeWaiters) resolve()
    this.#resumeWaiters.clear()
  }
}

class MockTestRunSession implements TestRunSession {
  readonly #eventWaiters = new Set<() => void>()
  readonly #resumeWaiters = new Set<() => void>()
  readonly #signal: AbortSignal
  readonly #onAbort: () => void
  #events: TestRunEvent[]
  #cursor = 0
  #paused = false
  #done = false
  #terminalPending = false
  #latestResult: SimulatedRun

  constructor(result: SimulatedRun, signal: AbortSignal) {
    this.#signal = signal
    this.#onAbort = () => this.#terminate('cancelled')
    this.#latestResult = projectRunProgress(result, 0)
    this.#events = [
      { type: 'snapshot', progress: 0, result: this.#latestResult },
      { type: 'snapshot', progress: 25, result: projectRunProgress(result, 25) },
      { type: 'snapshot', progress: 50, result: projectRunProgress(result, 50) },
      { type: 'snapshot', progress: 75, result: projectRunProgress(result, 75) },
      { type: 'completed', outcome: 'completed', result },
    ]

    signal.addEventListener('abort', this.#onAbort, { once: true })
    if (signal.aborted) this.#terminate('cancelled')
  }

  get events(): AsyncIterable<TestRunEvent> {
    return {
      [Symbol.asyncIterator]: () => ({ next: () => this.#nextEvent() }),
    }
  }

  pause(): void {
    this.#assertOpen()
    if (this.#paused) {
      throw new RunTransitionError('already-paused', 'The test run is already paused.')
    }
    this.#paused = true
  }

  resume(): void {
    this.#assertOpen()
    if (!this.#paused) throw new RunTransitionError('not-paused', 'The test run is not paused.')
    this.#paused = false
    this.#wakeResumeWaiters()
  }

  stop(): void {
    this.#assertOpen()
    this.#terminate('stopped')
  }

  #terminate(outcome: 'stopped' | 'cancelled'): void {
    if (this.#done || this.#terminalPending) return
    this.#terminalPending = true
    this.#events = [{ type: 'completed', outcome, result: this.#latestResult }]
    this.#cursor = 0
    this.#paused = false
    this.#wakeResumeWaiters()
    this.#wakeEventWaiters()
  }

  #assertOpen(): void {
    if (this.#done || this.#terminalPending) {
      throw new RunTransitionError('session-closed', 'The test run is closed.')
    }
  }

  async #nextEvent(): Promise<IteratorResult<TestRunEvent>> {
    while (true) {
      if (this.#done) return { done: true, value: undefined }
      if (this.#paused) await this.#waitUntilResumed()
      await asyncTurn()
      if (this.#paused) continue

      const event = this.#events[this.#cursor]
      if (!event) {
        await this.#waitForEvent()
        continue
      }

      this.#cursor += 1
      this.#latestResult = event.result
      if (event.type === 'completed') {
        this.#done = true
        this.#signal.removeEventListener('abort', this.#onAbort)
      }
      return { done: false, value: event }
    }
  }

  #waitForEvent(): Promise<void> {
    return new Promise((resolve) => this.#eventWaiters.add(resolve))
  }

  #waitUntilResumed(): Promise<void> {
    return new Promise((resolve) => this.#resumeWaiters.add(resolve))
  }

  #wakeEventWaiters(): void {
    for (const resolve of this.#eventWaiters) resolve()
    this.#eventWaiters.clear()
  }

  #wakeResumeWaiters(): void {
    for (const resolve of this.#resumeWaiters) resolve()
    this.#resumeWaiters.clear()
  }
}

export class MockExecutionClient implements ExecutionClient {
  async executeHttp(
    input: HttpExecutionInput,
    options: ExecutionOptions,
    signal: AbortSignal,
  ): Promise<HttpExecutionResult> {
    await yieldAbortableTurn(signal)
    throwIfAborted(signal)
    return simulateHttpRequest({ ...input, seed: options.seed ?? input.seed })
  }

  async openGrpc(
    input: GrpcExecutionInput,
    options: ExecutionOptions,
    signal: AbortSignal,
  ): Promise<GrpcExecutionSession> {
    await yieldAbortableTurn(signal)
    throwIfAborted(signal)
    const grpcOptions = {
      ...(input.body === undefined ? {} : { body: input.body }),
      ...(input.deadlineMs === undefined ? {} : { deadlineMs: input.deadlineMs }),
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
    }
    const result = simulateGrpcCall(
      input.methodId,
      input.callType,
      input.scenario,
      options.seed ?? input.seed ?? 2026,
      grpcOptions,
    )
    return new MockGrpcExecutionSession(input.callType, result, signal)
  }

  async startRun(
    plan: TestRunPlan,
    options: ExecutionOptions,
    signal: AbortSignal,
  ): Promise<TestRunSession> {
    await yieldAbortableTurn(signal)
    throwIfAborted(signal)
    const result = simulateRun({ ...plan, seed: options.seed ?? plan.seed })
    return new MockTestRunSession(result, signal)
  }
}
