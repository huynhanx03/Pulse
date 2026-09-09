import type { Density, Locale, Preferences, ResolvedTheme, ThemeMode } from '@/domain/types'

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  locale: 'vi',
  density: 'compact',
  editorFontSize: 13,
}

const isTheme = (value: unknown): value is ThemeMode =>
  value === 'system' || value === 'light' || value === 'dark'
const isLocale = (value: unknown): value is Locale => value === 'vi' || value === 'en'
const isDensity = (value: unknown): value is Density =>
  value === 'comfortable' || value === 'compact'

export const normalizePreferences = (value: unknown): Preferences => {
  const candidate =
    typeof value === 'object' && value !== null ? (value as Partial<Preferences>) : {}
  const rawSize =
    typeof candidate.editorFontSize === 'number'
      ? candidate.editorFontSize
      : DEFAULT_PREFERENCES.editorFontSize
  return {
    theme: isTheme(candidate.theme) ? candidate.theme : DEFAULT_PREFERENCES.theme,
    locale: isLocale(candidate.locale) ? candidate.locale : DEFAULT_PREFERENCES.locale,
    density: isDensity(candidate.density) ? candidate.density : DEFAULT_PREFERENCES.density,
    editorFontSize: Math.min(18, Math.max(11, Math.round(rawSize))),
  }
}

export const resolveTheme = (theme: ThemeMode, systemDark: boolean): ResolvedTheme =>
  theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
