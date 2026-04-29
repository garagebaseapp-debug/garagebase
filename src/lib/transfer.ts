export type TransferMode = 'verify' | 'import'

export function createTransferToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

export function scanUrl(token: string) {
  if (typeof window === 'undefined') return `/scan?t=${token}`
  return `${window.location.origin}/scan?t=${token}`
}

export function getTokenFromScanValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  try {
    const url = new URL(trimmed)
    return url.searchParams.get('t') || trimmed
  } catch {
    return trimmed
  }
}

export function cleanTransferRows(rows: any[], carId: string, transferId?: string) {
  return rows.map(({ id, created_at, updated_at, car_id, source_transfer_id, source_entry_id, source_owner_label, ...rest }) => {
    const row: any = { ...rest, car_id: carId }
    if (transferId || source_transfer_id || source_entry_id) {
      row.source_transfer_id = transferId || source_transfer_id || null
      row.source_entry_id = source_entry_id || id || null
      row.source_owner_label = source_owner_label || 'Prejsnji lastnik'
      row.verification_level = rest.verification_level || 'basic'
    }
    return row
  })
}

export function maskVin(vin?: string | null) {
  if (!vin) return null
  if (vin.length <= 8) return vin.substring(0, 3) + '****'
  return `${vin.substring(0, 6)}****${vin.substring(vin.length - 4)}`
}
