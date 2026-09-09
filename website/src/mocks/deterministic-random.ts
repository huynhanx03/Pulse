const UINT32_MAX = 0x1_0000_0000

const hashString = (value: string): number => {
  let hash = 2_166_136_261
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

export class SeededRandom {
  readonly #initialSeed: number
  #state: number

  constructor(seed: number | string) {
    const normalized = typeof seed === 'string' ? hashString(seed) : seed >>> 0
    this.#initialSeed = normalized || 0x6d2b79f5
    this.#state = this.#initialSeed
  }

  float(): number {
    this.#state += 0x6d2b79f5
    let value = this.#state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_MAX
  }

  integer(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError('SeededRandom.integer requires integer bounds where max >= min.')
    }
    return Math.floor(this.float() * (max - min + 1)) + min
  }

  pick<T>(values: readonly T[]): T {
    if (values.length === 0) {
      throw new RangeError('SeededRandom.pick requires at least one value.')
    }
    return values[this.integer(0, values.length - 1)] as T
  }

  uuid(): string {
    const bytes = Array.from({ length: 16 }, () => this.integer(0, 255))
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
    const hex = bytes.map((value) => value.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  fork(label: string): SeededRandom {
    return new SeededRandom(hashString(`${this.#initialSeed}:${label}`))
  }
}
