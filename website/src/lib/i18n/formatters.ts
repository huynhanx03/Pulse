import type { Locale } from '@/domain/types'

const localeCode = (locale: Locale): string => (locale === 'vi' ? 'vi-VN' : 'en-US')

export const formatNumber = (value: number, locale: Locale, maximumFractionDigits = 1): string =>
  new Intl.NumberFormat(localeCode(locale), { maximumFractionDigits }).format(value)

export const formatDuration = (milliseconds: number, locale: Locale): string =>
  milliseconds < 1000
    ? `${formatNumber(milliseconds, locale, 0)} ms`
    : `${formatNumber(milliseconds / 1000, locale, 2)} s`

export const formatBytes = (bytes: number, locale: Locale): string => {
  if (bytes < 1024) return `${formatNumber(bytes, locale, 0)} B`
  if (bytes < 1024 ** 2) return `${formatNumber(bytes / 1024, locale, 1)} KB`
  return `${formatNumber(bytes / 1024 ** 2, locale, 1)} MB`
}

export const formatPercent = (value: number, locale: Locale): string =>
  new Intl.NumberFormat(localeCode(locale), { style: 'percent', maximumFractionDigits: 1 }).format(
    value,
  )

export const formatDateTime = (value: string | Date, locale: Locale): string =>
  new Intl.DateTimeFormat(localeCode(locale), { dateStyle: 'medium', timeStyle: 'medium' }).format(
    new Date(value),
  )
