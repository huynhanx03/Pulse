import { applyPreferencesToDocument } from '@/app/providers/apply-document-preferences'
import { i18n } from '@/lib/i18n/i18n'

describe('preference document synchronization', () => {
  it('applies locale, density, editor size and the resolved system theme', async () => {
    applyPreferencesToDocument(
      { theme: 'system', locale: 'en', density: 'comfortable', editorFontSize: 15 },
      true,
    )
    await vi.waitFor(() => expect(i18n.language).toBe('en'))

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveAttribute('data-density', 'comfortable')
    expect(document.documentElement).toHaveAttribute('lang', 'en')
    expect(document.documentElement.style.getPropertyValue('--editor-font-size')).toBe('15px')
  })
})
