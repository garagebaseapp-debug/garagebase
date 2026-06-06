'use client'

import { useState } from 'react'
import { BackButton, BottomNav } from '@/lib/nav'
import { getStoredLanguage } from '@/lib/i18n'

type VehicleLookupResult = {
  found?: boolean
  vehicle?: {
    make?: string | null
    model?: string | null
    year?: number | string | null
    fuel?: string | null
    vinLast4?: string | null
    plate?: string | null
  }
  history?: {
    latestMileage?: number | string | null
    lastServiceDate?: string | null
    hasServiceHistory?: boolean | null
    documentsAvailableOnRequest?: boolean | null
  }
}

export default function PreveriVoziloPage() {
  const [language] = useState<'sl' | 'en'>(() => getStoredLanguage() === 'en' ? 'en' : 'sl')
  const [vin, setVin] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VehicleLookupResult | null>(null)
  const [message, setMessage] = useState('')
  const tx = (sl: string, en: string) => language === 'en' ? en : sl

  const checkVehicle = async () => {
    const normalized = vin.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (normalized.length < 6) {
      setMessage(tx('Vpiši VIN ali številko šasije.', 'Enter the VIN or chassis number.'))
      return
    }
    setLoading(true)
    setMessage('')
    setResult(null)
    try {
      const response = await fetch('/api/vehicle-registry/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin: normalized }),
      })
      const data = await response.json().catch(() => ({})) as VehicleLookupResult & { error?: string }
      if (!response.ok) throw new Error(data.error || 'lookup_failed')
      setResult(data)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : ''
      setMessage(message === 'rate_limited'
        ? tx('Preveč preverjanj. Poskusi malo kasneje.', 'Too many checks. Try again later.')
        : tx('Preverjanje trenutno ni uspelo.', 'Lookup failed for now.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <BackButton href="/vec" />
          <div>
            <h1 className="text-2xl font-black">{tx('Preveri vozilo', 'Check vehicle')}</h1>
            <p className="mt-1 text-xs text-[#8a8aa8]">{tx('Iskanje deluje samo za vozila, kjer je lastnik izrecno dovolil preverjanje.', 'Lookup works only for vehicles where the owner explicitly allowed verification.')}</p>
          </div>
        </div>

        <div className="rounded-[28px] border border-[#1e1e32] bg-[#0f0f1a] p-5 shadow-2xl shadow-black/20">
          <label className="text-xs font-black uppercase tracking-[0.22em] text-[#6c63ff]">VIN</label>
          <input
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
            placeholder={tx('VIN ali številka šasije', 'VIN or chassis number')}
            maxLength={32}
            className="mt-3 w-full rounded-2xl border border-[#2a2a44] bg-[#13131f] px-4 py-4 font-mono text-lg tracking-widest text-white outline-none focus:border-[#6c63ff]"
          />
          <button onClick={checkVehicle} disabled={loading}
            className="mt-4 w-full rounded-2xl bg-[#6c63ff] px-5 py-4 text-sm font-black text-white shadow-xl shadow-[#6c63ff33] disabled:opacity-50">
            {loading ? tx('Preverjam...', 'Checking...') : tx('Preveri v GarageBase bazi', 'Check in GarageBase database')}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-[#8a8aa8]">
            {tx('GarageBase ne prikaže imena, e-maila ali zasebnih dokumentov lastnika. Vidni so samo podatki, za katere je lastnik dal privolitev.', 'GarageBase does not show the owner name, email or private documents. Only data allowed by the owner is visible.')}
          </p>
        </div>

        {message && <div className="mt-4 rounded-2xl border border-[#ef444444] bg-[#ef444422] p-4 text-sm font-bold text-[#fca5a5]">{message}</div>}

        {result && (
          <div className={`mt-4 rounded-[28px] border p-5 ${result.found ? 'border-[#3ecfcf55] bg-[#3ecfcf11]' : 'border-[#f59e0b55] bg-[#f59e0b12]'}`}>
            {!result.found ? (
              <div>
                <p className="text-lg font-black text-[#fbbf24]">{tx('Vozila ni v javnem preverjanju', 'Vehicle is not in public lookup')}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#c7c7d8]">
                  {tx('To ne pomeni, da vozilo nima zgodovine. Pomeni samo, da lastnik ni dovolil javnega preverjanja v GarageBase bazi.', 'This does not mean the vehicle has no history. It only means the owner did not allow public lookup in GarageBase.')}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#3ecfcf]">GarageBase</p>
                <h2 className="mt-2 text-2xl font-black">
                  {[result.vehicle?.make, result.vehicle?.model].filter(Boolean).join(' ') || tx('Najdeno vozilo', 'Vehicle found')}
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    [tx('Letnik', 'Year'), result.vehicle?.year || '-'],
                    [tx('Gorivo', 'Fuel'), result.vehicle?.fuel || '-'],
                    [tx('VIN konec', 'VIN ending'), result.vehicle?.vinLast4 ? `****${result.vehicle.vinLast4}` : '-'],
                    [tx('Tablica', 'Plate'), result.vehicle?.plate || tx('Ni deljena', 'Not shared')],
                    [tx('Zadnji znani km', 'Latest known km'), result.history?.latestMileage ? `${Number(result.history.latestMileage).toLocaleString(language === 'en' ? 'en-US' : 'sl-SI')} km` : tx('Ni deljeno', 'Not shared')],
                    [tx('Zadnji servis', 'Last service'), result.history?.lastServiceDate || tx('Ni deljeno', 'Not shared')],
                    [tx('Servisna zgodovina', 'Service history'), result.history?.hasServiceHistory === null ? tx('Ni deljeno', 'Not shared') : result.history?.hasServiceHistory ? tx('Obstaja', 'Available') : tx('Ni zapisov', 'No records')],
                    [tx('Dokazila', 'Documents'), result.history?.documentsAvailableOnRequest ? tx('Na zahtevo', 'On request') : tx('Ni deljeno', 'Not shared')],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-[#ffffff12] bg-[#08081066] p-3">
                      <p className="text-[11px] font-black uppercase tracking-wider text-[#8a8aa8]">{label}</p>
                      <p className="mt-1 text-lg font-black text-white">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
