'use client'

import { useEffect, useState } from 'react'

export type Language = 'sl' | 'en'

const labels: Record<string, Record<Language, string>> = {
  home: { sl: 'Domov', en: 'Home' },
  garage: { sl: 'Garaža', en: 'Garage' },
  fuel: { sl: 'Gorivo', en: 'Fuel' },
  service: { sl: 'Servis', en: 'Service' },
  costs: { sl: 'Stroški', en: 'Costs' },
  more: { sl: 'Več', en: 'More' },
  back: { sl: 'Nazaj', en: 'Back' },
}

export function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'sl'
  try {
    const raw = localStorage.getItem('garagebase_nastavitve')
    if (!raw) return 'sl'
    const parsed = JSON.parse(raw)
    return parsed.jezik === 'en' ? 'en' : 'sl'
  } catch {
    return 'sl'
  }
}

export function saveStoredLanguage(language: Language) {
  const raw = localStorage.getItem('garagebase_nastavitve')
  const current = raw ? JSON.parse(raw) : {}
  localStorage.setItem('garagebase_nastavitve', JSON.stringify({ ...current, jezik: language }))
  document.documentElement.lang = language
  window.dispatchEvent(new CustomEvent('garagebase-language-change', { detail: language }))
}

export function useLanguage() {
  const [language, setLanguage] = useState<Language>('sl')

  useEffect(() => {
    setLanguage(getStoredLanguage())
    const onChange = (event: Event) => {
      setLanguage((event as CustomEvent<Language>).detail || getStoredLanguage())
    }
    window.addEventListener('garagebase-language-change', onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener('garagebase-language-change', onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  const t = (key: keyof typeof labels) => labels[key]?.[language] || labels[key]?.sl || key
  return { language, t }
}
