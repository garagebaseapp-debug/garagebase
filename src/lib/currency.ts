'use client'

export type GarageBaseCurrency = 'EUR' | 'USD'

export const getCurrencyFromSettings = (): GarageBaseCurrency => {
  if (typeof window === 'undefined') return 'EUR'
  try {
    const settings = JSON.parse(localStorage.getItem('garagebase_nastavitve') || '{}')
    return settings.valuta === 'USD' ? 'USD' : 'EUR'
  } catch {
    return 'EUR'
  }
}

export const currencySymbol = (currency: GarageBaseCurrency) => currency === 'USD' ? '$' : '\u20ac'

export const formatMoney = (value?: number | null, currency: GarageBaseCurrency = 'EUR', decimals = 2) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return `${value.toFixed(decimals)} ${currencySymbol(currency)}`
}
