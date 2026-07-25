'use client'

export const GARAGE_CACHE_VERSION = 'garaza-2026-05-15-0915'
export const VEHICLE_STATS_CACHE_VERSION = 'vehicle-stats-2026-05-13-1145'
export const GARAGE_CACHE_MAX_AGE_MS = 5 * 60 * 1000

export const clearGarageCache = () => {
  if (typeof window === 'undefined') return
  localStorage.removeItem('garagebase_garaza_cache')
}

export const readGarageCache = () => {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('garagebase_garaza_cache')
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    const savedAt = Number(parsed?.savedAt || 0)
    const age = Date.now() - savedAt
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    const fresh = offline || (Number.isFinite(age) && age >= 0 && age <= GARAGE_CACHE_MAX_AGE_MS)
    const activeMode = parsed?.arhiv === false
    const cars = Array.isArray(parsed?.avti) ? parsed.avti : []
    const hasArchivedCars = cars.some((car: { arhivirano?: boolean }) => car?.arhivirano === true)

    if (parsed?.version !== GARAGE_CACHE_VERSION || !activeMode || !fresh || hasArchivedCars) {
      clearGarageCache()
      return null
    }

    return { ...parsed, avti: cars }
  } catch {
    clearGarageCache()
    return null
  }
}

export const imageUrlWithVersion = (url: string, version: string | number | null | undefined = GARAGE_CACHE_VERSION) => {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}gbv=${encodeURIComponent(String(version || GARAGE_CACHE_VERSION))}`
}

export const clearVehicleDataCaches = (carId?: string | null) => {
  if (typeof window === 'undefined' || !carId) return
  const keys = [
    `garagebase_dashboard_cache_${carId}`,
    `garagebase_vehicle_stats_${carId}`,
    `garagebase_stroski_cache_${carId}`,
    `garagebase_cost_totals_${carId}`,
    `garagebase_fuel_history_cache_${carId}`,
    'garagebase_stroski_garaza_cache',
    'garagebase_stroski_garaza_cache_v2',
    'garagebase_garaza_cache',
  ]
  keys.forEach((key) => localStorage.removeItem(key))
}

export const ensureVehicleStatsCacheVersion = (version: string) => {
  if (typeof window === 'undefined') return
  const versionKey = 'garagebase_vehicle_stats_cache_version'
  if (localStorage.getItem(versionKey) === version) return

  const prefixes = [
    'garagebase_dashboard_cache_',
    'garagebase_vehicle_stats_',
    'garagebase_stroski_cache_',
    'garagebase_cost_totals_',
    'garagebase_fuel_history_cache_',
  ]

  for (let index = localStorage.length - 1; index >= 0; index--) {
    const key = localStorage.key(index)
    if (!key) continue
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      localStorage.removeItem(key)
    }
  }

  localStorage.setItem(versionKey, version)
}
