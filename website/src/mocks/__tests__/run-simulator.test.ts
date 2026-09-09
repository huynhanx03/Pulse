import { simulateRun } from '@/mocks/simulators/run-simulator'

const config = {
  mode: 'functional' as const,
  seed: 42,
  durationSeconds: 10,
  targetRate: 30,
  workers: 8,
}
const passing = {
  label: 'row 1',
  status: 200,
  duration: 80,
  checks: [{ name: 'status', passed: true }],
}

describe('runner execution models', () => {
  it('runs a functional target once and honors its failed assertions', () => {
    const result = simulateRun({
      ...config,
      samples: [{ ...passing, checks: [{ name: 'custom assertion', passed: false }] }],
    })
    expect(result.metrics).toMatchObject({ total: 1, passed: 0, failures: 1 })
    expect(result.checks).toContainEqual({ name: 'custom assertion', passed: 0, failed: 1 })
  })

  it('executes exactly one iteration for every data row', () => {
    const result = simulateRun({
      ...config,
      mode: 'data',
      samples: [
        passing,
        { ...passing, label: 'row 2', status: 500, checks: [{ name: 'status', passed: false }] },
      ],
    })
    expect(result.metrics).toMatchObject({ total: 2, passed: 1, failures: 1 })
    expect(result.iterations).toHaveLength(2)
  })

  it('synchronizes a single burst without inventing extra attempts', () => {
    const result = simulateRun({ ...config, mode: 'race', workers: 3, samples: [passing] })
    expect(result.metrics.total).toBe(3)
    expect(result.collisions[0]).toMatchObject({ attempts: 3, winners: 1, conflicts: 2 })
  })

  it('ramps virtual users up and down', () => {
    const result = simulateRun({ ...config, mode: 'ramping-vus' })
    expect(result.series[0]!.active).toBeLessThan(result.series[4]!.active)
    expect(result.series.at(-1)!.active).toBeLessThan(result.series[4]!.active)
  })

  it('keeps constant virtual users distinct from a ramping profile', () => {
    const constant = simulateRun({ ...config, mode: 'constant-vus' })
    const ramping = simulateRun({ ...config, mode: 'ramping-vus' })

    expect(new Set(constant.series.map((point) => point.active))).toEqual(new Set([config.workers]))
    expect(new Set(ramping.series.map((point) => point.active)).size).toBeGreaterThan(1)
  })

  it('rejects invalid unbounded configuration instead of emitting NaN metrics', () => {
    expect(() => simulateRun({ ...config, durationSeconds: 0 })).toThrow()
    expect(() => simulateRun({ ...config, workers: Number.NaN })).toThrow()
    expect(() => simulateRun({ ...config, targetRate: 1e9 })).toThrow()
  })
})

describe('runner engine', () => {
  it('separates dropped iterations from target failures in arrival-rate mode', () => {
    const result = simulateRun({
      mode: 'arrival-rate',
      seed: 71,
      durationSeconds: 15,
      targetRate: 120,
      workers: 12,
    })

    expect(result.metrics.total).toBeGreaterThan(0)
    expect(result.metrics.dropped).toBeGreaterThan(0)
    expect(result.metrics.failures).toBeLessThan(result.metrics.dropped)
    expect(result.series).toHaveLength(15)
  })
})
