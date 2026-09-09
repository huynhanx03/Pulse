import type { GrpcExecutionEvent, GrpcExecutionInput, JsonValue } from '@/domain/execution/grpc'
import type { HttpExecutionInput, HttpExecutionResult } from '@/domain/execution/http'
import type { TestRunEvent, TestRunPlan } from '@/domain/runner/types'

export interface ExecutionOptions {
  /** Replaces the plan seed for deterministic replay without mutating the saved request. */
  seed?: number
}

export interface GrpcExecutionSession {
  readonly events: AsyncIterable<GrpcExecutionEvent>
  send(message: JsonValue): Promise<void>
  pause(): void
  resume(): void
  halfClose(): Promise<void>
  cancel(): void
}

export interface TestRunSession {
  readonly events: AsyncIterable<TestRunEvent>
  pause(): void
  resume(): void
  stop(): void
}

export interface ExecutionClient {
  executeHttp(
    input: HttpExecutionInput,
    options: ExecutionOptions,
    signal: AbortSignal,
  ): Promise<HttpExecutionResult>
  openGrpc(
    input: GrpcExecutionInput,
    options: ExecutionOptions,
    signal: AbortSignal,
  ): Promise<GrpcExecutionSession>
  startRun(
    plan: TestRunPlan,
    options: ExecutionOptions,
    signal: AbortSignal,
  ): Promise<TestRunSession>
}

export class ExecutionAbortedError extends Error {
  override readonly name = 'ExecutionAbortedError'
  readonly code = 'aborted'

  constructor() {
    super('Execution was aborted.')
  }
}

export type GrpcTransitionCode =
  | 'session-closed'
  | 'unsupported-operation'
  | 'already-paused'
  | 'not-paused'
  | 'already-half-closed'

export class GrpcTransitionError extends Error {
  override readonly name = 'GrpcTransitionError'
  readonly code: GrpcTransitionCode

  constructor(code: GrpcTransitionCode, message: string) {
    super(message)
    this.code = code
  }
}

export type RunTransitionCode = 'session-closed' | 'already-paused' | 'not-paused'

export class RunTransitionError extends Error {
  override readonly name = 'RunTransitionError'
  readonly code: RunTransitionCode

  constructor(code: RunTransitionCode, message: string) {
    super(message)
    this.code = code
  }
}
