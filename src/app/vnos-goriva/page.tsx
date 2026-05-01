'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'
import { parseReceiptText, readReceiptTextFromImage } from '@/lib/receipt-ocr'
import { trackEvent } from '@/lib/analytics'
import { compressImageFile, uploadImageProfiles } from '@/lib/image-compress'
import { getStoredLanguage } from '@/lib/i18n'

export default function VnosGoriva() {
  const [datum, setDatum] = useState(new Date().toISOString().split('T')[0])
  const [km, setKm] = useState('')
  const [litri, setLitri] = useState('')
  const [cenaNaLiter, setCenaNaLiter] = useState('')
  const [postaja, setPostaja] = useState('')
  const [tipGoriva, setTipGoriva] = useState('')
  const [carId, setCarId] = useState('')
  const [avti, setAvti] = useState<any[]>([])
  const [zadnjiKm, setZadnjiKm] = useState(0)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [postajeHistory, setPostajeHistory] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredPostaje, setFilteredPostaje] = useState<string[]>([])
  const [poslusam, setPoslusam] = useState<string | null>(null)
  const [racun, setRacun] = useState<File | null>(null)
  const [racunPreview, setRacunPreview] = useState('')
  const [ocrText, setOcrText] = useState('')
  const [ocrMessage, setOcrMessage] = useState('')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrAllowed, setOcrAllowed] = useState(false)
  const postajRef = useRef<HTMLDivElement>(null)

  const danes = new Date().toISOString().split('T')[0]
  const jeNaknaden = datum < danes
  const jeEn = typeof window !== 'undefined' && getStoredLanguage() === 'en'
  const tx = (sl: string, en: string) => jeEn ? en : sl
  const adminEmails = ['drazen.letsgo@gmail.com', 'drazenletsgo@gmail.com', 'garagebase.app@gmail.com']

  const tipiGoriva = [
    { vrednost: '95', naziv: '95', barva: 'bg-[#16a34a]', barvaText: 'text-[#16a34a]', barvaBorder: 'border-[#16a34a]', opis: 'Bencin 95' },
    { vrednost: '100', naziv: '100', barva: 'bg-[#2563eb]', barvaText: 'text-[#2563eb]', barvaBorder: 'border-[#2563eb]', opis: 'Bencin 100' },
    { vrednost: 'diesel', naziv: 'D', barva: 'bg-[#1a1a1a]', barvaText: 'text-[#888888]', barvaBorder: 'border-[#888888]', opis: 'Dizel' },
  ]

  const cenaSkupaj = litri && cenaNaLiter
    ? (parseFloat(litri) * parseFloat(cenaNaLiter)).toFixed(2)
    : ''

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const email = user.email?.toLowerCase() || ''
      let isAdmin = adminEmails.includes(email)
      if (!isAdmin) {
        const { data: adminRow } = await supabase.from('admin_users').select('email').eq('email', email).maybeSingle()
        isAdmin = !!adminRow
      }
      setOcrAllowed(isAdmin)
      const params = new URLSearchParams(window.location.search)
      const carParam = params.get('car')
      const { data } = await supabase.from('cars').select('id, znamka, model, km_trenutni, gorivo').eq('user_id', user.id)
      if (data && data.length > 0) {
        setAvti(data)
        const izbrani = data.find((a: any) => a.id === carParam) || data[0]
        setCarId(izbrani.id)
        await Promise.all([
          naloziZadnjiKm(izbrani.id, izbrani.km_trenutni || 0),
          naloziPostaje(data.map((a: any) => a.id)),
        ])
        if (izbrani.gorivo === 'Diesel') setTipGoriva('diesel')
        else if (izbrani.gorivo === 'Bencin') setTipGoriva('95')
        trackEvent('fuel_add_open', { carId: izbrani.id })
      }
    }
    init()
    const handleClick = (e: MouseEvent) => {
      if (postajRef.current && !postajRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const naloziZadnjiKm = async (id: string, kmAvta: number) => {
    const [{ data: servisData }, { data: gorivoData }] = await Promise.all([
      supabase.from('service_logs').select('km').eq('car_id', id).order('km', { ascending: false }).limit(1),
      supabase.from('fuel_logs').select('km').eq('car_id', id).order('km', { ascending: false }).limit(1),
    ])
    const maxServis = servisData?.[0]?.km || 0
    const maxGorivo = gorivoData?.[0]?.km || 0
    setZadnjiKm(Math.max(kmAvta, maxServis, maxGorivo))
  }

  const naloziPostaje = async (carIds: string[]) => {
    if (carIds.length === 0) return
    const { data } = await supabase
      .from('fuel_logs')
      .select('postaja')
      .in('car_id', carIds)
      .not('postaja', 'is', null)
      .order('datum', { ascending: false })
      .limit(200)
    if (data) {
      const unikatne = [...new Set(data.map((v: any) => v.postaja).filter(Boolean))] as string[]
      setPostajeHistory(unikatne)
    }
  }

  const menjavaAvta = async (noviId: string) => {
    setCarId(noviId)
    const avto = avti.find((a: any) => a.id === noviId)
    if (avto) {
      await naloziZadnjiKm(noviId, avto.km_trenutni || 0)
      if (avto.gorivo === 'Diesel') setTipGoriva('diesel')
      else if (avto.gorivo === 'Bencin') setTipGoriva('95')
    }
  }

  const handlePostajaChange = (value: string) => {
    setPostaja(value)
    if (value.length > 0) {
      const filtered = postajeHistory.filter(p => p.toLowerCase().startsWith(value.toLowerCase()))
      setFilteredPostaje(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setFilteredPostaje([])
      setShowSuggestions(false)
    }
  }

  const pretвориVStevilko = (tekst: string): number | null => {
    const direktno = parseFloat(tekst.replace(',', '.').replace(/\s/g, ''))
    if (!isNaN(direktno)) return direktno
    let rezultat = tekst
      .replace(/(\d+)\s*tisoč\s*(\d+)/gi, (_, a, b) => String(parseInt(a) * 1000 + parseInt(b)))
      .replace(/(\d+)\s*tisoč/gi, (_, a) => String(parseInt(a) * 1000))
      .replace(/tisoč/gi, '1000').replace(/sto/gi, '100')
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
      if (polje === 'postaja') {
        setPostaja(tekst)
      } else {
        const stevilka = pretвориVStevilko(tekst)
        if (stevilka !== null) {
          if (polje === 'km') setKm(stevilka.toString())
          if (polje === 'litri') setLitri(stevilka.toString())
          if (polje === 'cena') setCenaNaLiter(stevilka.toString())
        } else {
          setMessage(`Nisem razumel: "${tekst}". Poskusi znova.`)
        }
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
          : 'bg-[#13131f] border border-[#2a2a40] text-[#5a5a80] hover:border-[#6c63ff] hover:text-[#6c63ff]'
      }`}>
      🎤
    </button>
  )

  const dodajRacun = async (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMessage('')
    try {
      const result = await compressImageFile(file, uploadImageProfiles.receipt)
      setRacun(result.file)
      setRacunPreview(URL.createObjectURL(result.file))
      if (result.changed) {
        trackEvent('image_compressed', {
          type: 'fuel_receipt',
          originalBytes: result.originalBytes,
          compressedBytes: result.compressedBytes,
        })
      }
    } catch (error: any) {
      setMessage(error.message || 'Slike racuna ni bilo mogoce pripraviti.')
      return
    }
    setOcrText('')
    setOcrMessage('')
  }

  const uporabiPrebranTekst = (text: string) => {
    const result = parseReceiptText(text)
    if (result.date) setDatum(result.date)
    if (result.liters) setLitri(result.liters)
    if (result.pricePerLiter) setCenaNaLiter(result.pricePerLiter)
    if (result.station) setPostaja(result.station)
    trackEvent('receipt_text_applied', {
      carId,
      type: 'fuel',
      hasDate: !!result.date,
      hasLiters: !!result.liters,
      hasPricePerLiter: !!result.pricePerLiter,
      hasTotal: !!result.total,
      hasStation: !!result.station,
    })
    setOcrMessage(jeEn ? 'Data was read. Check it once more before saving.' : 'Podatki so prebrani. Pred shranjevanjem jih še enkrat preveri.')
  }

  const preberiRacun = async () => {
    if (!ocrAllowed) {
      setOcrMessage(jeEn ? 'AI receipt scanning is currently in internal testing. Public launch is planned for 2027.' : 'AI branje računov je trenutno v internem testiranju. Javni zagon je planiran v letu 2027.')
      trackEvent('receipt_scan_locked_clicked', { carId, type: 'fuel' })
      return
    }
    if (!racun) {
      setOcrMessage(jeEn ? 'First add or take a receipt photo.' : 'Najprej dodaj ali slikaj račun.')
      return
    }
    setOcrLoading(true)
    trackEvent('receipt_scan_clicked', { carId })
    setOcrMessage('')
    try {
      const text = await readReceiptTextFromImage(racun)
      setOcrText(text)
      uporabiPrebranTekst(text)
      trackEvent('receipt_scan_success', { carId, type: 'fuel', textLength: text.length })
    } catch (error: any) {
      trackEvent('receipt_scan_failed', { carId, type: 'fuel', message: error.message })
      setOcrMessage(`${error.message} ${jeEn ? 'You can paste the receipt text below and click "Use text".' : 'Lahko prilepiš tekst računa spodaj in klikneš "Uporabi tekst".'}`)
    } finally {
      setOcrLoading(false)
    }
  }

  const naloziRacun = async () => {
    if (!racun) return null
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const ext = racun.name.split('.').pop() || 'jpg'
    const path = `${user.id}/fuel_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('service-documents').upload(path, racun, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('service-documents').getPublicUrl(path)
    return data.publicUrl
  }

  const shrani = async () => {
    if (!km || !litri) { setMessage('Km in litri sta obvezna!'); return }
    const vneseniKm = parseInt(km)
    if (vneseniKm < zadnjiKm) {
      setMessage(`⚠️ Km ne smejo biti nižji od ${zadnjiKm.toLocaleString()} km!`)
      return
    }
    setLoading(true)
    setMessage('')
    let receiptUrl: string | null = null
    try {
      receiptUrl = await naloziRacun()
    } catch (error: any) {
      setMessage('Napaka pri nalaganju slike: ' + error.message)
      setLoading(false)
      return
    }

    const datumVnosa = new Date().toLocaleDateString('sl-SI')
    const opombaNaknaden = jeNaknaden ? ` [Naknadno vneseno: ${datumVnosa}]` : ''
    const postajaZOpombo = postaja
      ? postaja + opombaNaknaden
      : jeNaknaden ? opombaNaknaden.trim() : null

    const { error } = await supabase.from('fuel_logs').insert({
      car_id: carId,
      datum,
      km: vneseniKm,
      litri: parseFloat(litri),
      cena_na_liter: cenaNaLiter ? parseFloat(cenaNaLiter) : null,
      cena_skupaj: cenaSkupaj ? parseFloat(cenaSkupaj) : null,
      postaja: postajaZOpombo,
      tip_goriva: tipGoriva || null,
      receipt_url: receiptUrl,
      verified_document_url: receiptUrl,
      verification_level: 'basic',
    })

    if (error) { setMessage('Napaka: ' + error.message); setLoading(false); return }
    await supabase.from('cars').update({ km_trenutni: vneseniKm }).eq('id', carId)
    trackEvent('fuel_saved', { carId, hasReceipt: !!receiptUrl, verificationLevel: 'basic' })
    setMessage(tx('✅ Tankanje uspesno shranjeno!', '✅ Fill-up saved successfully!'))
    setTimeout(() => window.location.href = `/zgodovina-goriva?car=${carId}`, 1000)
    setLoading(false)
  }

  return (
    <div className="min-h-screen w-full max-w-none bg-[#080810] px-4 py-6 pb-24">

      <div className="flex items-center gap-3 mb-8">
        <BackButton />
        <h1 className="text-xl font-bold text-white">⛽ {tx('Vnos goriva', 'Fuel entry')}</h1>
      </div>

      {poslusam && (
        <div className="bg-[#ef444422] border border-[#ef444444] rounded-xl p-3 mb-4 flex items-center gap-3">
          <span className="text-xl animate-pulse">🎤</span>
          <p className="text-[#ef4444] text-sm font-semibold">{tx('Poslusam... govori zdaj', 'Listening... speak now')}</p>
        </div>
      )}

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 flex flex-col gap-4">

        {avti.length > 1 && (
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Avto', 'Car')}</label>
            <select value={carId} onChange={e => menjavaAvta(e.target.value)}
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors">
              {avti.map((a: any) => <option key={a.id} value={a.id}>{a.znamka} {a.model}</option>)}
            </select>
          </div>
        )}

        {/* Tip goriva */}
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3 block">{tx('Tip goriva', 'Fuel type')}</label>
          <div className="grid grid-cols-3 gap-3">
            {tipiGoriva.map((tip) => (
              <button key={tip.vrednost} type="button"
                onClick={() => setTipGoriva(tipGoriva === tip.vrednost ? '' : tip.vrednost)}
                className={`relative py-4 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                  tipGoriva === tip.vrednost
                    ? `${tip.barvaBorder} bg-opacity-20`
                    : 'border-[#1e1e32] bg-[#13131f]'
                }`}
                style={tipGoriva === tip.vrednost ? {
                  backgroundColor: tip.vrednost === 'diesel' ? '#1a1a1a' : tip.vrednost === '95' ? '#16a34a15' : '#2563eb15'
                } : {}}>
                <div className={`w-8 h-8 rounded-lg ${tip.barva} flex items-center justify-center`}>
                  <span className="text-white font-bold text-sm">{tip.naziv}</span>
                </div>
                <span className={`text-xs font-semibold mt-1 ${tipGoriva === tip.vrednost ? tip.barvaText : 'text-[#5a5a80]'}`}>
                  {tip.opis}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Datum */}
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Datum', 'Date')}</label>
          <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
            className={`w-full bg-[#13131f] border rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors ${
              jeNaknaden ? 'border-[#6c63ff]' : 'border-[#1e1e32] focus:border-[#6c63ff]'
            }`} />
          {jeNaknaden && (
            <div className="mt-2 p-2 rounded-lg bg-[#6c63ff22] border border-[#6c63ff44]">
              <p className="text-[#a5b4fc] text-xs">⚠️ {tx('Naknaden vnos - zabelezeno bo kdaj je bilo dejansko vneseno', 'Backdated entry - the actual entry time will be recorded')}</p>
            </div>
          )}
        </div>

        {/* Kilometri */}
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">
            {tx('Kilometri', 'Mileage')} * <span className="text-[#3a3a5a] normal-case">({tx('zadnji', 'last')}: {zadnjiKm.toLocaleString()} km)</span>
          </label>
          <div className="flex gap-2">
            <input type="number" value={km} onChange={e => setKm(e.target.value)}
              placeholder={`${tx('najmanj', 'at least')} ${zadnjiKm.toLocaleString()}`}
              className={`flex-1 bg-[#13131f] border rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors ${
                km && parseInt(km) < zadnjiKm ? 'border-[#ef4444]' : 'border-[#1e1e32] focus:border-[#6c63ff]'
              }`} />
            <MicButton polje="km" />
          </div>
          {km && parseInt(km) < zadnjiKm && (
            <div className="mt-2 p-2 rounded-lg bg-[#ef444422] border border-[#ef444444]">
              <p className="text-[#ef4444] text-xs">⛔ {tx('Km ne smejo biti nizji od', 'Mileage cannot be lower than')} {zadnjiKm.toLocaleString()} km!</p>
            </div>
          )}
        </div>

        {/* Litri */}
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Litri', 'Liters')} *</label>
          <div className="flex gap-2">
            <input type="number" step="0.01" value={litri} onChange={e => setLitri(e.target.value)} placeholder={tx('npr. 52.4', 'e.g. 52.4')}
              className="flex-1 bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            <MicButton polje="litri" />
          </div>
        </div>

        {/* Cena na liter */}
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Cena/L', 'Price/L')} (€)</label>
          <div className="flex gap-2">
            <input type="number" step="0.001" value={cenaNaLiter} onChange={e => setCenaNaLiter(e.target.value)} placeholder={tx('npr. 1.489', 'e.g. 1.489')}
              className="flex-1 bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            <MicButton polje="cena" />
          </div>
        </div>

        {/* Skupna cena */}
        {cenaSkupaj && (
          <div className="bg-[#6c63ff22] border border-[#6c63ff44] rounded-xl px-4 py-3">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">{tx('Skupna cena', 'Total price')}</p>
            <p className="text-white font-bold text-xl">{cenaSkupaj} €</p>
          </div>
        )}

        {/* Postaja */}
        <div ref={postajRef} className="relative">
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Postaja (po zelji)', 'Station (optional)')}</label>
          <div className="flex gap-2">
            <input type="text" value={postaja}
              onChange={e => handlePostajaChange(e.target.value)}
              onFocus={() => {
                if (postaja.length > 0) {
                  const filtered = postajeHistory.filter(p => p.toLowerCase().startsWith(postaja.toLowerCase()))
                  setFilteredPostaje(filtered)
                  setShowSuggestions(filtered.length > 0)
                }
              }}
              placeholder={tx('npr. OMV Ljubljana', 'e.g. OMV Ljubljana')}
              className="flex-1 bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            <MicButton polje="postaja" />
          </div>
          {showSuggestions && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a2e] border border-[#2a2a40] rounded-xl overflow-hidden z-10">
              {filteredPostaje.map((p, i) => (
                <button key={i} onClick={() => { setPostaja(p); setShowSuggestions(false) }}
                  className="w-full text-left px-4 py-2.5 text-white text-sm hover:bg-[#6c63ff22] transition-colors border-b border-[#2a2a40] last:border-0">
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">
            {tx('Slika racuna', 'Receipt photo')}
          </label>
          <label className="block bg-[#13131f] border border-dashed border-[#2a2a40] rounded-xl p-4 text-center cursor-pointer hover:border-[#6c63ff66] transition-colors">
            <input type="file" accept="image/*" capture="environment" onChange={dodajRacun} className="hidden" />
            {racunPreview ? (
              <img src={racunPreview} alt={tx('Racun', 'Receipt')} className="w-full max-h-56 object-contain rounded-lg" />
            ) : (
              <span className="text-[#a09aff] font-semibold">{tx('Dodaj/slikaj racun', 'Add/take receipt photo')}</span>
            )}
          </label>

          <div className="mt-3 space-y-3">
            <div className={racunPreview ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1 gap-2'}>
              <button type="button" onClick={preberiRacun} disabled={ocrLoading}
                className={`rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50 ${ocrAllowed ? 'bg-[#6c63ff] text-white' : 'bg-[#2a2a40] text-[#a09aff] border border-[#6c63ff55]'}`}>
                {ocrLoading
                  ? (jeEn ? 'Reading...' : 'Berem...')
                  : ocrAllowed
                    ? tx('Skeniraj/preberi racun', 'Scan/read receipt')
                    : tx('AI scan - prihaja v 2027', 'AI scan - coming in 2027')}
              </button>
              {racunPreview && (
                <button type="button" onClick={() => { setRacun(null); setRacunPreview(''); setOcrText(''); setOcrMessage('') }}
                  className="rounded-xl border border-[#ef444455] px-3 py-2 text-sm font-semibold text-[#ef4444]">
                  {tx('Odstrani sliko', 'Remove photo')}
                </button>
              )}
            </div>

            {!ocrAllowed && (
              <div className="rounded-xl border border-[#f59e0b55] bg-[#f59e0b14] p-3">
                <p className="text-[#f59e0b] text-xs font-bold">
                  {jeEn ? 'AI/OCR receipt reading is locked for beta users.' : 'AI/OCR branje računov je zaklenjeno za beta uporabnike.'}
                </p>
                <p className="text-[#f8c873] text-xs mt-1">
                  {jeEn
                    ? 'The feature is in internal testing and is planned for public launch in 2027. Manual entry and receipt photo storage work normally.'
                    : 'Funkcija je v internem testiranju in je planirana za javni zagon v letu 2027. Ročni vnos in shranjevanje slike računa delujeta normalno.'}
                </p>
              </div>
            )}

            {racunPreview && (
              <>
              <textarea
                value={ocrText}
                onChange={e => setOcrText(e.target.value)}
                placeholder={jeEn ? 'If automatic reading is not supported, paste receipt text here...' : 'Če avtomatsko branje ni podprto, prilepi tekst računa sem...'}
                rows={3}
                className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-[#6c63ff] transition-colors resize-none"
              />
              <button type="button" onClick={() => uporabiPrebranTekst(ocrText)}
                className="w-full rounded-xl border border-[#3ecfcf55] bg-[#3ecfcf18] px-3 py-2 text-sm font-semibold text-[#3ecfcf]">
                {jeEn ? 'Use text' : 'Uporabi tekst'}
              </button>
              </>
            )}
              {ocrMessage && <p className="text-[#a09aff] text-xs leading-relaxed">{ocrMessage}</p>}
            </div>
        </div>

        {message && (
          <div className={`p-3 rounded-xl text-sm border ${
            message.includes('✅') ? 'bg-[#16a34a22] border-[#16a34a44] text-[#4ade80]' : 'bg-[#ef444422] border-[#ef444444] text-[#fca5a5]'
          }`}>{message}</div>
        )}

        <button onClick={shrani} disabled={loading}
          className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 mt-2">
          {loading ? tx('Shranjevanje...', 'Saving...') : tx('Shrani tankanje', 'Save fill-up') + ' →'}
        </button>
      </div>

      <HomeButton />
    </div>
  )
}
