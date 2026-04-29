'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'
import { parseReceiptText, readReceiptTextFromImage } from '@/lib/receipt-ocr'
import { trackEvent } from '@/lib/analytics'

export default function VnosStroska() {
  const [datum, setDatum] = useState(new Date().toISOString().split('T')[0])
  const [kategorija, setKategorija] = useState('registracija')
  const [kategorijaCustom, setKategorijaCustom] = useState('')
  const [opis, setOpis] = useState('')
  const [znesek, setZnesek] = useState('')
  const [carId, setCarId] = useState('')
  const [avti, setAvti] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [poslusam, setPoslusam] = useState<string | null>(null)
  const [racun, setRacun] = useState<File | null>(null)
  const [racunPreview, setRacunPreview] = useState('')
  const [ocrText, setOcrText] = useState('')
  const [ocrMessage, setOcrMessage] = useState('')
  const [ocrLoading, setOcrLoading] = useState(false)

  const kategorije = [
    { vrednost: 'registracija', ikona: '📋', naziv: 'Registracija' },
    { vrednost: 'vinjeta', ikona: '🛣️', naziv: 'Vinjeta' },
    { vrednost: 'zavarovanje', ikona: '🛡️', naziv: 'Zavarovanje' },
    { vrednost: 'gume', ikona: '⚫', naziv: 'Gume' },
    { vrednost: 'tehnicni', ikona: '🔍', naziv: 'Tehnični pregled' },
    { vrednost: 'izredno', ikona: '🔨', naziv: 'Izredno popravilo' },
    { vrednost: 'lizing', ikona: '🏦', naziv: 'Lizing' },
    { vrednost: 'custom', ikona: '✏️', naziv: 'Drugo...' },
  ]

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const params = new URLSearchParams(window.location.search)
      const carParam = params.get('car')
      const { data } = await supabase.from('cars').select('id, znamka, model').eq('user_id', user.id)
      if (data && data.length > 0) {
        setAvti(data)
        const izbrani = data.find((a: any) => a.id === carParam) || data[0]
        setCarId(izbrani.id)
        trackEvent('expense_add_open', { carId: izbrani.id })
      }
    }
    init()
  }, [])

  const pretвориVStevilko = (tekst: string): number | null => {
    const direktno = parseFloat(tekst.replace(',', '.').replace(/\s/g, ''))
    if (!isNaN(direktno)) return direktno

    let rezultat = tekst
      .replace(/(\d+)\s*tisoč\s*(\d+)/gi, (_, a, b) => String(parseInt(a) * 1000 + parseInt(b)))
      .replace(/(\d+)\s*tisoč/gi, (_, a) => String(parseInt(a) * 1000))
      .replace(/tisoč/gi, '1000')
      .replace(/sto/gi, '100')
      .replace(/nič/gi, '0').replace(/ena|eno/gi, '1').replace(/dva|dve/gi, '2')
      .replace(/tri\b/gi, '3').replace(/štiri/gi, '4').replace(/pet\b/gi, '5')
      .replace(/šest\b/gi, '6').replace(/sedem\b/gi, '7').replace(/osem\b/gi, '8')
      .replace(/devet\b/gi, '9').replace(/deset\b/gi, '10')
      .replace(/dvajset/gi, '20').replace(/trideset/gi, '30')
      .replace(/štirideset/gi, '40').replace(/petdeset/gi, '50')
      .replace(/šestdeset/gi, '60').replace(/sedemdeset/gi, '70')
      .replace(/osemdeset/gi, '80').replace(/devetdeset/gi, '90')
      .replace(/\s+/g, '')

    const stevilka = parseFloat(rezultat)
    if (!isNaN(stevilka)) return stevilka
    return null
  }

  const glasovniVnos = (polje: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { setMessage('Glasovni vnos ni podprt v tem brskalniku.'); return }

    const recognition = new SpeechRecognition()
    recognition.lang = 'sl-SI'
    recognition.continuous = false
    recognition.interimResults = false
    setPoslusam(polje)

    recognition.onresult = (event: any) => {
      const tekst = event.results[0][0].transcript.toLowerCase().trim()
      if (polje === 'opis') {
        setOpis(tekst)
      } else if (polje === 'znesek') {
        const stevilka = pretвориVStevilko(tekst)
        if (stevilka !== null) setZnesek(stevilka.toString())
        else setMessage(`Nisem razumel: "${tekst}". Poskusi znova.`)
      }
      setPoslusam(null)
    }

    recognition.onerror = () => { setMessage('Napaka pri glasovnem vnosu.'); setPoslusam(null) }
    recognition.onend = () => setPoslusam(null)
    recognition.start()
  }

  const MicButton = ({ polje }: { polje: string }) => (
    <button type="button" onClick={() => glasovniVnos(polje)}
      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
        poslusam === polje
          ? 'bg-[#ef4444] text-white animate-pulse'
          : 'bg-[#13131f] border border-[#2a2a40] text-[#5a5a80] hover:border-[#3ecfcf] hover:text-[#3ecfcf]'
      }`}>
      🎤
    </button>
  )

  const dodajRacun = (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 4 * 1024 * 1024) {
      setMessage('Slika racuna je lahko velika najvec 4MB.')
      return
    }
    setRacun(file)
    setRacunPreview(URL.createObjectURL(file))
    setOcrText('')
    setOcrMessage('')
  }

  const uporabiPrebranTekst = (text: string) => {
    const result = parseReceiptText(text)
    if (result.date) setDatum(result.date)
    if (result.total) setZnesek(result.total)
    if (result.description && !opis) setOpis(result.description)
    trackEvent('receipt_text_applied', {
      carId,
      type: 'expense',
      hasDate: !!result.date,
      hasTotal: !!result.total,
      hasStation: !!result.station,
      hasDescription: !!result.description,
    })
    setOcrMessage('Podatki so prebrani. Pred shranjevanjem jih se enkrat preveri.')
  }

  const preberiRacun = async () => {
    if (!racun) {
      setOcrMessage('Najprej dodaj ali slikaj racun.')
      return
    }
    setOcrLoading(true)
    trackEvent('receipt_scan_clicked', { carId, type: 'expense' })
    setOcrMessage('')
    try {
      const text = await readReceiptTextFromImage(racun)
      setOcrText(text)
      uporabiPrebranTekst(text)
      trackEvent('receipt_scan_success', { carId, type: 'expense', textLength: text.length })
    } catch (error: any) {
      trackEvent('receipt_scan_failed', { carId, type: 'expense', message: error.message })
      setOcrMessage(`${error.message} Lahko prilepis tekst racuna spodaj in kliknes "Uporabi tekst".`)
    } finally {
      setOcrLoading(false)
    }
  }

  const naloziRacun = async () => {
    if (!racun) return null
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const ext = racun.name.split('.').pop() || 'jpg'
    const path = `${user.id}/expense_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('service-documents').upload(path, racun, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('service-documents').getPublicUrl(path)
    return data.publicUrl
  }

  const shrani = async () => {
    if (!znesek) { setMessage('Znesek je obvezen!'); return }
    if (kategorija === 'custom' && !kategorijaCustom) { setMessage('Vnesi naziv stroška!'); return }

    setLoading(true)
    setMessage('')
    let receiptUrl: string | null = null
    try {
      receiptUrl = await naloziRacun()
    } catch (error: any) {
      setMessage('Napaka pri nalaganju slike racuna: ' + error.message)
      setLoading(false)
      return
    }

    const finalnaKategorija = kategorija === 'custom' ? kategorijaCustom : kategorija

    const { error } = await supabase.from('expenses').insert({
      car_id: carId,
      datum,
      kategorija: finalnaKategorija,
      opis: opis || null,
      znesek: parseFloat(znesek),
      receipt_url: receiptUrl,
    })

    if (error) { setMessage('Napaka: ' + error.message); setLoading(false); return }
    trackEvent('expense_saved', { carId, category: finalnaKategorija, hasReceipt: !!receiptUrl })

    setMessage('✅ Strošek uspešno shranjen!')
    setTimeout(() => window.location.href = `/stroski?car=${carId}`, 1000)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">

      <div className="flex items-center gap-3 mb-8">
        <BackButton />
        <h1 className="text-xl font-bold text-white">💰 Vnos stroška</h1>
      </div>

      {poslusam && (
        <div className="bg-[#ef444422] border border-[#ef444444] rounded-xl p-3 mb-4 flex items-center gap-3">
          <span className="text-xl animate-pulse">🎤</span>
          <p className="text-[#ef4444] text-sm font-semibold">Poslušam... govori zdaj</p>
        </div>
      )}

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 flex flex-col gap-5">

        {avti.length > 1 && (
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Avto</label>
            <select value={carId} onChange={e => setCarId(e.target.value)}
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#3ecfcf] transition-colors">
              {avti.map((a: any) => <option key={a.id} value={a.id}>{a.znamka} {a.model}</option>)}
            </select>
          </div>
        )}

        {/* Kategorije */}
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3 block">Kategorija</label>
          <div className="grid grid-cols-4 gap-2">
            {kategorije.map((kat) => (
              <button key={kat.vrednost} type="button"
                onClick={() => setKategorija(kat.vrednost)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                  kategorija === kat.vrednost
                    ? 'bg-[#3ecfcf22] border-[#3ecfcf66] text-[#3ecfcf]'
                    : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80] hover:border-[#3ecfcf33]'
                }`}>
                <span className="text-xl">{kat.ikona}</span>
                <span className="text-[9px] uppercase tracking-wider text-center leading-tight">{kat.naziv}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom naziv */}
        {kategorija === 'custom' && (
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Naziv stroška *</label>
            <input type="text" value={kategorijaCustom} onChange={e => setKategorijaCustom(e.target.value)}
              placeholder="npr. Pranje avta, Parking..."
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#3ecfcf] transition-colors" />
          </div>
        )}

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Datum</label>
          <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#3ecfcf] transition-colors" />
        </div>

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Znesek (€) *</label>
          <div className="flex gap-2">
            <input type="number" step="0.01" value={znesek} onChange={e => setZnesek(e.target.value)}
              placeholder="npr. 150"
              className="flex-1 bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#3ecfcf] transition-colors" />
            <MicButton polje="znesek" />
          </div>
        </div>

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Opis (po želji)</label>
          <div className="flex gap-2">
            <textarea value={opis} onChange={e => setOpis(e.target.value)}
              placeholder="npr. Letna registracija 2026..."
              rows={2}
              className="flex-1 bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#3ecfcf] transition-colors resize-none" />
            <MicButton polje="opis" />
          </div>
        </div>

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Slika racuna</label>
          <label className="block bg-[#13131f] border border-dashed border-[#2a2a40] rounded-xl p-4 text-center cursor-pointer hover:border-[#3ecfcf66] transition-colors">
            <input type="file" accept="image/*" capture="environment" onChange={dodajRacun} className="hidden" />
            {racunPreview ? (
              <img src={racunPreview} alt="Racun" className="w-full max-h-56 object-contain rounded-lg" />
            ) : (
              <span className="text-[#3ecfcf] font-semibold">📷 Dodaj/slikaj racun</span>
            )}
          </label>
          {racunPreview && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={preberiRacun} disabled={ocrLoading}
                  className="rounded-xl bg-[#3ecfcf] px-3 py-2 text-sm font-semibold text-black disabled:opacity-50">
                  {ocrLoading ? 'Berem...' : 'Preberi racun'}
                </button>
                <button type="button" onClick={() => { setRacun(null); setRacunPreview(''); setOcrText(''); setOcrMessage('') }}
                  className="rounded-xl border border-[#ef444455] px-3 py-2 text-sm font-semibold text-[#ef4444]">
                  Odstrani sliko
                </button>
              </div>
              <textarea
                value={ocrText}
                onChange={e => setOcrText(e.target.value)}
                placeholder="Ce avtomatsko branje ni podprto, prilepi tekst racuna sem..."
                rows={3}
                className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-[#3ecfcf] transition-colors resize-none"
              />
              <button type="button" onClick={() => uporabiPrebranTekst(ocrText)}
                className="w-full rounded-xl border border-[#3ecfcf55] bg-[#3ecfcf18] px-3 py-2 text-sm font-semibold text-[#3ecfcf]">
                Uporabi tekst
              </button>
              {ocrMessage && <p className="text-[#3ecfcf] text-xs leading-relaxed">{ocrMessage}</p>}
            </div>
          )}
        </div>

        {message && (
          <div className={`p-3 rounded-xl text-sm border ${
            message.includes('✅') ? 'bg-[#16a34a22] border-[#16a34a44] text-[#4ade80]' : 'bg-[#ef444422] border-[#ef444444] text-[#fca5a5]'
          }`}>{message}</div>
        )}

        <button onClick={shrani} disabled={loading}
          className="w-full bg-[#3ecfcf] hover:bg-[#2eb8b8] text-black font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 mt-2">
          {loading ? 'Shranjevanje...' : 'Shrani strošek →'}
        </button>
      </div>

      <HomeButton />
    </div>
  )
}
