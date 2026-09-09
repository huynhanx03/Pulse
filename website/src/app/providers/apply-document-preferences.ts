import type { Preferences } from '@/domain/types'
import { i18n } from '@/lib/i18n/i18n'
import { resolveTheme } from '@/lib/preferences/preferences'

export const applyPreferencesToDocument = (
  preferences: Preferences,
  systemDark = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true,
): void => {
  document.documentElement.dataset.theme = resolveTheme(preferences.theme, systemDark)
  document.documentElement.dataset.density = preferences.density
  document.documentElement.lang = preferences.locale
  document.documentElement.style.setProperty(
    '--editor-font-size',
    `${preferences.editorFontSize}px`,
  )
  void i18n.changeLanguage(preferences.locale)
}
