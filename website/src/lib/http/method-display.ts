import type { HttpMethod } from '@/domain/types'

export type HttpMethodTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

export const httpMethodTone = (method: string | undefined): HttpMethodTone => {
  switch (method) {
    case 'GET':
      return 'info'
    case 'POST':
      return 'success'
    case 'PUT':
    case 'PATCH':
      return 'warning'
    case 'DELETE':
      return 'danger'
    default:
      return 'neutral'
  }
}

export const httpMethodTextClass = (method: HttpMethod) => {
  switch (httpMethodTone(method)) {
    case 'info':
      return 'text-info'
    case 'success':
      return 'text-success'
    case 'warning':
      return 'text-warning'
    case 'danger':
      return 'text-danger'
    default:
      return 'text-ink-muted'
  }
}
