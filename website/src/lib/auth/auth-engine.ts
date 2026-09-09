import { readJsonPath } from '@/domain/auth/json-path'
import type { AuthExpiryFormat } from '@/domain/types'

export interface TokenCaptureRules {
  accessTokenPath: string
  refreshTokenPath: string
  expiresInPath: string
  expiryFormat: AuthExpiryFormat
}

export interface CapturedTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/

const toValidDate = (milliseconds: number): Date => {
  const date = new Date(milliseconds)
  if (!Number.isFinite(milliseconds) || Number.isNaN(date.getTime())) {
    throw new Error('The configured expiry value is outside the supported date range.')
  }
  return date
}

const parseExpiry = (value: unknown, format: AuthExpiryFormat, now: Date): Date => {
  if (format === 'iso-8601') {
    if (typeof value !== 'string' || !ISO_8601_PATTERN.test(value)) {
      throw new Error('The configured expiry value is not an ISO-8601 timestamp.')
    }
    return toValidDate(Date.parse(value))
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('The configured expiry value is not a non-negative number.')
  }

  if (format === 'expires-in-seconds') return toValidDate(now.getTime() + value * 1000)
  if (format === 'unix-seconds') return toValidDate(value * 1000)
  return toValidDate(value)
}

export const captureTokens = (
  response: unknown,
  rules: TokenCaptureRules,
  now: Date,
): CapturedTokens => {
  const accessToken = readJsonPath(response, rules.accessTokenPath)
  const refreshToken = readJsonPath(response, rules.refreshTokenPath)
  const expiry = readJsonPath(response, rules.expiresInPath)

  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
    throw new Error('Token capture paths did not resolve to the expected values.')
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: parseExpiry(expiry, rules.expiryFormat, now),
  }
}

export const shouldRefresh = (expiresAt: Date, now: Date, windowSeconds: number): boolean =>
  expiresAt.getTime() - now.getTime() <= windowSeconds * 1000
