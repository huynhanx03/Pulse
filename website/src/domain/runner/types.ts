export type RunnerMode =
  'functional' | 'data' | 'race' | 'constant-vus' | 'ramping-vus' | 'arrival-rate'

export interface TestRunPlan {
  mode: RunnerMode
  seed: number
  durationSeconds: number
  targetRate: number
  workers: number
  rampUpSeconds?: number
  holdSeconds?: number
  rampDownSeconds?: number
  samples?: readonly RunnerSample[]
  resource?: string
}

export interface RunnerSample {
  label: string
  status: number
  duration: number
  checks: Array<{ name: string; passed: boolean }>
  input?: string
}

export interface RunIteration extends RunnerSample {
  passed: boolean
}

export interface RunPoint {
  second: number
  throughput: number
  p95: number
  errors: number
  active: number
  dropped: number
}

export interface RunMetrics {
  total: number
  passed: number
  failures: number
  dropped: number
  throughput: number
  p50: number
  p95: number
  p99: number
  collisionRate: number
}

export interface SimulatedRun {
  metrics: RunMetrics
  series: RunPoint[]
  checks: Array<{ name: string; passed: number; failed: number }>
  collisions: Array<{ resource: string; attempts: number; winners: number; conflicts: number }>
  iterations: RunIteration[]
}

export type TestRunEvent =
  | { type: 'snapshot'; progress: number; result: SimulatedRun }
  | {
      type: 'completed'
      outcome: 'completed' | 'stopped' | 'cancelled'
      result: SimulatedRun
    }
