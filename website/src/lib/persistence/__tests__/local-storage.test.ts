import { LocalStorageAdapter } from '@/lib/persistence/local-storage'

describe('unavailable browser persistence', () => {
  it('retains edits in memory and reports degraded persistence instead of crashing', () => {
    const adapter = new LocalStorageAdapter(() => {
      throw new Error('storage blocked')
    })
    adapter.write('test-workspace', 'draft')
    expect(adapter.read('test-workspace')).toBe('draft')
    expect(adapter.persistent).toBe(false)
    adapter.remove('test-workspace')
    expect(adapter.read('test-workspace')).toBeNull()
  })
})
