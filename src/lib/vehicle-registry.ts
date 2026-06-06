import { createHash } from 'crypto'

export const vehicleRegistryConsentVersion = '2026-05-22-v1'

export type VehicleRegistryVisibility = {
  showPlate: boolean
  showMileage: boolean
  showServiceSummary: boolean
  showCostSummary: boolean
  showDocuments: boolean
}

export const defaultRegistryVisibility: VehicleRegistryVisibility = {
  showPlate: false,
  showMileage: true,
  showServiceSummary: true,
  showCostSummary: false,
  showDocuments: false,
}

export function normalizeVin(value: string) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function validLookupVin(value: string) {
  const normalized = normalizeVin(value)
  return normalized.length >= 6 && normalized.length <= 32
}

export function vinHash(value: string) {
  const normalized = normalizeVin(value)
  const salt = process.env.VEHICLE_REGISTRY_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'garagebase-registry'
  return createHash('sha256').update(`${salt}:${normalized}`).digest('hex')
}

export function sanitizeRegistryVisibility(value: unknown): VehicleRegistryVisibility {
  const raw = value && typeof value === 'object' ? value as Partial<Record<keyof VehicleRegistryVisibility, unknown>> : {}
  return {
    showPlate: Boolean(raw.showPlate),
    showMileage: raw.showMileage !== false,
    showServiceSummary: raw.showServiceSummary !== false,
    showCostSummary: Boolean(raw.showCostSummary),
    showDocuments: Boolean(raw.showDocuments),
  }
}
