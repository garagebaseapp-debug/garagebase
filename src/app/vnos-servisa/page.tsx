'use client'

import { type ChangeEvent, useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'
import { trackEvent } from '@/lib/analytics'
import { compressImageFile, imageCompressionErrorText, uploadImageProfiles } from '@/lib/image-compress'
import { getStoredLanguage, type Language } from '@/lib/i18n'
import { type GarageBaseCurrency, currencySymbol, getCurrencyFromSettings } from '@/lib/currency'
import { formatDistance, getDistanceUnitFromSettings, type DistanceUnit } from '@/lib/units'
import { clearVehicleDataCaches, readGarageCache } from '@/lib/vehicle-cache'

const KM_ANOMALY_THRESHOLD = 2000

type ServiceEntryCar = {
  id: string
  znamka?: string | null
  model?: string | null
  km_trenutni?: number | null
  arhivirano?: boolean | null
}

type ServiceNameRow = {
  servis?: string | null
}

type SpeechRecognitionResultEvent = {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string
      }
    }
  }
}

type SpeechRecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

export default function VnosServisa() {
  const [datum, setDatum] = useState(() => new Date().toISOString().split('T')[0])
  const [km, setKm] = useState('')
  const [opis, setOpis] = useState('')
  const [servis, setServis] = useState('')
  const [cena, setCena] = useState('')
  const [carId, setCarId] = useState('')
  const [avti, setAvti] = useState<ServiceEntryCar[]>([])
  const [zadnjiKm, setZadnjiKm] = useState(0)
  const [kmReady, setKmReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [slike, setSlike] = useState<File[]>([])
  const [slikePreview, setSlikePreview] = useState<string[]>([])
  const [stevec, setStevec] = useState<File | null>(null)
  const [stevecPreview, setStevecPreview] = useState('')
  const [uploadProgress, setUploadProgress] = useState(false)
  const [servisHistory, setServisHistory] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredServis, setFilteredServis] = useState<string[]>([])
  const [poslusam, setPoslusam] = useState<string | null>(null)
  const [intervalKm, setIntervalKm] = useState('')
  const [intervalDni, setIntervalDni] = useState('')
  const [language] = useState<Language>(() => getStoredLanguage())
  const [valuta] = useState<GarageBaseCurrency>(() => getCurrencyFromSettings())
  const [enotaRazdalje] = useState<DistanceUnit>(() => getDistanceUnitFromSettings())
  const servisRef = useRef<HTMLDivElement>(null)

  const danes = new Date().toISOString().split('T')[0]
  const jeNaknaden = datum < danes
  const jeEn = language === 'en'
  const tx = (sl: string, en: string) => jeEn ? en : sl

  useEffect(() => {
    const init = async () => {
      const cachedCars = ((readGarageCache()?.avti || []) as ServiceEntryCar[]).filter((car) => car?.arhivirano !== true)
      if (cachedCars.length > 0) setAvti(cachedCars)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const params = new URLSearchParams(window.location.search)
      const carParam = params.get('car')
      const activeCarsResult = await supabase
        .from('cars').select('id, znamka, model, km_trenutni, arhivirano')
        .eq('user_id', user.id)
        .or('arhivirano.is.null,arhivirano.eq.false')
      let data = (activeCarsResult.data || []) as ServiceEntryCar[]
      if (activeCarsResult.error || data.length === 0) {
        if (activeCarsResult.error) console.warn('[GarageBase service entry] active cars query failed', activeCarsResult.error)
        const fallback = await supabase.from('cars').select('id, znamka, model, km_trenutni, arhivirano').eq('user_id', user.id)
        if (fallback.error) console.warn('[GarageBase service entry] fallback cars query failed', fallback.error)
        data = (fallback.data || []) as ServiceEntryCar[]
      }
      data = (data || []).filter((car) => car?.arhivirano !== true)
      if (data && data.length > 0) {
        setAvti(data)
        const izbrani = carParam ? data.find((a) => a.id === carParam) : null
        await naloziServisHistory(data.map((a) => a.id))
        if (izbrani) {
          setCarId(izbrani.id)
          setKmReady(false)
          trackEvent('service_add_open', { carId: izbrani.id })
          await naloziZadnjiKm(izbrani.id, izbrani.km_trenutni || 0)
        } else {
          setCarId('')
          setKmReady(false)
          setZadnjiKm(0)
          trackEvent('service_add_open', { carId: null })
        }
      }
    }
    init()

    const handleClick = (e: MouseEvent) => {
      if (servisRef.current && !servisRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function naloziZadnjiKm(id: string, kmAvta: number) {
    const [{ data: servisData }, { data: gorivoData }] = await Promise.all([
      supabase.from('service_logs').select('km').eq('car_id', id).order('km', { ascending: false }).limit(1),
      supabase.from('fuel_logs').select('km').eq('car_id', id).order('km', { ascending: false }).limit(1),
    ])
    const maxServis = servisData?.[0]?.km || 0
    const maxGorivo = gorivoData?.[0]?.km || 0
    setZadnjiKm(Math.max(kmAvta, maxServis, maxGorivo))
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

  async function naloziServisHistory(carIds: string[]) {
    if (carIds.length === 0) return
    const { data } = await supabase
      .from('service_logs')
      .select('servis')
      .in('car_id', carIds)
      .not('servis', 'is', null)
      .order('datum', { ascending: false })
      .limit(200)
    if (data) {
      const unikatni = [...new Set(((data || []) as ServiceNameRow[]).map((v) => v.servis).filter(Boolean))] as string[]
      setServisHistory(unikatni)
    }
  }

  const menjavaAvta = async (noviId: string) => {
    setCarId(noviId)
    setKmReady(false)
    const avto = avti.find((a) => a.id === noviId)
    if (!avto) {
      setZadnjiKm(0)
      return
    }
    await naloziZadnjiKm(noviId, avto.km_trenutni || 0)
  }

  const handleServisChange = (value: string) => {
    setServis(value)
    if (value.length > 0) {
      const filtered = servisHistory.filter(s => s.toLowerCase().startsWith(value.toLowerCase()))
      setFilteredServis(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }

  const dodajSliko = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    if (slike.length + files.length > 3) { setMessage(tx('Največ 3 slike na servis!', 'Max 3 images per service entry!')); return }
    try {
      const compressed = await Promise.all(files.map((file) => compressImageFile(file, uploadImageProfiles.receipt)))
      const noveSlike = [...slike, ...compressed.map((item) => item.file)].slice(0, 3)
      setSlike(noveSlike)
      setSlikePreview(noveSlike.map((f: File) => URL.createObjectURL(f)))
      setMessage('')
      compressed.forEach((item) => {
        if (item.changed) {
          trackEvent('image_compressed', {
            type: 'service_receipt',
            originalBytes: item.originalBytes,
            compressedBytes: item.compressedBytes,
          })
        }
      })
    } catch (error: unknown) {
      setMessage(imageCompressionErrorText(error, language))
    }
  }

  const odstraniSliko = (index: number) => {
    const noveSlike = slike.filter((_, i) => i !== index)
    setSlike(noveSlike)
    setSlikePreview(noveSlike.map((f: File) => URL.createObjectURL(f)))
  }

  const dodajStevec = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await compressImageFile(file, uploadImageProfiles.document)
      setStevec(result.file)
      setStevecPreview(URL.createObjectURL(result.file))
      setMessage('')
      if (result.changed) {
        trackEvent('image_compressed', {
          type: 'odometer_photo',
          originalBytes: result.originalBytes,
          compressedBytes: result.compressedBytes,
        })
      }
    } catch (error: unknown) {
      setMessage(imageCompressionErrorText(error, language))
      return
    }
  }

  const pretвориVStevilko = (tekst: string): number | null => {
    const direktno = parseFloat(tekst.replace(',', '.').replace(/\s/g, ''))
    if (!isNaN(direktno)) return direktno

    const rezultat = tekst
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
    const speechWindow = window as SpeechRecognitionWindow
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!SpeechRecognition) { setMessage(tx('Glasovni vnos ni podprt v tem brskalniku.', 'Voice input is not supported in this browser.')); return }

    const recognition = new SpeechRecognition()
    recognition.lang = 'sl-SI'
    recognition.continuous = false
    recognition.interimResults = false
    setPoslusam(polje)

    recognition.onresult = (event) => {
      const tekst = event.results[0][0].transcript.toLowerCase().trim()
      if (polje === 'opis' || polje === 'servis') {
        if (polje === 'opis') setOpis(tekst)
        if (polje === 'servis') setServis(tekst)
      } else {
        const stevilka = pretвориVStevilko(tekst)
        if (stevilka !== null) {
          if (polje === 'km') setKm(stevilka.toString())
          if (polje === 'cena') setCena(stevilka.toString())
        } else {
          setMessage(`${tx('Nisem razumel', 'I did not understand')}: "${tekst}". ${tx('Poskusi znova.', 'Try again.')}`)
        }
      }
      setPoslusam(null)
    }

    recognition.onerror = () => { setMessage(tx('Napaka pri glasovnem vnosu.', 'Voice input error.')); setPoslusam(null) }
    recognition.onend = () => setPoslusam(null)
    recognition.start()
  }

  const micButton = (polje: string) => (
    <button type="button" onClick={() => glasovniVnos(polje)}
      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
        poslusam === polje
          ? 'bg-[#ef4444] text-white animate-pulse'
          : 'bg-[#13131f] border border-[#2a2a40] text-[#5a5a80] hover:border-[#f59e0b] hover:text-[#f59e0b]'
      }`}>
      🎤
    </button>
  )


  const datumPlusDni = (base: string, dni: number) => {
    const d = new Date(base)
    d.setDate(d.getDate() + dni)
    return d.toISOString().split('T')[0]
  }

  const ustvariServisniOpomnik = async (vneseniKm: number) => {
    const kmNaslednji = intervalKm ? vneseniKm + parseInt(intervalKm) : null
    const datumNaslednji = intervalDni ? datumPlusDni(datum, parseInt(intervalDni)) : null
    if (!kmNaslednji && !datumNaslednji) return

    const { error } = await supabase.from('reminders').insert({
      car_id: carId,
      tip: 'servis',
      datum: datumNaslednji,
      km_opomnik: kmNaslednji,
      opozorilo_dni_prej: 30,
    })
    if (error) throw error
  }
  const shrani = async () => {
    if (!carId) { setMessage(tx('Najprej izberi vozilo.', 'Choose a vehicle first.')); return }
    if (!kmReady) {
      setMessage(tx('Počakaj, da se naložijo zadnji kilometri vozila.', 'Wait until the latest vehicle mileage is loaded.'))
      return
    }
    if (!km || !opis) { setMessage(tx('Km in opis sta obvezna!', 'Mileage and work description are required!')); return }
    const vneseniKm = parseInt(km)
    const sveziKm = await sveziMinimalniKm(carId)
    const jeKmNaknaden = vneseniKm < sveziKm
    if (vneseniKm < sveziKm) {
      setZadnjiKm(sveziKm)
      const ok = window.confirm(tx(
        `Vpisuješ ${formatDistance(vneseniKm, enotaRazdalje)}, zadnje stanje pa je ${formatDistance(sveziKm, enotaRazdalje)}. Servis bomo označili kot naknadno vnesen in trenutnih km vozila ne bomo znižali. Nadaljujem?`,
        `You are entering ${formatDistance(vneseniKm, enotaRazdalje)}, while the latest mileage is ${formatDistance(sveziKm, enotaRazdalje)}. This service will be marked as entered later and vehicle current mileage will not be lowered. Continue?`
      ))
      if (!ok) {
        setMessage(tx('Vnos ni shranjen. Popravi kilometre ali potrdi naknadni vnos.', 'Entry was not saved. Correct the mileage or confirm the later entry.'))
        return
      }
    }
    if (sveziKm > 0 && vneseniKm - sveziKm > KM_ANOMALY_THRESHOLD) {
      const ok = window.confirm(tx(
        `Razlika od zadnjega vnosa je ${formatDistance(vneseniKm - sveziKm, enotaRazdalje)}. Je to pravilno?`,
        `The difference from the last entry is ${formatDistance(vneseniKm - sveziKm, enotaRazdalje)}. Is this correct?`
      ))
      if (!ok) return
    }
    setLoading(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/'; return }

    const { data: servisData, error } = await supabase.from('service_logs').insert({
      car_id: carId, datum, km: vneseniKm,
      opis: jeNaknaden || jeKmNaknaden
        ? `${opis} [${tx('Naknadno vneseno', 'Entered later')}: ${danes}${jeKmNaknaden ? `, ${tx('km nižji od zadnjega stanja', 'mileage below latest state')}` : ''}]`
        : opis,
      servis: servis || null,
      cena: cena ? parseFloat(cena) : null,
    }).select().single()

    if (error) { setMessage(tx('Napaka: ', 'Error: ') + error.message); setLoading(false); return }
    if (!servisData?.id) {
      setMessage(tx('Napaka: servis ni bil potrjen po shranjevanju.', 'Error: service entry was not confirmed after saving.'))
      setLoading(false)
      return
    }

    const opozorila: string[] = []
    const { error: carUpdateError } = await supabase.from('cars').update({ km_trenutni: Math.max(sveziKm, vneseniKm) }).eq('id', carId).eq('user_id', user.id)
    if (carUpdateError) opozorila.push(tx('trenutni km vozila niso bili posodobljeni', 'vehicle current mileage was not updated'))
    clearVehicleDataCaches(carId)
    trackEvent('service_saved', { carId, hasReceipt: slike.length > 0 })
    try {
      await ustvariServisniOpomnik(vneseniKm)
    } catch {
      opozorila.push(tx('servisni opomnik ni bil ustvarjen', 'service reminder was not created'))
    }

    if (slike.length > 0) {
      setUploadProgress(true)
      const slikeUrls: string[] = []
      for (let i = 0; i < slike.length; i++) {
        const file = slike[i]
        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}/${servisData.id}_${i}.${fileExt}`
        const { error: uploadError } = await supabase.storage.from('service-documents').upload(fileName, file, { upsert: true })
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('service-documents').getPublicUrl(fileName)
          slikeUrls.push(urlData.publicUrl)
        } else {
          opozorila.push(tx('ena slika racuna ni bila nalozena', 'one receipt photo was not uploaded'))
        }
      }
      if (slikeUrls.length > 0) {
        const { error: photoUpdateError } = await supabase.from('service_logs').update({ foto_url: slikeUrls.join(',') }).eq('id', servisData.id).eq('car_id', carId)
        if (photoUpdateError) opozorila.push(tx('slike racuna niso bile povezane s servisom', 'receipt photos were not linked to the service'))
      }
      setUploadProgress(false)
    }

    setMessage(tx('✅ Servis uspešno shranjen!', '✅ Service saved successfully!'))
    let odometerUrl: string | null = null
    if (stevec) {
      setUploadProgress(true)
      const fileExt = stevec.name.split('.').pop() || 'jpg'
      const fileName = `${user.id}/${servisData.id}_odometer.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('service-documents').upload(fileName, stevec, { upsert: true })
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('service-documents').getPublicUrl(fileName)
        odometerUrl = urlData.publicUrl
      } else {
        opozorila.push(tx('slika stevca ni bila nalozena', 'odometer photo was not uploaded'))
      }
      setUploadProgress(false)
    }

    const verificationLevel = odometerUrl && slike.length > 0 ? 'strong' : odometerUrl ? 'photo' : 'basic'
    const zaklepPo24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const { error: verificationError } = await supabase.from('service_logs').update({
      odometer_photo_url: odometerUrl,
      verified_document_url: slike.length > 0 ? 'service_receipt_attached' : null,
      verification_level: verificationLevel,
      locked_at: zaklepPo24h,
    }).eq('id', servisData.id).eq('car_id', carId)
    if (verificationError) opozorila.push(tx('potrditev servisa ni bila posodobljena', 'service verification was not updated'))
    trackEvent('service_verification_set', { carId, verificationLevel, hasOdometerPhoto: !!odometerUrl, hasReceipt: slike.length > 0 })

    setMessage(opozorila.length > 0
      ? `${tx('Servis je shranjen, vendar:', 'Service is saved, but:')} ${opozorila.join(', ')}.`
      : tx('✅ Servis uspešno shranjen!', '✅ Service saved successfully!'))
    setTimeout(() => window.location.href = `/zgodovina-servisa?car=${carId}`, 1500)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">

      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
        <BackButton />
        <h1 className="truncate text-xl font-bold text-white">🔧 {tx('Vnos servisa', 'Service entry')}</h1>
        </div>
        <button
          type="button"
          onClick={() => window.location.href = carId ? `/servis?car=${carId}` : '/servis'}
          className="shrink-0 rounded-2xl border border-[#6c63ff55] bg-[#6c63ff18] px-4 py-3 text-sm font-black text-[#c8c4ff] transition-colors hover:border-[#6c63ff] hover:bg-[#6c63ff24]"
        >
          {tx('Ogled servisov', 'View service')}
        </button>
      </div>

      {poslusam && (
        <div className="bg-[#ef444422] border border-[#ef444444] rounded-xl p-3 mb-4 flex items-center gap-3">
          <span className="text-xl animate-pulse">🎤</span>
          <p className="text-[#ef4444] text-sm font-semibold">{tx('Poslusam... govori zdaj', 'Listening... speak now')}</p>
        </div>
      )}

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 flex flex-col gap-4">

        {avti.length > 0 && (
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Avto', 'Car')}</label>
            <select value={carId} onChange={e => menjavaAvta(e.target.value)}
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#f59e0b] transition-colors">
              <option value="">{tx('Izberi vozilo', 'Choose vehicle')}</option>
              {avti.map((a) => <option key={a.id} value={a.id}>{a.znamka} {a.model}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Datum', 'Date')}</label>
          <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
            className={`w-full bg-[#13131f] border rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors ${jeNaknaden ? 'border-[#f59e0b]' : 'border-[#1e1e32] focus:border-[#f59e0b]'}`} />
          {jeNaknaden && (
            <div className="mt-2 p-2 rounded-lg bg-[#f59e0b22] border border-[#f59e0b44]">
              <p className="text-[#f59e0b] text-xs">⚠️ {tx('Naknadno vnesen servis - zabelezen datum vnosa', 'Backdated service entry - entry date recorded')} ({danes})</p>
            </div>
          )}
        </div>

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">
            {tx('Kilometri', 'Mileage')} * <span className="text-[#3a3a5a] normal-case">({tx('zadnji', 'last')}: {carId ? (kmReady ? formatDistance(zadnjiKm, enotaRazdalje) : tx('nalagam...', 'loading...')) : tx('izberi vozilo', 'choose vehicle')})</span>
          </label>
          <div className="flex gap-2">
            <input type="number" value={km} onChange={e => setKm(e.target.value)}
              placeholder={carId ? (kmReady ? `${tx('najmanj', 'at least')} ${formatDistance(zadnjiKm, enotaRazdalje)}` : tx('nalagam zadnje km...', 'loading latest mileage...')) : tx('najprej izberi vozilo', 'choose a vehicle first')}
              className={`flex-1 bg-[#13131f] border rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors ${km && parseInt(km) < zadnjiKm ? 'border-[#f59e0b]' : 'border-[#1e1e32] focus:border-[#f59e0b]'}`} />
            {micButton('km')}
          </div>
          {km && parseInt(km) < zadnjiKm && (
            <div className="mt-2 rounded-lg border border-[#f59e0b66] bg-[#f59e0b14] p-2">
              <p className="text-xs font-semibold text-[#fbbf24]">{tx('Km so nižji od zadnjega stanja. Ob shranjevanju bo to označeno kot naknadni vnos.', 'Mileage is below the latest state. When saved, it will be marked as a later entry.')}</p>
            </div>
          )}
        </div>

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Slika stevca (za Photo/Strong verified)', 'Odometer photo (for Photo/Strong verified)')}</label>
          <label className="block bg-[#13131f] border border-dashed border-[#2a2a40] rounded-xl p-4 text-center cursor-pointer hover:border-[#3ecfcf66] transition-colors">
            <input type="file" accept="image/*" capture="environment" onChange={dodajStevec} className="hidden" />
            {stevecPreview ? (
              <img src={stevecPreview} alt={tx('Stevec kilometrov', 'Odometer')} className="w-full max-h-44 object-contain rounded-lg" />
            ) : (
              <span className="text-[#3ecfcf] font-semibold">{tx('Dodaj/slikaj stevec kilometrov', 'Add/take odometer photo')}</span>
            )}
          </label>
          {stevecPreview && (
            <button type="button" onClick={() => { setStevec(null); setStevecPreview('') }}
              className="mt-2 w-full rounded-xl border border-[#ef444455] px-3 py-2 text-sm font-semibold text-[#ef4444]">
              {tx('Odstrani sliko stevca', 'Remove odometer photo')}
            </button>
          )}
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="flex min-h-[82px] flex-col justify-center rounded-xl border border-[#5a5a8044] bg-[#5a5a8018] p-3 text-center">
              <p className="text-sm font-black text-white">Basic</p>
              <p className="mt-1 text-[11px] leading-snug text-[#9a9ab8]">{tx('Brez slike', 'No photo')}</p>
            </div>
            <div className="flex min-h-[82px] flex-col justify-center rounded-xl border border-[#3ecfcf66] bg-[#3ecfcf18] p-3 text-center">
              <p className="text-sm font-black text-[#3ecfcf]">Photo</p>
              <p className="mt-1 text-[11px] leading-snug text-[#9a9ab8]">{tx('Slika stevca', 'Odometer photo')}</p>
            </div>
            <div className="flex min-h-[82px] flex-col justify-center rounded-xl border border-[#f59e0b66] bg-[#f59e0b18] p-3 text-center">
              <p className="text-sm font-black text-[#f59e0b]">Strong</p>
              <p className="mt-1 text-[11px] leading-snug text-[#9a9ab8]">{tx('Stevec + racun', 'Odometer + receipt')}</p>
            </div>
          </div>
        </div>

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Opis dela', 'Work performed')} *</label>
          <div className="flex gap-2">
            <textarea value={opis} onChange={e => setOpis(e.target.value)}
              placeholder={tx('npr. Menjava olja + filter', 'e.g. Oil and filter change')} rows={3}
              className="flex-1 bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#f59e0b] transition-colors resize-none" />
            {micButton('opis')}
          </div>
        </div>

        <div ref={servisRef} className="relative">
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Ime servisa (po zelji)', 'Service name (optional)')}</label>
          <div className="flex gap-2">
            <input type="text" value={servis}
              onChange={e => handleServisChange(e.target.value)}
              onFocus={() => {
                if (servis.length > 0) {
                  const filtered = servisHistory.filter(s => s.toLowerCase().startsWith(servis.toLowerCase()))
                  setFilteredServis(filtered)
                  setShowSuggestions(filtered.length > 0)
                }
              }}
              placeholder={tx('npr. Volvo Center Ljubljana', 'e.g. Volvo Center Ljubljana')}
              className="flex-1 bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#f59e0b] transition-colors" />
            {micButton('servis')}
          </div>
          {showSuggestions && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a2e] border border-[#2a2a40] rounded-xl overflow-hidden z-10">
              {filteredServis.map((s, i) => (
                <button key={i} onClick={() => { setServis(s); setShowSuggestions(false) }}
                  className="w-full text-left px-4 py-2.5 text-white text-sm hover:bg-[#f59e0b22] transition-colors border-b border-[#2a2a40] last:border-0">
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Cena', 'Price')} ({currencySymbol(valuta)})</label>
          <div className="flex gap-2">
            <input type="number" step="0.01" value={cena} onChange={e => setCena(e.target.value)} placeholder={tx('npr. 320', 'e.g. 320')}
              className="flex-1 bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#f59e0b] transition-colors" />
            {micButton('cena')}
          </div>
        </div>

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">
            {tx('Slike racunov', 'Receipt photos')} <span className="text-[#3a3a5a] normal-case">({tx('najvec 3, max 2MB vsaka', 'maximum 3, max 2MB each')})</span>
          </label>
          {slikePreview.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {slikePreview.map((preview, index) => (
                <div key={index} className="relative rounded-xl overflow-hidden aspect-square">
                  <img src={preview} alt={`${tx('Racun', 'Receipt')} ${index + 1}`} className="w-full h-full object-cover" />
                  <button onClick={() => odstraniSliko(index)}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-500 transition-colors">✕</button>
                </div>
              ))}
            </div>
          )}
          {slike.length < 3 && (
            <label className="flex items-center gap-3 bg-[#13131f] border border-dashed border-[#2a2a40] rounded-xl px-4 py-3 cursor-pointer hover:border-[#f59e0b] transition-colors">
              <span className="text-2xl">📷</span>
              <div>
                <p className="text-[#5a5a80] text-sm font-semibold">{tx('Dodaj sliko racuna', 'Add receipt photo')}</p>
                <p className="text-[#3a3a5a] text-xs">{slike.length}/3 {tx('slik', 'photos')}</p>
              </div>
              <input type="file" accept="image/*" multiple onChange={dodajSliko} className="hidden" />
            </label>
          )}
        </div>


        <div className="bg-[#f59e0b11] border border-[#f59e0b33] rounded-xl p-4 flex flex-col gap-3">
          <div>
            <p className="text-white text-sm font-semibold">{tx('Naslednji servis', 'Next service')}</p>
            <p className="text-[#5a5a80] text-xs mt-0.5">{tx('Ce vneses interval, aplikacija sama ustvari opomnik.', 'If you enter an interval, the app creates a reminder automatically.')}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Cez km', 'After km')}</label>
              <input type="number" value={intervalKm} onChange={e => setIntervalKm(e.target.value)} placeholder="15000"
                className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#f59e0b] transition-colors" />
            </div>
            <div>
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Cez dni', 'After days')}</label>
              <input type="number" value={intervalDni} onChange={e => setIntervalDni(e.target.value)} placeholder="365"
                className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#f59e0b] transition-colors" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[#f59e0b55] bg-[#f59e0b14] p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-white text-sm font-bold">{tx('Preveri kilometre in podatke pred shranjevanjem', 'Check mileage and details before saving')}</p>
              <p className="mt-1 text-[#f8c873] text-xs leading-relaxed">
                {tx('Servisni zapis lahko popravis samo prvih 24 ur. Po tem se Basic, Photo verified in Strong verified zapis zaklene, zato se enkrat preveri datum, kilometre, opis dela, racun in sliko stevca.', 'A service record can only be edited for the first 24 hours. After that, Basic, Photo verified and Strong verified records are locked, so check the date, mileage, work description, receipt and odometer photo once more.')}
              </p>
            </div>
          </div>
        </div>
        {message && (
          <div className={`p-3 rounded-xl text-sm border ${message.includes('✅') ? 'bg-[#16a34a22] border-[#16a34a44] text-[#4ade80]' : 'bg-[#ef444422] border-[#ef444444] text-[#fca5a5]'}`}>
            {message}
          </div>
        )}

        <button onClick={shrani} disabled={loading || uploadProgress}
          className="w-full bg-[#f59e0b] hover:bg-[#d97706] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 mt-2">
          {uploadProgress ? tx('Nalaganje slik...', 'Uploading photos...') : loading ? tx('Shranjevanje...', 'Saving...') : tx('Shrani servis', 'Save service') + ' →'}
        </button>
      </div>

      <HomeButton />
    </div>
  )
}
