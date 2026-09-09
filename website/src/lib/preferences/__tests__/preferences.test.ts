import { normalizePreferences, resolveTheme } from '@/lib/preferences/preferences'

describe('preferences', () => {
  it('normalizes corrupt values and clamps the editor font size', () => {
    expect(normalizePreferences({ theme: 'neon', locale: 'fr', editorFontSize: 99 })).toEqual({
      theme: 'system',
      locale: 'vi',
      density: 'compact',
      editorFontSize: 18,
    })
  })

  it('resolves system theme without overriding an explicit choice', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })
})
