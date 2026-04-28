'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { BackButton, HomeButton } from '@/lib/nav'
import { cleanTransferRows, createTransferToken, maskVin, scanUrl, type TransferMode } from '@/lib/transfer'

export default function PrenosZgodovine() {
  const [avto, setAvto] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState<TransferMode>('verify')
  const [qrUrl, setQrUrl] = useState('')
  const [scanLink, setScanLink] = useState('')
  const [manualToken, setManualToken] = useState('')
  const [importCode, setImportCode] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const params = new URLSearchParams(window.location.search)
      const carId = params.get('car')
      const modeParam = params.get('mode')
      if (modeParam === 'import' || modeParam === 'verify') setMode(modeParam)
      if (!carId) { window.location.href = '/garaza'; return }
      const { data } = await supabase.from('cars').select('*').eq('id', carId).single()
      setAvto(data)
      setLoading(false)
    }
    init()
  }, [])

  const pripraviPayload = async (izbranMode: TransferMode) => {
    const [servisi, gorivo, stroski] = await Promise.all([
      supabase.from('service_logs').select('*').eq('car_id', avto.id).order('datum', { ascending: true }),
      supabase.from('fuel_logs').select('*').eq('car_id', avto.id).order('datum', { ascending: true }),
      supabase.from('expenses').select('*').eq('car_id', avto.id).order('datum', { ascending: true }),
    ])

    const summary = {
      znamka: avto.znamka,
      model: avto.model,
      letnik: avto.letnik,
      gorivo: avto.gorivo,
      vin_masked: maskVin(avto.vin),
      km_trenutni: avto.km_trenutni,
      st_lastnikov: avto.st_lastnikov,
      lastnik_mesto: avto.lastnik_mesto,
      lastnik_starost: avto.lastnik_starost,
      servisi: servisi.data?.length || 0,
      tankanja: gorivo.data?.length || 0,
      stroski: (stroski.data || []).filter((e: any) => e.kategorija !== 'km_sprememba').length,
    }

    if (izbranMode === 'verify') {
      return {
        type: 'garagebase-transfer-v1',
        mode: izbranMode,
        exportedAt: new Date().toISOString(),
        consent: true,
        car: summary,
      }
    }

    return {
      type: 'garagebase-transfer-v1',
      mode: izbranMode,
      exportedAt: new Date().toISOString(),
      consent: true,
      car: summary,
      service_logs: servisi.data || [],
      fuel_logs: gorivo.data || [],
      expenses: (stroski.data || []).filter((e: any) => e.kategorija !== 'km_sprememba'),
    }
  }

  const pripraviQR = async () => {
    if (!avto?.prenos_soglasje) {
      setMessage('Lastnik mora v nastavitvah vozila najprej dovoliti prenos zgodovine.')
      return
    }

    setMessage('')
    setQrUrl('')
    setScanLink('')
    setManualToken('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/'; return }

    const token = createTransferToken()
    const payload = await pripraviPayload(mode)
    const { error } = await supabase.from('vehicle_transfers').insert({
      token,
      car_id: avto.id,
      created_by: user.id,
      mode,
      consent: true,
      payload,
    })

    if (error) {
      setMessage(error.message.includes('vehicle_transfers') ? 'Najprej v Supabase zaženi SUPABASE_MIGRACIJA_QR_PRENOS.sql.' : 'Napaka: ' + error.message)
      return
    }

    const link = scanUrl(token)
    setScanLink(link)
    setManualToken(token)
    setQrUrl(await QRCode.toDataURL(link, { width: 320, margin: 2 }))
    setMessage(mode === 'verify' ? 'QR je pripravljen za preverjanje reporta.' : 'QR je pripravljen za uvoz zgodovine.')
  }

  const uvoziStaroKodo = async () => {
    try {
      if (!avto?.id) return
      const payload = JSON.parse(decodeURIComponent(escape(atob(importCode.trim()))))
      if (payload.type !== 'garagebase-transfer-v1' || !payload.consent) {
        setMessage('Koda ni veljavna ali nima soglasja za prenos.')
        return
      }

      const serviceRows = cleanTransferRows(payload.service_logs || [], avto.id).map((row: any) => ({ ...row, opis: `[Preneseno] ${row.opis || ''}`.trim() }))
      const fuelRows = cleanTransferRows(payload.fuel_logs || [], avto.id)
      const expenseRows = cleanTransferRows(payload.expenses || [], avto.id).map((row: any) => ({ ...row, opis: `[Preneseno] ${row.opis || ''}`.trim() }))

      if (serviceRows.length) await supabase.from('service_logs').insert(serviceRows)
      if (fuelRows.length) await supabase.from('fuel_logs').insert(fuelRows)
      if (expenseRows.length) await supabase.from('expenses').insert(expenseRows)

      setMessage(`Uvoz končan: ${serviceRows.length} servisov, ${fuelRows.length} tankanj, ${expenseRows.length} stroškov.`)
      setImportCode('')
    } catch (error: any) {
      setMessage('Uvoz ni uspel: ' + error.message)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">Nalaganje...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-white">Prenos zgodovine</h1>
          <p className="text-[#5a5a80] text-xs">{avto?.znamka} {avto?.model}</p>
        </div>
      </div>

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">Način QR kode</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button onClick={() => setMode('verify')} className={`rounded-xl border p-4 text-left ${mode === 'verify' ? 'bg-[#6c63ff22] border-[#6c63ff66]' : 'bg-[#13131f] border-[#1e1e32]'}`}>
            <p className="text-white text-sm font-semibold">Samo za branje</p>
            <p className="text-[#5a5a80] text-xs mt-1">Kupec preveri podatke, brez uvoza.</p>
          </button>
          <button onClick={() => setMode('import')} className={`rounded-xl border p-4 text-left ${mode === 'import' ? 'bg-[#3ecfcf22] border-[#3ecfcf66]' : 'bg-[#13131f] border-[#1e1e32]'}`}>
            <p className="text-white text-sm font-semibold">Uvoz</p>
            <p className="text-[#5a5a80] text-xs mt-1">Kupec lahko uvozi zgodovino v svoj avto.</p>
          </button>
        </div>
        <button onClick={pripraviQR} className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors">
          Pripravi QR kodo
        </button>
        {qrUrl && (
          <div className="mt-4 bg-white rounded-2xl p-4 flex flex-col items-center gap-3">
            <img src={qrUrl} alt="QR koda za prenos" className="w-64 h-64" />
            <p className="text-black text-xs text-center break-all">{manualToken}</p>
          </div>
        )}
        {scanLink && (
          <button onClick={() => window.location.href = scanLink} className="w-full mt-3 bg-[#13131f] border border-[#1e1e32] text-[#a09aff] font-semibold py-3 rounded-xl">
            Odpri Scan
          </button>
        )}
      </div>

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2">Stara prenosna koda</p>
        <p className="text-white text-sm mb-4">Če imaš še staro tekstovno kodo, jo lahko še vedno prilepiš tukaj.</p>
        <textarea value={importCode} onChange={(e) => setImportCode(e.target.value)} rows={5}
          className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-3 text-white text-xs outline-none focus:border-[#6c63ff] font-mono" />
        <button onClick={uvoziStaroKodo} disabled={!importCode.trim()} className="w-full mt-3 bg-[#3ecfcf22] border border-[#3ecfcf66] text-[#3ecfcf] font-semibold py-3 rounded-xl disabled:opacity-50">
          Uvozi staro kodo v to vozilo
        </button>
      </div>

      {message && <div className="p-3 rounded-xl text-sm border mb-4 bg-[#6c63ff22] border-[#6c63ff44] text-[#a09aff]">{message}</div>}

      <HomeButton />
    </div>
  )
}