export type DistanceUnit = 'km' | 'mi'

export function getDistanceUnitFromSettings(): DistanceUnit {
  if (typeof window === 'undefined') return 'km'
  try {
    const raw = localStorage.getItem('garagebase_nastavitve')
    if (!raw) return 'km'
    const parsed = JSON.parse(raw)
    return parsed.enotaRazdalje === 'mi' ? 'mi' : 'km'
  } catch {
    return 'km'
  }
}

export function distanceUnitLabel(unit: DistanceUnit = getDistanceUnitFromSettings()) {
  return unit === 'mi' ? 'mi' : 'km'
}

export function formatDistance(value: number | string | null | undefined, unit: DistanceUnit = getDistanceUnitFromSettings()) {
  if (value === null || value === undefined || value === '') return ''
  const numeric = Number(value)
  const shown = Number.isFinite(numeric) ? numeric.toLocaleString() : String(value)
  return `${shown} ${distanceUnitLabel(unit)}`
}
