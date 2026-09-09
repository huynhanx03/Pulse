import type {
  RunnerSample,
  RunIteration,
  RunPoint,
  SimulatedRun,
  TestRunPlan,
} from '@/domain/runner/types'
import { isValidTestRunPlan, percentile, projectRunProgress } from '@/domain/runner/run-analysis'
import { SeededRandom } from '@/mocks/deterministic-random'

export { isValidTestRunPlan, projectRunProgress }

export const simulateRun = (input: TestRunPlan): SimulatedRun => {
  if (!isValidTestRunPlan(input)) throw new Error('Invalid runner configuration')
  const random = new SeededRandom(
    `${input.seed}:${input.mode}:${input.workers}:${input.targetRate}`,
  )
  const samples = input.samples ?? [
    {
      label: 'Mock target',
      status: 200,
      duration: 80,
      checks: [{ name: 'Status is successful', passed: true }],
    },
  ]
  if (samples.length === 0) throw new Error('A run needs at least one sample')
  const samplePassed = (sample: RunnerSample) => sample.checks.every((check) => check.passed)
  const finite = input.mode === 'functional' || input.mode === 'data' || input.mode === 'race'
  const attempts =
    input.mode === 'functional' ? 1 : input.mode === 'data' ? samples.length : input.workers
  const iterations: RunIteration[] = finite
    ? Array.from({ length: attempts }, (_, index) => {
        const sample = samples[index % samples.length]!
        const conflict = input.mode === 'race' && index > 0 && samplePassed(samples[0]!)
        return {
          ...sample,
          label: input.mode === 'race' ? `worker ${index + 1}` : sample.label,
          status: conflict ? 409 : sample.status,
          checks: conflict
            ? [...sample.checks, { name: 'Single-winner barrier', passed: false }]
            : sample.checks,
          passed: !conflict && samplePassed(sample),
        }
      })
    : []
  const failedRatio = samples.filter((sample) => !samplePassed(sample)).length / samples.length
  const duration = finite ? 1 : input.durationSeconds
  const rampUp = input.rampUpSeconds ?? Math.max(1, Math.round(duration * 0.3))
  const hold = input.holdSeconds ?? Math.max(1, Math.round(duration * 0.4))
  const rampDown = input.rampDownSeconds ?? Math.max(1, duration - rampUp - hold)
  let total = 0
  let dropped = 0
  let failures = 0
  const series = Array.from({ length: duration }, (_, index): RunPoint => {
    const second = index + 1
    const active =
      input.mode === 'ramping-vus'
        ? second <= rampUp
          ? Math.max(1, Math.round((input.workers * second) / rampUp))
          : second <= rampUp + hold
            ? input.workers
            : Math.max(
                1,
                Math.round(
                  (input.workers * Math.max(0, rampDown - (second - rampUp - hold))) / rampDown,
                ),
              )
        : input.workers
    const requested = finite
      ? attempts
      : input.mode === 'arrival-rate'
        ? input.targetRate
        : Math.max(1, active * random.integer(2, 5))
    const throughput = finite
      ? requested
      : Math.min(requested, Math.max(1, active * 5 + random.integer(-3, 6)))
    const pointDropped = input.mode === 'arrival-rate' ? Math.max(0, requested - throughput) : 0
    const errors = finite
      ? iterations.filter((iteration) => !iteration.passed).length
      : Math.round(throughput * failedRatio)
    total += throughput
    dropped += pointDropped
    failures += errors
    return {
      second: index + 1,
      throughput,
      p95: finite
        ? percentile(
            samples.map((sample) => sample.duration),
            0.95,
          )
        : random.integer(72, input.mode === 'arrival-rate' ? 510 : 280),
      errors,
      active,
      dropped: pointDropped,
    }
  })
  const latencies = finite
    ? samples.map((sample) => sample.duration)
    : series.map((point) => point.p95)
  const p95 = percentile(latencies, 0.95)
  const passed = Math.max(0, total - failures)
  const winners = input.mode === 'race' && samplePassed(samples[0]!) ? 1 : 0
  const conflicts = input.mode === 'race' && winners ? input.workers - winners : 0
  const checkCounts = new Map<string, { name: string; passed: number; failed: number }>()
  const checkedSamples = finite ? iterations : samples
  const weight = finite ? 1 : total / samples.length
  for (const sample of checkedSamples) {
    for (const check of sample.checks) {
      const count = checkCounts.get(check.name) ?? { name: check.name, passed: 0, failed: 0 }
      if (check.passed) count.passed += weight
      else count.failed += weight
      checkCounts.set(check.name, count)
    }
  }
  return {
    metrics: {
      total,
      passed,
      failures,
      dropped,
      throughput: Number((total / duration).toFixed(1)),
      p50: percentile(latencies, 0.5),
      p95,
      p99: percentile(latencies, 0.99),
      collisionRate: input.mode === 'race' ? conflicts / input.workers : 0,
    },
    series,
    checks: [...checkCounts.values()].map((check) => ({
      ...check,
      passed: Math.round(check.passed),
      failed: Math.round(check.failed),
    })),
    collisions:
      input.mode === 'race'
        ? [
            {
              resource: input.resource ?? 'mock:shared-resource',
              attempts: input.workers,
              winners,
              conflicts,
            },
          ]
        : [],
    iterations,
  }
}
