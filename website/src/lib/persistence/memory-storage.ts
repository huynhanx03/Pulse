import type { StorageAdapter } from '@/lib/persistence/types'

export class MemoryStorageAdapter implements StorageAdapter {
  readonly #values = new Map<string, string>()

  constructor(initial: Readonly<Record<string, string>> = {}) {
    for (const [key, value] of Object.entries(initial)) this.#values.set(key, value)
  }

  read(key: string): string | null {
    return this.#values.get(key) ?? null
  }

  write(key: string, value: string): void {
    this.#values.set(key, value)
  }

  remove(key: string): void {
    this.#values.delete(key)
  }
}
