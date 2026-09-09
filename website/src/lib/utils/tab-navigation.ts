import type { KeyboardEvent } from 'react'

/** Automatic activation for horizontal tablists, without intercepting editor keys. */
export const navigateTabList = (event: KeyboardEvent<HTMLElement>): void => {
  if (!(event.target instanceof HTMLElement)) return
  const isRequestNavigation = event.target.hasAttribute('data-request-tab')
  if (!isRequestNavigation && event.target.getAttribute('role') !== 'tab') return
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  const list = event.target.closest(
    isRequestNavigation ? '[data-request-tabs]' : '[role="tablist"]',
  )
  const tabs = Array.from(
    list?.querySelectorAll<HTMLElement>(
      isRequestNavigation ? '[data-request-tab]' : '[role="tab"]:not([disabled])',
    ) ?? [],
  )
  const index = tabs.indexOf(event.target)
  if (index < 0 || tabs.length === 0) return
  event.preventDefault()
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
  tabs[next]?.focus()
  tabs[next]?.click()
}
