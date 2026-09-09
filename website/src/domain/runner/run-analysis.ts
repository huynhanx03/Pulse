import type { SimulatedRun, TestRunPlan } from '@/domain/runner/types'

export const isValidTestRunPlan = (input: TestRunPlan): boolean =>
  Number.isSafeInteger(input.seed) &&
  Number.isInteger(input.workers) &&
  input.workers >= 1 &&
  input.workers <= 1_000 &&
  Number.isInteger(input.durationSeconds) &&
  input.durationSeconds >= 1 &&
  input.durationSeconds <= 300 &&
  Number.isInteger(input.targetRate) &&
  input.targetRate >= 1 &&
  input.targetRate <= 100_000 &&
  (input.mode !== 'ramping-vus' ||
    ([input.rampUpSeconds, input.holdSeconds, input.rampDownSeconds].every(
      (value) => value === undefined || (Number.isInteger(value) && value >= 1),
    ) &&
      (input.rampUpSeconds === undefined ||
        input.holdSeconds === undefined ||
        input.rampDownSeconds === undefined ||
        input.rampUpSeconds + input.holdSeconds + input.rampDownSeconds === input.durationSeconds)))

export const percentile = (values: readonly number[], quantile: number): number => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)] ?? 0
}

/** Projects an immutable completed result for deterministic live playback. */
export const projectRunProgress = (result: SimulatedRun, progress: number): SimulatedRun => {
  if (progress >= 100) return result
  const ratio = Math.max(0, progress) / 100
  const iterations = result.iterations.slice(0, Math.floor(result.iterations.length * ratio))
  const series = result.series.slice(0, Math.floor(result.series.length * ratio))
  const total = result.iterations.length
    ? iterations.length
    : series.reduce((sum, point) => sum + point.throughput, 0)
  const failures = result.iterations.length
    ? iterations.filter((iteration) => !iteration.passed).length
    : series.reduce((sum, point) => sum + point.errors, 0)
  const latencies = result.iterations.length
    ? iterations.map((iteration) => iteration.duration)
    : series.map((point) => point.p95)
  return {
    metrics: {
      total,
      failures,
      passed: total - failures,
      dropped: series.reduce((sum, point) => sum + point.dropped, 0),
      throughput: total / Math.max(1, series.length),
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
      collisionRate: 0,
    },
    series,
    iterations,
    collisions: [],
    checks: [],
  }
}
