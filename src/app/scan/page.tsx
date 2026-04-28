'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton, HomeButton } from '@/lib/nav'
import { cleanTransferRows, getTokenFromScanValue } from '@/lib/transfer'

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [transfer, setTransfer] = useState<any>(null)
  const [payload, setPayload] = useState<any>(null)
  const [cars, setCars] = useState<any[]>([])
  const [targetCar, setTargetCar] = useState('')
  const [message, setMessage] = useState('')
  const [cameraOn, setCameraOn] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const { data } = await supabase.from('cars').select('id, znamka, model, km_trenutni').eq('user_id', user.id).order('created_at', { ascending: true })
      setCars(data || [])
      setTargetCar(data?.[0]?.id || '')

      const params = new URLSearchParams(window.location.search)
      const token = params.get('t')
      if (token) await naloziToken(token)
    }
    init()

    return () => ustaviKamero()
  }, [])

  const naloziToken = async (raw: string) => {
    const token = getTokenFromScanValue(raw)
    if (!token) return
    setLoading(true)
    setMessage('')
    setTransfer(null)
    setPayload(null)

    const { data, error } = await supabase.from('vehicle_transfers').select('*').eq('token', token).single()
    if (error || !data) {
      setMessage(error?.message?.includes('vehicle_transfers') ? 'Najprej v Supabase zaženi SUPABASE_MIGRACIJA_QR_PRENOS.sql.' : 'QR koda ni najdena ali je potekla.')
      setLoading(false)
      return
    }

    setTransfer(data)
    setPayload(data.payload)
    setTokenInput(token)
    setLoading(false)
  }

  const zacniKamero = async () => {
    try {
      setMessage('')
      const Detector = (window as any).BarcodeDetector
      if (!Detector) {
        setMessage('Ta brskalnik ne podpira direktnega skeniranja. Prilepi link ali token iz QR kode.')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraOn(true)

      const detector = new Detector({ formats: ['qr_code'] })
      const interval = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return
        const codes = await detector.detect(videoRef.current)
        if (codes?.[0]?.rawValue) {
          window.clearInterval(interval)
          ustaviKamero()
          await naloziToken(codes[0].rawValue)
        }
      }, 700)
    } catch (error: any) {
      setMessage('Kamere ni bilo možno odpreti: ' + error.message)
    }
  }

  const ustaviKamero = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setCameraOn(false)
  }

  const uvozi = async () => {
    if (!payload || !targetCar || transfer?.mode !== 'import') return
    setLoading(true)
    setMessage('')

    const serviceRows = cleanTransferRows(payload.service_logs || [], targetCar).map((row: any) => ({ ...row, opis: `[Preneseno] ${row.opis || ''}`.trim() }))
    const fuelRows = cleanTransferRows(payload.fuel_logs || [], targetCar)
    const expenseRows = cleanTransferRows(payload.expenses || [], targetCar).map((row: any) => ({ ...row, opis: `[Preneseno] ${row.opis || ''}`.trim() }))

    if (serviceRows.length) await supabase.from('service_logs').insert(serviceRows)
    if (fuelRows.length) await supabase.from('fuel_logs').insert(fuelRows)
    if (expenseRows.length) await supabase.from('expenses').insert(expenseRows)

    const maxKm = Math.max(
      0,
      ...serviceRows.map((r: any) => r.km || 0),
      ...fuelRows.map((r: any) => r.km || 0),
      cars.find((c: any) => c.id === targetCar)?.km_trenutni || 0,
    )
    if (maxKm > 0) await supabase.from('cars').update({ km_trenutni: maxKm }).eq('id', targetCar)
    await supabase.from('vehicle_transfers').update({ imported_at: new Date().toISOString() }).eq('id', transfer.id)

    setMessage(`Uvoz končan: ${serviceRows.length} servisov, ${fuelRows.length} tankanj, ${expenseRows.length} stroškov.`)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-white">Scan</h1>
          <p className="text-[#5a5a80] text-xs">Preveri report ali uvozi zgodovino</p>
        </div>
      </div>

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button onClick={zacniKamero} disabled={cameraOn} className="bg-[#6c63ff] text-white font-semibold py-3 rounded-xl disabled:opacity-50">Kamera</button>
          <button onClick={ustaviKamero} disabled={!cameraOn} className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] font-semibold py-3 rounded-xl disabled:opacity-50">Ustavi</button>
        </div>
        {cameraOn && <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl bg-black aspect-video object-cover mb-4" />}
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2">Token ali link</p>
        <textarea value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} rows={3}
          className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-3 text-white text-xs outline-none focus:border-[#6c63ff] font-mono" />
        <button onClick={() => naloziToken(tokenInput)} disabled={!tokenInput.trim() || loading} className="w-full mt-3 bg-[#3ecfcf22] border border-[#3ecfcf66] text-[#3ecfcf] font-semibold py-3 rounded-xl disabled:opacity-50">
          Preveri
        </button>
      </div>

      {payload && (
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-white font-bold text-lg">{payload.car?.znamka} {payload.car?.model}</p>
              <p className="text-[#5a5a80] text-xs">{payload.car?.letnik || '-'} · VIN {payload.car?.vin_masked || '-'}</p>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${transfer?.mode === 'import' ? 'bg-[#3ecfcf22] text-[#3ecfcf]' : 'bg-[#6c63ff22] text-[#a09aff]'}`}>
              {transfer?.mode === 'import' ? 'UVOZ' : 'PREVERJANJE'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-[#13131f] rounded-xl p-3"><p className="text-[#5a5a80] text-xs">Servisi</p><p className="text-white font-bold">{payload.car?.servisi || 0}</p></div>
            <div className="bg-[#13131f] rounded-xl p-3"><p className="text-[#5a5a80] text-xs">Tankanja</p><p className="text-white font-bold">{payload.car?.tankanja || 0}</p></div>
            <div className="bg-[#13131f] rounded-xl p-3"><p className="text-[#5a5a80] text-xs">Stroški</p><p className="text-white font-bold">{payload.car?.stroski || 0}</p></div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-[#13131f] rounded-xl p-3"><p className="text-[#5a5a80] text-xs">Lastniki</p><p className="text-white font-bold">{payload.car?.st_lastnikov || '-'}</p></div>
            <div className="bg-[#13131f] rounded-xl p-3"><p className="text-[#5a5a80] text-xs">Mesto</p><p className="text-white font-bold text-sm">{payload.car?.lastnik_mesto || '-'}</p></div>
            <div className="bg-[#13131f] rounded-xl p-3"><p className="text-[#5a5a80] text-xs">Starost</p><p className="text-white font-bold">{payload.car?.lastnik_starost || '-'}</p></div>
          </div>

          {transfer?.mode === 'import' && (
            <div className="border-t border-[#1e1e32] pt-4">
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Uvozi v vozilo</label>
              <select value={targetCar} onChange={(e) => setTargetCar(e.target.value)} className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff]">
                {cars.map((car: any) => <option key={car.id} value={car.id}>{car.znamka} {car.model}</option>)}
              </select>
              <button onClick={uvozi} disabled={!targetCar || loading} className="w-full mt-3 bg-[#3ecfcf] text-black font-bold py-3 rounded-xl disabled:opacity-50">
                Uvozi zgodovino
              </button>
            </div>
          )}
        </div>
      )}

      {message && <div className="p-3 rounded-xl text-sm border mb-4 bg-[#6c63ff22] border-[#6c63ff44] text-[#a09aff]">{message}</div>}

      <HomeButton />
    </div>
  )
}