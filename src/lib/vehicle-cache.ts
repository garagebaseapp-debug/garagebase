'use client'

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
