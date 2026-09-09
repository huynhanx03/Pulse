import { SeededRandom } from '@/mocks/deterministic-random'

describe('SeededRandom', () => {
  it('returns the same values for the same seed and fork label', () => {
    const first = new SeededRandom(20260830)
    const second = new SeededRandom(20260830)

    expect([first.float(), first.integer(4, 14), first.uuid()]).toEqual([
      second.float(),
      second.integer(4, 14),
      second.uuid(),
    ])
    expect(first.fork('orders').integer(1, 100)).toBe(second.fork('orders').integer(1, 100))
  })
})
