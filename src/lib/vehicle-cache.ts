'use client'

export const VEHICLE_STATS_CACHE_VERSION = 'vehicle-stats-2026-05-13-0915'

export const clearVehicleDataCaches = (carId?: string | null) => {
  if (typeof window === 'undefined' || !carId) return
  const keys = [
    `garagebase_dashboard_cache_${carId}`,
    `garagebase_vehicle_stats_${carId}`,
    `garagebase_stroski_cache_${carId}`,
    `garagebase_cost_totals_${carId}`,
    `garagebase_fuel_history_cache_${carId}`,
    'garagebase_stroski_garaza_cache',
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
