'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton, HomeButton } from '@/lib/nav'
import { trackEvent } from '@/lib/analytics'
import { compressImageFile, uploadImageProfiles } from '@/lib/image-compress'
import { parseReceiptText, readReceiptTextFromImage } from '@/lib/receipt-ocr'
import { useLanguage } from '@/lib/i18n'
import { currencySymbol as formatCurrencySymbol } from '@/lib/currency'

type FuelType = {
  value: string
  title: string
  label: string
  color: string
  border: string
  text: string
  activeBg: string
}

const adminEmails = ['drazen.letsgo@gmail.com', 'drazenletsgo@gmail.com', 'garagebase.app@gmail.com']

export default function VnosGoriva() {
  const { language } = useLanguage()
  const jeEn = language === 'en'
  const tx = (sl: string, en: string) => (jeEn ? en : sl)

  const [datum, setDatum] = useState(new Date().toISOString().split('T')[0])
  const [km, setKm] = useState('')
  const [litri, setLitri] = useState('')
  const [cenaNaLiter, setCenaNaLiter] = useState('')
  const [postaja, setPostaja] = useState('')
  const [tipGoriva, setTipGoriva] = useState('')
  const [carId, setCarId] = useState('')
  const [avti, setAvti] = useState<any[]>([])
  const [zadnjiKm, setZadnjiKm] = useState(0)
  const [kmReady, setKmReady] = useState(false)
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
  const [valuta, setValuta] = useState<'EUR' | 'USD'>('EUR')
  const postajRef = useRef<HTMLDivElement>(null)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  const danes = new Date().toISOString().split('T')[0]
  const jeNaknaden = datum < danes
  const cenaSkupaj = litri && cenaNaLiter ? (parseFloat(litri) * parseFloat(cenaNaLiter)).toFixed(2) : ''
  const currencySymbol = formatCurrencySymbol(valuta)

  const tipiGoriva: FuelType[] = [
    { value: '95', title: '95', label: tx('Bencin 95', 'Petrol 95'), color: 'bg-[#16a34a]', border: 'border-[#16a34a]', text: 'text-[#16a34a]', activeBg: '#16a34a18' },
    { value: '100', title: '100', label: tx('Bencin 100', 'Petrol 100'), color: 'bg-[#2563eb]', border: 'border-[#2563eb]', text: 'text-[#2563eb]', activeBg: '#2563eb18' },
    { value: 'diesel', title: 'D', label: tx('Dizel', 'Diesel'), color: 'bg-[#1a1a1a]', border: 'border-[#888888]', text: 'text-[#888888]', activeBg: '#1a1a1a' },
  ]

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/'
        return
      }

      const email = user.email?.toLowerCase() || ''
      let isAdmin = adminEmails.includes(email)
      if (!isAdmin) {
        const { data: adminRow } = await supabase.from('admin_users').select('email').eq('email', email).maybeSingle()
        isAdmin = !!adminRow
      }
      setOcrAllowed(isAdmin)

      try {
        const settings = JSON.parse(localStorage.getItem('garagebase_nastavitve') || '{}')
        setValuta(settings.valuta === 'USD' ? 'USD' : 'EUR')
      } catch {
        setValuta('EUR')
      }

      const params = new URLSearchParams(window.location.search)
      const carParam = params.get('car')
      const { data } = await supabase.from('cars').select('id, znamka, model, km_trenutni, gorivo').eq('user_id', user.id)
      if (!data || data.length === 0) return

      setAvti(data)
      const izbrani = data.find((a: any) => a.id === carParam) || data[0]
      setCarId(izbrani.id)
      setKmReady(false)
      await Promise.all([
        naloziZadnjiKm(izbrani.id, izbrani.km_trenutni || 0),
        naloziPostaje(data.map((a: any) => a.id)),
      ])
      if (izbrani.gorivo === 'Diesel') setTipGoriva('diesel')
      else if (izbrani.gorivo === 'Bencin') setTipGoriva('95')
      trackEvent('fuel_add_open', { carId: izbrani.id })
    }

    init()

    const handleClick = (event: MouseEvent) => {
      if (postajRef.current && !postajRef.current.contains(event.target as Node)) {
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
    setZadnjiKm(Math.max(kmAvta, servisData?.[0]?.km || 0, gorivoData?.[0]?.km || 0))
    setKmReady(true)
  }

  const sveziMinimalniKm = async (id: string) => {
    const [{ data: avtoData }, { data: servisData }, { data: gorivoData }] = await Promise.all([
      supabase.from('cars').select('km_trenutni').eq('id', id).maybeSingle(),
      supabase.from('service_logs').select('km').eq('car_id', id).order('km', { ascending: false }).limit(1),
      supabase.from('fuel_logs').select('km').eq('car_id', id).order('km', { ascending: false }).limit(1),
    ])
    return Math.max(avtoData?.km_trenutni || 0, servisData?.[0]?.km || 0, gorivoData?.[0]?.km || 0)
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
      setPostajeHistory([...new Set(data.map((v: any) => v.postaja).filter(Boolean))] as string[])
    }
  }

  const menjavaAvta = async (noviId: string) => {
    setCarId(noviId)
    const avto = avti.find((a: any) => a.id === noviId)
    if (!avto) return
    setKmReady(false)
    await naloziZadnjiKm(noviId, avto.km_trenutni || 0)
    if (avto.gorivo === 'Diesel') setTipGoriva('diesel')
    else if (avto.gorivo === 'Bencin') setTipGoriva('95')
  }

  const handlePostajaChange = (value: string) => {
    setPostaja(value)
    const filtered = value
      ? postajeHistory.filter((p) => p.toLowerCase().startsWith(value.toLowerCase()))
      : []
    setFilteredPostaje(filtered)
    setShowSuggestions(filtered.length > 0)
  }

  const pretvoriVStevilko = (tekst: string): number | null => {
    const direktno = parseFloat(tekst.replace(',', '.').replace(/\s/g, ''))
    return Number.isNaN(direktno) ? null : direktno
  }

  const glasovniVnos = (polje: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setMessage(tx('Glasovni vnos ni podprt v tem brskalniku.', 'Voice input is not supported in this browser.'))
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = jeEn ? 'en-US' : 'sl-SI'
    recognition.continuous = false
    recognition.interimResults = false
    setPoslusam(polje)

    recognition.onresult = (event: any) => {
      const tekst = event.results[0][0].transcript.toLowerCase().trim()
      if (polje === 'postaja') {
        setPostaja(tekst)
      } else {
        const stevilka = pretvoriVStevilko(tekst)
        if (stevilka !== null) {
          if (polje === 'km') setKm(stevilka.toString())
          if (polje === 'litri') setLitri(stevilka.toString())
          if (polje === 'cena') setCenaNaLiter(stevilka.toString())
        } else {
          setMessage(`${tx('Nisem razumel', 'I did not understand')}: "${tekst}". ${tx('Poskusi znova.', 'Try again.')}`)
        }
      }
      setPoslusam(null)
    }
    recognition.onerror = () => {
      setMessage(tx('Napaka pri glasovnem vnosu.', 'Voice input error.'))
      setPoslusam(null)
    }
    recognition.onend = () => setPoslusam(null)
    recognition.start()
  }

  const MicButton = ({ polje }: { polje: string }) => (
    <button
      type="button"
      onClick={() => glasovniVnos(polje)}
      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
        poslusam === polje
          ? 'bg-[#ef4444] text-white animate-pulse'
          : 'bg-[#13131f] border border-[#2a2a40] text-[#5a5a80] hover:border-[#3ecfcf] hover:text-[#3ecfcf]'
      }`}
      aria-label={tx('Glasovni vnos', 'Voice input')}
    >
      MIC
    </button>
  )

  const preberiRacunIzDatoteke = async (file: File) => {
    if (!ocrAllowed) {
      setOcrMessage(tx(
        'AI branje racunov je trenutno v internem testiranju. Javni zagon je planiran v letu 2027.',
        'AI receipt reading is currently in internal testing. Public launch is planned for 2027.'
      ))
      trackEvent('receipt_scan_locked_clicked', { carId, type: 'fuel' })
      return
    }

    setOcrLoading(true)
    setOcrMessage(tx('Berem sliko računa...', 'Reading receipt photo...'))
    trackEvent('receipt_scan_clicked', { carId, type: 'fuel' })
    try {
      const text = await readReceiptTextFromImage(file)
      setOcrText(text)
      uporabiPrebranTekst(text)
      trackEvent('receipt_scan_success', { carId, type: 'fuel', textLength: text.length })
    } catch (error: any) {
      trackEvent('receipt_scan_failed', { carId, type: 'fuel', message: error.message })
      setOcrMessage(`${error.message} ${tx('Lahko prilepis tekst racuna spodaj in kliknes "Uporabi tekst".', 'You can paste the receipt text below and click "Use text".')}`)
    } finally {
      setOcrLoading(false)
    }
  }

  const dodajRacun = async (event: any) => {
    const file = event.target.files?.[0]
    if (!file) return
    await pripraviInPreberiRacun(file)
    event.target.value = ''
  }

  const pripraviInPreberiRacun = async (file: File) => {
    setMessage('')
    let preparedFile = file
    try {
      const result = await compressImageFile(file, uploadImageProfiles.receipt)
      preparedFile = result.file
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
      setMessage(error.message || tx('Slike racuna ni bilo mogoce pripraviti.', 'Receipt photo could not be prepared.'))
      return
    }
    setOcrText('')
    setOcrMessage('')
    await preberiRacunIzDatoteke(preparedFile)
  }

  useEffect(() => {
    const handleWindowPaste = async (event: ClipboardEvent) => {
      const imageItem = Array.from(event.clipboardData?.items || []).find((item) => item.type.startsWith('image/'))
      const file = imageItem?.getAsFile()
      if (!file) return
      event.preventDefault()
      await pripraviInPreberiRacun(file)
    }
    window.addEventListener('paste', handleWindowPaste)
    return () => window.removeEventListener('paste', handleWindowPaste)
  }, [ocrAllowed, carId])

  const uporabiPrebranTekst = (text: string) => {
    const result = parseReceiptText(text)
    if (result.date) setDatum(result.date)
    if (result.liters) setLitri(result.liters)
    if (result.pricePerLiter) setCenaNaLiter(result.pricePerLiter)
    if (result.station) setPostaja(result.station)
    if (result.fuelType) setTipGoriva(result.fuelType)
    setOcrMessage(tx('Podatki so prebrani. Pred shranjevanjem jih se enkrat preveri.', 'Data was read. Check it once more before saving.'))
    trackEvent('receipt_text_applied', {
      carId,
      type: 'fuel',
      hasDate: !!result.date,
      hasLiters: !!result.liters,
      hasPricePerLiter: !!result.pricePerLiter,
      hasTotal: !!result.total,
      hasStation: !!result.station,
      hasFuelType: !!result.fuelType,
    })
  }

  const preberiRacun = async () => {
    if (!ocrAllowed) {
      setOcrMessage(tx(
        'AI branje racunov je trenutno v internem testiranju. Javni zagon je planiran v letu 2027.',
        'AI receipt reading is currently in internal testing. Public launch is planned for 2027.'
      ))
      trackEvent('receipt_scan_locked_clicked', { carId, type: 'fuel' })
      return
    }
    if (!racun) {
      setOcrMessage(tx('Najprej dodaj ali slikaj racun.', 'First add or take a receipt photo.'))
      return
    }

    await preberiRacunIzDatoteke(racun)
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
    if (!kmReady) {
      setMessage(tx('Počakaj, da se naložijo zadnji kilometri vozila.', 'Wait until the latest vehicle mileage is loaded.'))
      return
    }
    if (!km || !litri) {
      setMessage(tx('Km in litri sta obvezna!', 'Mileage and liters are required!'))
      return
    }

    const vneseniKm = parseInt(km)
    const sveziKm = await sveziMinimalniKm(carId)
    if (vneseniKm < sveziKm) {
      setZadnjiKm(sveziKm)
      setMessage(`${tx('Km ne smejo biti nižji od', 'Mileage cannot be lower than')} ${sveziKm.toLocaleString()} km!`)
      return
    }

    setLoading(true)
    setMessage('')

    let receiptUrl: string | null = null
    try {
      receiptUrl = await naloziRacun()
    } catch (error: any) {
      setMessage(tx('Napaka pri nalaganju slike: ', 'Error uploading image: ') + error.message)
      setLoading(false)
      return
    }

    const datumVnosa = new Date().toLocaleDateString('sl-SI')
    const opombaNaknaden = jeNaknaden ? ` [Naknadno vneseno: ${datumVnosa}]` : ''
    const postajaZOpombo = postaja ? postaja + opombaNaknaden : jeNaknaden ? opombaNaknaden.trim() : null

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

    if (error) {
      setMessage(tx('Napaka: ', 'Error: ') + error.message)
      setLoading(false)
      return
    }

    await supabase.from('cars').update({ km_trenutni: Math.max(sveziKm, vneseniKm) }).eq('id', carId)
    trackEvent('fuel_saved', { carId, hasReceipt: !!receiptUrl, verificationLevel: 'basic' })
    setMessage(tx('Tankanje uspesno shranjeno!', 'Fill-up saved successfully!'))
    setTimeout(() => {
      window.location.href = `/zgodovina-goriva?car=${carId}`
    }, 1000)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-8">
        <BackButton />
        <h1 className="text-xl font-bold text-white">⛽ {tx('Vnos goriva', 'Fuel entry')}</h1>
      </div>

      {poslusam && (
        <div className="bg-[#ef444422] border border-[#ef444444] rounded-xl p-3 mb-4 flex items-center gap-3">
          <span className="text-xl animate-pulse">MIC</span>
          <p className="text-[#ef4444] text-sm font-semibold">{tx('Poslusam... govori zdaj', 'Listening... speak now')}</p>
        </div>
      )}

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 flex flex-col gap-4">
        {avti.length > 1 && (
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Avto', 'Car')}</label>
            <select
              value={carId}
              onChange={(event) => menjavaAvta(event.target.value)}
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#3ecfcf] transition-colors"
            >
              {avti.map((a: any) => <option key={a.id} value={a.id}>{a.znamka} {a.model}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3 block">{tx('Tip goriva', 'Fuel type')}</label>
          <div className="grid grid-cols-3 gap-3">
            {tipiGoriva.map((tip) => (
              <button
                key={tip.value}
                type="button"
                onClick={() => setTipGoriva(tipGoriva === tip.value ? '' : tip.value)}
                className={`relative py-4 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                  tipGoriva === tip.value ? tip.border : 'border-[#1e1e32] bg-[#13131f]'
                }`}
                style={tipGoriva === tip.value ? { backgroundColor: tip.activeBg } : {}}
              >
                <div className={`w-8 h-8 rounded-lg ${tip.color} flex items-center justify-center`}>
                  <span className="text-white font-bold text-sm">{tip.title}</span>
                </div>
                <span className={`text-xs font-semibold mt-1 ${tipGoriva === tip.value ? tip.text : 'text-[#5a5a80]'}`}>
                  {tip.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Datum', 'Date')}</label>
          <input
            type="date"
            value={datum}
            onChange={(event) => setDatum(event.target.value)}
            className={`w-full bg-[#13131f] border rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors ${
              jeNaknaden ? 'border-[#3ecfcf]' : 'border-[#1e1e32] focus:border-[#3ecfcf]'
            }`}
          />
          {jeNaknaden && (
            <div className="mt-2 p-2 rounded-lg bg-[#3ecfcf22] border border-[#3ecfcf44]">
              <p className="text-[#3ecfcf] text-xs">
                {tx('Naknaden vnos - zabelezen bo cas dejanskega vnosa', 'Backdated entry - the actual entry time will be recorded')}
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">
            {tx('Kilometri', 'Mileage')} * <span className="text-[#3a3a5a] normal-case">({tx('zadnji', 'last')}: {kmReady ? `${zadnjiKm.toLocaleString()} km` : tx('nalagam...', 'loading...')})</span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={km}
              onChange={(event) => setKm(event.target.value)}
              placeholder={kmReady ? `${tx('najmanj', 'at least')} ${zadnjiKm.toLocaleString()}` : tx('nalagam zadnje km...', 'loading latest mileage...')}
              className={`flex-1 bg-[#13131f] border rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors ${
                km && parseInt(km) < zadnjiKm ? 'border-[#ef4444]' : 'border-[#1e1e32] focus:border-[#3ecfcf]'
              }`}
            />
            <MicButton polje="km" />
          </div>
          {km && parseInt(km) < zadnjiKm && (
            <div className="mt-2 p-2 rounded-lg bg-[#ef444422] border border-[#ef444444]">
              <p className="text-[#ef4444] text-xs">{tx('Km ne smejo biti nizji od', 'Mileage cannot be lower than')} {zadnjiKm.toLocaleString()} km!</p>
            </div>
          )}
        </div>

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Litri', 'Liters')} *</label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              value={litri}
              onChange={(event) => setLitri(event.target.value)}
              placeholder={tx('npr. 52.4', 'e.g. 52.4')}
              className="flex-1 bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#3ecfcf] transition-colors"
            />
            <MicButton polje="litri" />
          </div>
        </div>

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Cena/L', 'Price/L')} ({currencySymbol})</label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.001"
              value={cenaNaLiter}
              onChange={(event) => setCenaNaLiter(event.target.value)}
              placeholder={tx('npr. 1.489', 'e.g. 1.489')}
              className="flex-1 bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#3ecfcf] transition-colors"
            />
            <MicButton polje="cena" />
          </div>
        </div>

        {cenaSkupaj && (
          <div className="bg-[#3ecfcf22] border border-[#3ecfcf44] rounded-xl px-4 py-3">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-1">{tx('Skupna cena', 'Total price')}</p>
            <p className="text-white font-bold text-xl">{cenaSkupaj} {currencySymbol}</p>
          </div>
        )}

        <div ref={postajRef} className="relative">
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Postaja (po zelji)', 'Station (optional)')}</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={postaja}
              onChange={(event) => handlePostajaChange(event.target.value)}
              onFocus={() => handlePostajaChange(postaja)}
              placeholder={tx('npr. OMV Ljubljana', 'e.g. OMV Ljubljana')}
              className="flex-1 bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#3ecfcf] transition-colors"
            />
            <MicButton polje="postaja" />
          </div>
          {showSuggestions && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a2e] border border-[#2a2a40] rounded-xl overflow-hidden z-10">
              {filteredPostaje.map((p, index) => (
                <button
                  key={`${p}-${index}`}
                  type="button"
                  onClick={() => {
                    setPostaja(p)
                    setShowSuggestions(false)
                  }}
                  className="w-full text-left px-4 py-2.5 text-white text-sm hover:bg-[#3ecfcf22] transition-colors border-b border-[#2a2a40] last:border-0"
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Scan racuna', 'Receipt scan')}</label>
          <input ref={receiptInputRef} type="file" accept="image/*" capture="environment" onChange={dodajRacun} className="hidden" />
          <button
            type="button"
            onClick={() => (ocrAllowed ? receiptInputRef.current?.click() : preberiRacun())}
            disabled={ocrLoading}
            className={`w-full rounded-xl border px-4 py-4 text-center font-bold transition-colors disabled:opacity-60 ${
              ocrAllowed
                ? 'bg-[#3ecfcf18] border-[#3ecfcf66] text-[#3ecfcf] hover:bg-[#3ecfcf28]'
                : 'bg-[#f59e0b14] border-[#f59e0b55] text-[#f59e0b]'
            }`}
          >
            {ocrLoading
              ? tx('Berem racun...', 'Reading receipt...')
              : ocrAllowed
                ? tx('Scan racuna', 'Scan receipt')
                : tx('AI scan racunov - prihaja v 2027', 'AI receipt scan - coming in 2027')}
          </button>
          <label className="mt-3 block bg-[#13131f] border border-dashed border-[#2a2a40] rounded-xl p-4 text-center cursor-pointer hover:border-[#3ecfcf66] transition-colors">
            <input type="file" accept="image/*" onChange={dodajRacun} className="hidden" />
            {racunPreview ? (
              <img src={racunPreview} alt={tx('Racun', 'Receipt')} className="w-full max-h-56 object-contain rounded-lg" />
            ) : (
              <span className="text-[#3ecfcf] font-semibold">{tx('Ali izberi sliko racuna iz galerije', 'Or choose a receipt photo from gallery')}</span>
            )}
          </label>

          <div className="mt-3 space-y-3">
            <div className={racunPreview ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1 gap-2'}>
              <button
                type="button"
                onClick={preberiRacun}
                disabled={ocrLoading}
                className={`rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
                  ocrAllowed ? 'bg-[#6c63ff] text-white' : 'bg-[#2a2a40] text-[#a09aff] border border-[#6c63ff55]'
                }`}
              >
                {ocrLoading
                  ? tx('Berem...', 'Reading...')
                  : ocrAllowed
                    ? tx('Ponovno preberi sliko', 'Read photo again')
                    : tx('AI scan - prihaja v 2027', 'AI scan - coming in 2027')}
              </button>
              {racunPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setRacun(null)
                    setRacunPreview('')
                    setOcrText('')
                    setOcrMessage('')
                  }}
                  className="rounded-xl border border-[#ef444455] px-3 py-2 text-sm font-semibold text-[#ef4444]"
                >
                  {tx('Odstrani sliko', 'Remove photo')}
                </button>
              )}
            </div>

            {!ocrAllowed && (
              <div className="rounded-xl border border-[#f59e0b55] bg-[#f59e0b14] p-3">
                <p className="text-[#f59e0b] text-xs font-bold">
                  {tx('AI/OCR branje racunov je zaklenjeno za beta uporabnike.', 'AI/OCR receipt reading is locked for beta users.')}
                </p>
                <p className="text-[#f8c873] text-xs mt-1">
                  {tx(
                    'Funkcija je v internem testiranju in je planirana za javni zagon v letu 2027. Rocni vnos in shranjevanje slike racuna delujeta normalno.',
                    'The feature is in internal testing and is planned for public launch in 2027. Manual entry and receipt photo storage work normally.'
                  )}
                </p>
              </div>
            )}

            {racunPreview && (
              <>
                <textarea
                  value={ocrText}
                  onChange={(event) => setOcrText(event.target.value)}
                  placeholder={tx(
                    'Ce avtomatsko branje ni podprto, prilepi tekst racuna sem...',
                    'If automatic reading is not supported, paste receipt text here...'
                  )}
                  rows={3}
                  className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-[#3ecfcf] transition-colors resize-none"
                />
                <button
                  type="button"
                  onClick={() => uporabiPrebranTekst(ocrText)}
                  className="w-full rounded-xl border border-[#3ecfcf55] bg-[#3ecfcf18] px-3 py-2 text-sm font-semibold text-[#3ecfcf]"
                >
                  {tx('Uporabi tekst', 'Use text')}
                </button>
              </>
            )}

            {ocrMessage && (
              <div className="rounded-xl border border-[#6c63ff55] bg-[#6c63ff14] p-3">
                <p className="text-[#a09aff] text-xs leading-relaxed">{ocrMessage}</p>
              </div>
            )}
          </div>
        </div>

        {message && (
          <div className={`p-3 rounded-xl text-sm border ${
            message.includes('uspesno') || message.includes('successfully') ? 'bg-[#16a34a22] border-[#16a34a44] text-[#4ade80]' : 'bg-[#ef444422] border-[#ef444444] text-[#fca5a5]'
          }`}>
            {message}
          </div>
        )}

        <button
          onClick={shrani}
          disabled={loading || !kmReady}
          className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 mt-2"
        >
          {loading ? tx('Shranjevanje...', 'Saving...') : `${tx('Shrani tankanje', 'Save fill-up')} ->`}
        </button>
      </div>

      <HomeButton />
    </div>
  )
}

