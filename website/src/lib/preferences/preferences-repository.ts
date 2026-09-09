import type { Preferences } from '@/domain/types'
import { DEFAULT_PREFERENCES, normalizePreferences } from '@/lib/preferences/preferences'
import type { StorageAdapter } from '@/lib/persistence/types'

const PREFERENCES_KEY = 'pulse:preferences:v1'

export class PreferencesRepository {
  readonly #storage: StorageAdapter

  constructor(storage: StorageAdapter) {
    this.#storage = storage
  }

  load(): Preferences {
    const stored = this.#storage.read(PREFERENCES_KEY)
    if (!stored) return DEFAULT_PREFERENCES
    try {
      return normalizePreferences(JSON.parse(stored) as unknown)
    } catch {
      return DEFAULT_PREFERENCES
    }
  }

  save(preferences: Preferences): void {
    this.#storage.write(PREFERENCES_KEY, JSON.stringify(normalizePreferences(preferences)))
  }
}
