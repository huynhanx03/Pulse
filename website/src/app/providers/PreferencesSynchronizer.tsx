import { useEffect } from 'react'

import { applyPreferencesToDocument } from '@/app/providers/apply-document-preferences'
import { usePulseStore } from '@/state/pulse-store'

export const PreferencesSynchronizer = () => {
  const preferences = usePulseStore((state) => state.preferences)

  useEffect(() => {
    applyPreferencesToDocument(preferences)
  }, [preferences])

  useEffect(() => {
    const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return
    const onChange = (event: MediaQueryListEvent) => {
      if (usePulseStore.getState().preferences.theme === 'system') {
        document.documentElement.dataset.theme = event.matches ? 'dark' : 'light'
      }
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return null
}
