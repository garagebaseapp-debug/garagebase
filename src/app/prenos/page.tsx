'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton, HomeButton } from '@/lib/nav'

function encodePayload(data: any) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))))
}

function decodePayload(value: string) {
  return JSON.parse(decodeURIComponent(escape(atob(value.trim()))))
}

function cleanRows(rows: any[], carId: string) {
  return rows.map(({ id, created_at, updated_at, car_id, ...rest }) => ({ ...rest, car_id: carId }))
}

export default function PrenosZgodovine() {
  const [avto, setAvto] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [transferCode, setTransferCode] = useState('')
  const [importCode, setImportCode] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const params = new URLSearchParams(window.location.search)
      const carId = params.get('car')
      if (!carId) { window.location.href = '/garaza'; return }
      const { data } = await supabase.from('cars').select('*').eq('id', carId).single()
      setAvto(data)
      setLoading(false)
    }
    init()
  }, [])

  const pripraviIzvoz = async () => {
    if (!avto?.prenos_soglasje) {
      setMessage('Lastnik mora v nastavitvah vozila najprej dovoliti prenos zgodovine.')
      return
    }

    const [servisi, gorivo, stroski] = await Promise.all([
      supabase.from('service_logs').select('*').eq('car_id', avto.id).order('datum', { ascending: true }),
      supabase.from('fuel_logs').select('*').eq('car_id', avto.id).order('datum', { ascending: true }),
      supabase.from('expenses').select('*').eq('car_id', avto.id).order('datum', { ascending: true }),
    ])

    const payload = {
      type: 'garagebase-transfer-v1',
      exportedAt: new Date().toISOString(),
      consent: true,
      car: {
        znamka: avto.znamka,
        model: avto.model,
        letnik: avto.letnik,
        gorivo: avto.gorivo,
        vin_masked: avto.vin ? `${avto.vin.substring(0, 6)}****${avto.vin.substring(Math.max(0, avto.vin.length - 4))}` : null,
        st_lastnikov: avto.st_lastnikov,
        lastnik_mesto: avto.lastnik_mesto,
        lastnik_starost: avto.lastnik_starost,
      },
      service_logs: servisi.data || [],
      fuel_logs: gorivo.data || [],
      expenses: (stroski.data || []).filter((e: any) => e.kategorija !== 'km_sprememba'),
    }

    setTransferCode(encodePayload(payload))
    setMessage('Prenosna koda je pripravljena. Shrani jo ali jo uporabi za QR vsebino.')
  }

  const uvozi = async () => {
    try {
      if (!avto?.id) return
      const payload = decodePayload(importCode)
      if (payload.type !== 'garagebase-transfer-v1' || !payload.consent) {
        setMessage('Koda ni veljavna ali nima soglasja za prenos.')
        return
      }

      const serviceRows = cleanRows(payload.service_logs || [], avto.id).map((row: any) => ({
        ...row,
        opis: `[Preneseno] ${row.opis || ''}`.trim()
      }))
      const fuelRows = cleanRows(payload.fuel_logs || [], avto.id)
      const expenseRows = cleanRows(payload.expenses || [], avto.id).map((row: any) => ({
        ...row,
        opis: `[Preneseno] ${row.opis || ''}`.trim()
      }))

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
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2">Izvoz za novega lastnika</p>
        <p className="text-white text-sm mb-4">Izvoz deluje samo, če je v nastavitvah vozila vklopljeno soglasje za prenos.</p>
        <button onClick={pripraviIzvoz} className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors">
          Pripravi prenosno kodo
        </button>
        {transferCode && (
          <textarea readOnly value={transferCode} rows={6}
            className="w-full mt-3 bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-3 text-[#a09aff] text-xs outline-none font-mono" />
        )}
      </div>

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2">Uvoz zgodovine</p>
        <p className="text-white text-sm mb-4">Prilepi prenosno kodo. Uvoženi zapisi bodo označeni z [Preneseno].</p>
        <textarea value={importCode} onChange={(e) => setImportCode(e.target.value)} rows={6}
          className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-3 py-3 text-white text-xs outline-none focus:border-[#6c63ff] font-mono" />
        <button onClick={uvozi} disabled={!importCode.trim()} className="w-full mt-3 bg-[#3ecfcf22] border border-[#3ecfcf66] text-[#3ecfcf] font-semibold py-3 rounded-xl disabled:opacity-50">
          Uvozi v to vozilo
        </button>
      </div>

      {message && <div className="p-3 rounded-xl text-sm border mb-4 bg-[#6c63ff22] border-[#6c63ff44] text-[#a09aff]">{message}</div>}

      <HomeButton />
    </div>
  )
}
