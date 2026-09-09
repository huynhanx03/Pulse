import type { StorageAdapter } from '@/lib/persistence/types'

export class LocalStorageAdapter implements StorageAdapter {
  readonly #provider: () => Storage
  readonly #memory = new Map<string, string | null>()
  persistent = true

  constructor(provider: () => Storage = () => globalThis.localStorage) {
    this.#provider = provider
  }

  read(key: string): string | null {
    if (this.#memory.has(key)) return this.#memory.get(key) ?? null
    try {
      return this.#provider().getItem(key)
    } catch {
      this.persistent = false
      return null
    }
  }

  write(key: string, value: string): void {
    this.#memory.set(key, value)
    try {
      this.#provider().setItem(key, value)
    } catch {
      this.persistent = false
    }
  }

  remove(key: string): void {
    this.#memory.set(key, null)
    try {
      this.#provider().removeItem(key)
    } catch {
      this.persistent = false
    }
  }
}
