'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton, HomeButton } from '@/lib/nav'
import { cleanTransferRows, getTokenFromScanValue } from '@/lib/transfer'

const fmtDate = (value?: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('sl-SI')
}

const fmtMoney = (value?: number) => typeof value === 'number' ? `${value.toFixed(2)} EUR` : '-'
const fmtKm = (value?: number) => typeof value === 'number' ? `${value.toLocaleString('sl-SI')} km` : '-'
const stripPrevious = (value?: string) => String(value || '-').replace('[Prejsnji lastnik]', '').trim() || '-'

function StatBox({ label, value }: { label: string, value: any }) {
  return (
    <div className="bg-[#13131f] rounded-xl p-3 border border-[#1e1e32]">
      <p className="text-[#7b7ba6] text-[11px] uppercase tracking-wide">{label}</p>
      <p className="text-white font-bold text-sm mt-1 break-words">{value || '-'}</p>
    </div>
  )
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <section className="border-t border-[#1e1e32] pt-4 mt-4">
      <h2 className="text-[#a09aff] text-sm font-bold uppercase tracking-wide mb-3">{title}</h2>
      {children}
    </section>
  )
}

function EmptyRows({ text }: { text: string }) {
  return <p className="text-[#7b7ba6] text-sm bg-[#13131f] rounded-xl p-4 border border-[#1e1e32]">{text}</p>
}

function DigitalReport({ payload }: { payload: any }) {
  const car = payload?.car || {}
  const carFull = payload?.car_full || {}
  const servisi = payload?.service_logs || []
  const gorivo = payload?.fuel_logs || []
  const expenses = payload?.expenses || []
  const skupajServis = servisi.reduce((sum: number, row: any) => sum + (row.cena || 0), 0)
  const skupajGorivo = gorivo.reduce((sum: number, row: any) => sum + (row.cena_skupaj || 0), 0)
  const skupajStroski = expenses.reduce((sum: number, row: any) => sum + (row.znesek || 0), 0)
  const skupajVse = skupajServis + skupajGorivo + skupajStroski

  return (
    <div className="space-y-4">
      <div className="bg-[#080810] rounded-2xl p-4 border border-[#252542]">
        <p className="text-[#3ecfcf] text-sm font-semibold mb-1">Digitalni report iz GarageBase baze</p>
        <p className="text-[#7b7ba6] text-xs leading-relaxed">
          Ta prikaz je nalozen direktno iz QR zapisa v bazi. Primerjaj ga s PDF reportom, ki ga je poslal lastnik.
        </p>
      </div>

      <Section title="Vozilo">
        <div className="grid grid-cols-2 gap-3">
          <StatBox label="Vozilo" value={`${car.znamka || carFull.znamka || ''} ${car.model || carFull.model || ''}`.trim()} />
          <StatBox label="Letnik" value={car.letnik || carFull.letnik} />
          <StatBox label="Gorivo" value={car.gorivo || carFull.gorivo} />
          <StatBox label="Trenutni km" value={fmtKm(car.km_trenutni || carFull.km_trenutni)} />
          <StatBox label="Tablica" value={carFull.tablica?.toUpperCase?.()} />
          <StatBox label="VIN" value={car.vin_masked || '-'} />
        </div>
      </Section>

      <Section title="Lastnistvo">
        <div className="grid grid-cols-3 gap-3">
          <StatBox label="St. lastnikov" value={car.st_lastnikov || carFull.st_lastnikov} />
          <StatBox label="Mesto" value={car.lastnik_mesto || carFull.lastnik_mesto} />
          <StatBox label="Starost" value={car.lastnik_starost || carFull.lastnik_starost} />
        </div>
      </Section>

      <Section title="Pregled stroskov">
        <div className="grid grid-cols-2 gap-3">
          <StatBox label="Skupaj" value={fmtMoney(skupajVse)} />
          <StatBox label="Servisi" value={fmtMoney(skupajServis)} />
          <StatBox label="Gorivo" value={fmtMoney(skupajGorivo)} />
          <StatBox label="Ostalo" value={fmtMoney(skupajStroski)} />
        </div>
      </Section>

      <Section title="Servisna knjiga">
        {servisi.length === 0 ? <EmptyRows text="Ni vnesenih servisov." /> : (
          <div className="overflow-hidden rounded-xl border border-[#1e1e32]">
            {servisi.map((row: any, index: number) => (
              <div key={row.id || index} className="grid grid-cols-[82px_86px_1fr] gap-2 bg-[#13131f] border-b border-[#1e1e32] last:border-b-0 p-3">
                <div className="text-[#7b7ba6] text-xs">{fmtDate(row.datum)}</div>
                <div className="text-[#a09aff] text-xs font-semibold">{fmtKm(row.km)}</div>
                <div>
                  <p className="text-white text-sm font-semibold">{stripPrevious(row.opis)}</p>
                  <p className="text-[#7b7ba6] text-xs mt-1">{row.servis || '-'} · {fmtMoney(row.cena)}{row.foto_url ? ' · racun prilozen' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Evidenca goriva">
        {gorivo.length === 0 ? <EmptyRows text="Ni vnesenih tankanj." /> : (
          <div className="overflow-hidden rounded-xl border border-[#1e1e32]">
            {gorivo.map((row: any, index: number) => (
              <div key={row.id || index} className="grid grid-cols-[82px_86px_1fr] gap-2 bg-[#13131f] border-b border-[#1e1e32] last:border-b-0 p-3">
                <div className="text-[#7b7ba6] text-xs">{fmtDate(row.datum)}</div>
                <div className="text-[#a09aff] text-xs font-semibold">{fmtKm(row.km)}</div>
                <div>
                  <p className="text-white text-sm font-semibold">{row.litri || '-'} L · {row.tip_goriva || '-'}</p>
                  <p className="text-[#7b7ba6] text-xs mt-1">{stripPrevious(row.postaja)} · {fmtMoney(row.cena_skupaj)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Dodatni stroski">
        {expenses.length === 0 ? <EmptyRows text="Ni dodatnih stroskov." /> : (
          <div className="overflow-hidden rounded-xl border border-[#1e1e32]">
            {expenses.map((row: any, index: number) => (
              <div key={row.id || index} className="grid grid-cols-[82px_100px_1fr] gap-2 bg-[#13131f] border-b border-[#1e1e32] last:border-b-0 p-3">
                <div className="text-[#7b7ba6] text-xs">{fmtDate(row.datum)}</div>
                <div className="text-[#a09aff] text-xs font-semibold">{row.kategorija || '-'}</div>
                <div>
                  <p className="text-white text-sm font-semibold">{stripPrevious(row.opis)}</p>
                  <p className="text-[#7b7ba6] text-xs mt-1">{fmtMoney(row.znesek)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [transfer, setTransfer] = useState<any>(null)
  const [payload, setPayload] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [cameraOn, setCameraOn] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }

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
      setMessage(error?.message?.includes('vehicle_transfers') ? 'Najprej v Supabase zazeni SUPABASE_MIGRACIJA_QR_PRENOS.sql.' : 'QR koda ni najdena ali je potekla.')
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
      setMessage('Kamere ni bilo mozno odpreti: ' + error.message)
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
          <p className="text-[#7b7ba6] text-xs">Preveri report ali uvozi zgodovino</p>
        </div>
      </div>

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button onClick={zacniKamero} disabled={cameraOn} className="bg-[#6c63ff] text-white font-semibold py-3 rounded-xl disabled:opacity-50">Kamera</button>
          <button onClick={ustaviKamero} disabled={!cameraOn} className="bg-[#13131f] border border-[#1e1e32] text-[#7b7ba6] font-semibold py-3 rounded-xl disabled:opacity-50">Ustavi</button>
        </div>
        {cameraOn && (
          <div className="mb-4">
            <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl bg-black aspect-video object-cover" />
            <p className="text-[#7b7ba6] text-xs mt-2">Ce kamera ostane crna, zapri Scan in ga odpri znova ali prilepi token/link spodaj.</p>
          </div>
        )}
        <p className="text-[#7b7ba6] text-xs uppercase tracking-wider mb-2">Token ali link</p>
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
              <p className="text-[#7b7ba6] text-xs">{payload.car?.letnik || '-'} · VIN {payload.car?.vin_masked || '-'}</p>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${transfer?.mode === 'import' ? 'bg-[#3ecfcf22] text-[#3ecfcf]' : 'bg-[#6c63ff22] text-[#a09aff]'}`}>
              {transfer?.mode === 'import' ? 'UVOZ' : 'BRANJE'}
            </span>
          </div>

          <DigitalReport payload={payload} />

          {transfer?.mode === 'import' ? (
            <div className="border-t border-[#1e1e32] pt-4 mt-5">
              <p className="text-[#f59e0b] text-xs mb-3">Po uvozu bodo vsi obstojeci zapisi oznaceni kot zgodovina prejsnjega lastnika. Novi lastnik potem nadaljuje svojo evidenco od tega trenutka naprej.</p>
              <button onClick={uvozi} disabled={loading} className="w-full bg-[#3ecfcf] text-black font-bold py-3 rounded-xl disabled:opacity-50">
                Uvozi vozilo {payload.car?.znamka} {payload.car?.model}
              </button>
            </div>
          ) : (
            <div className="border-t border-[#1e1e32] pt-4 mt-5">
              <p className="text-[#3ecfcf] text-sm font-semibold mb-2">Report je najden v GarageBase bazi.</p>
              <p className="text-[#7b7ba6] text-xs">Ce se ti podatki ujemajo s PDF reportom, dokument ni bil naknadno spremenjen.</p>
            </div>
          )}
        </div>
      )}

      {message && <div className="p-3 rounded-xl text-sm border mb-4 bg-[#6c63ff22] border-[#6c63ff44] text-[#a09aff]">{message}</div>}

      <HomeButton />
    </div>
  )
}