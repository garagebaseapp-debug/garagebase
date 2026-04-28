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
      setCameraOn(true)
      await new Promise(requestAnimationFrame)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }

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
    if (!payload || transfer?.mode !== 'import') return
    const carName = `${payload.car?.znamka || ''} ${payload.car?.model || ''}`.trim()
    const potrdi = window.confirm(`Ali zelite uvoziti vozilo ${carName} v svojo garazo?`)
    if (!potrdi) return

    setLoading(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/'; return }

    const source = payload.car_full || {}
    const { data: newCar, error: carError } = await supabase.from('cars').insert({
      user_id: user.id,
      tip_vozila: source.tip_vozila || 'avto',
      oblika: source.oblika || null,
      znamka: source.znamka || payload.car?.znamka || 'Vozilo',
      model: source.model || payload.car?.model || 'Uvozeno',
      letnik: source.letnik || payload.car?.letnik || null,
      gorivo: source.gorivo || payload.car?.gorivo || null,
      barva: source.barva || null,
      tablica: source.tablica || null,
      vin: source.vin || null,
      km_trenutni: source.km_trenutni || payload.car?.km_trenutni || null,
      km_ob_vnosu: source.km_trenutni || payload.car?.km_trenutni || null,
      kubikaza: source.kubikaza || null,
      kw: source.kw || null,
      menjalnik: source.menjalnik || null,
      pogon: source.pogon || null,
      st_lastnikov: source.st_lastnikov || payload.car?.st_lastnikov || null,
      lastnik_mesto: source.lastnik_mesto || payload.car?.lastnik_mesto || null,
      lastnik_starost: source.lastnik_starost || payload.car?.lastnik_starost || null,
      prenos_soglasje: false,
      prenos_opomba: 'Uvozeno iz GarageBase QR prenosa.'
    }).select().single()

    if (carError || !newCar) {
      setMessage('Uvoz vozila ni uspel: ' + (carError?.message || 'neznana napaka'))
      setLoading(false)
      return
    }

    const serviceRows = cleanTransferRows(payload.service_logs || [], newCar.id).map((row: any) => ({ ...row, opis: `[Prejsnji lastnik] ${row.opis || ''}`.trim() }))
    const fuelRows = cleanTransferRows(payload.fuel_logs || [], newCar.id).map((row: any) => ({ ...row, postaja: row.postaja ? `[Prejsnji lastnik] ${row.postaja}` : '[Prejsnji lastnik]' }))
    const expenseRows = cleanTransferRows(payload.expenses || [], newCar.id).map((row: any) => ({ ...row, opis: `[Prejsnji lastnik] ${row.opis || ''}`.trim() }))

    if (serviceRows.length) await supabase.from('service_logs').insert(serviceRows)
    if (fuelRows.length) await supabase.from('fuel_logs').insert(fuelRows)
    if (expenseRows.length) await supabase.from('expenses').insert(expenseRows)

    await supabase.from('vehicle_transfers').update({ imported_at: new Date().toISOString() }).eq('id', transfer.id)
    setMessage(`Vozilo ${carName} je uvozeno v tvojo garazo.`)
    setTimeout(() => window.location.href = `/dashboard?car=${newCar.id}`, 1200)
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
        {cameraOn && (
          <div className="mb-4">
            <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl bg-black aspect-video object-cover" />
            <p className="text-[#5a5a80] text-xs mt-2">Ce kamera ostane crna, zapri Scan in ga odpri znova ali prilepi token/link spodaj.</p>
          </div>
        )}
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

          {transfer?.mode === 'import' ? (
            <div className="border-t border-[#1e1e32] pt-4">
              <button onClick={uvozi} disabled={loading} className="w-full bg-[#3ecfcf] text-black font-bold py-3 rounded-xl disabled:opacity-50">
                Uvozi vozilo {payload.car?.znamka} {payload.car?.model}
              </button>
            </div>
          ) : (
            <div className="border-t border-[#1e1e32] pt-4">
              <p className="text-[#3ecfcf] text-sm font-semibold mb-2">Digitalni report je najden v GarageBase bazi.</p>
              <p className="text-[#5a5a80] text-xs">Primerjaj te podatke s PDF dokumentom. Ce se stevilo servisov, tankanj, stroskov, VIN in kilometri ujemajo, PDF ni bil spremenjen.</p>
            </div>
          )}
        </div>
      )}

      {message && <div className="p-3 rounded-xl text-sm border mb-4 bg-[#6c63ff22] border-[#6c63ff44] text-[#a09aff]">{message}</div>}

      <HomeButton />
    </div>
  )
}