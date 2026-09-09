import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { en } from '@/messages/en'
import { vi } from '@/messages/vi'

void i18n.use(initReactI18next).init({
  resources: {
    vi: { translation: vi },
    en: { translation: en },
  },
  lng: 'vi',
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
  returnNull: false,
  react: { useSuspense: false },
})

export { i18n }
