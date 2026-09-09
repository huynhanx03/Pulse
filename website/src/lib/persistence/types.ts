export interface StorageAdapter {
  readonly persistent?: boolean
  read(key: string): string | null
  write(key: string, value: string): void
  remove(key: string): void
}
