'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton, HomeButton } from '@/lib/nav'
import { trackEvent } from '@/lib/analytics'
import { compressImageFile, imageCompressionErrorText, uploadImageProfiles } from '@/lib/image-compress'
import { isReceiptImageOcrSupported, parseReceiptText, readReceiptTextFromImage } from '@/lib/receipt-ocr'
import { useLanguage } from '@/lib/i18n'
import { currencySymbol as formatCurrencySymbol } from '@/lib/currency'
import { formatDistance, getDistanceUnitFromSettings, type DistanceUnit } from '@/lib/units'
import { clearVehicleDataCaches, readGarageCache } from '@/lib/vehicle-cache'
import { checkCurrentUserAdmin } from '@/lib/admin-access'

type FuelType = {
  value: string
  title: string
  label: string
  color: string
  border: string
  text: string
  activeBg: string
}

const optionalFuelInsertColumns = new Set([
  'polni_rezervar',
  'receipt_url',
  'verified_document_url',
  'verification_level',
])
const KM_ANOMALY_THRESHOLD = 2000

const getMissingSchemaColumn = (error: any) => {
  const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`
  if (
    !text.toLowerCase().includes('could not find') &&
    !text.toLowerCase().includes('schema cache') &&
    error?.code !== 'PGRST204' &&
    error?.code !== '42703'
  ) return null

  const match = text.match(/'([^']+)' column of '([^']+)'/)
  if (match?.[1]) return match[1]

  return Array.from(optionalFuelInsertColumns).find(column => text.includes(column)) || null
}

const stripColumns = (row: Record<string, unknown>, columns: Set<string>) =>
  Object.fromEntries(Object.entries(row).filter(([key]) => !columns.has(key)))

export default function VnosGoriva() {
  const { language } = useLanguage()
  const jeEn = language === 'en'
  const tx = (sl: string, en: string) => (jeEn ? en : sl)

  const [datum, setDatum] = useState(new Date().toISOString().split('T')[0])
  const [km, setKm] = useState('')
  const [litri, setLitri] = useState('')
  const [polniRezervar, setPolniRezervar] = useState<boolean | null>(true)
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
  const [adminCheckDone, setAdminCheckDone] = useState(false)
  const [valuta, setValuta] = useState<'EUR' | 'USD'>('EUR')
  const [enotaRazdalje, setEnotaRazdalje] = useState<DistanceUnit>('km')
  const [nacin, setNacin] = useState<'lite' | 'full'>('full')
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

      const adminCheck = await checkCurrentUserAdmin()
      setOcrAllowed(adminCheck.isAdmin)
      setAdminCheckDone(true)

      try {
        const settings = JSON.parse(localStorage.getItem('garagebase_nastavitve') || '{}')
        setValuta(settings.valuta === 'USD' ? 'USD' : 'EUR')
        setEnotaRazdalje(settings.enotaRazdalje === 'mi' ? 'mi' : 'km')
        setNacin(settings.nacin === 'lite' ? 'lite' : 'full')
      } catch {
        setValuta('EUR')
        setEnotaRazdalje(getDistanceUnitFromSettings())
        setNacin('full')
      }
      const cachedCars = readGarageCache()?.avti?.filter((car: any) => car?.arhivirano !== true) || []
      if (cachedCars.length > 0) setAvti(cachedCars)

      const params = new URLSearchParams(window.location.search)
      const carParam = params.get('car')
      const activeCarsResult = await supabase
        .from('cars').select('id, znamka, model, km_trenutni, gorivo, arhivirano')
        .eq('user_id', user.id)
        .or('arhivirano.is.null,arhivirano.eq.false')
      let data: any[] = activeCarsResult.data || []
      if (activeCarsResult.error || data.length === 0) {
        if (activeCarsResult.error) console.warn('[GarageBase fuel entry] active cars query failed', activeCarsResult.error)
        const fallback = await supabase.from('cars').select('id, znamka, model, km_trenutni, gorivo, arhivirano').eq('user_id', user.id)
        if (fallback.error) console.warn('[GarageBase fuel entry] fallback cars query failed', fallback.error)
        data = fallback.data || []
      }
      data = (data || []).filter((car: any) => car?.arhivirano !== true)
      if (!data || data.length === 0) return

      setAvti(data)
      const cachedPreferredId = cachedCars.find((car: any) => data.some((item: any) => item.id === car.id))?.id
      const izbrani = (carParam ? data.find((a: any) => a.id === carParam) : null) ||
        (cachedPreferredId ? data.find((a: any) => a.id === cachedPreferredId) : null) ||
        data[0]
      await naloziPostaje(data.map((a: any) => a.id))
      if (izbrani) {
        setCarId(izbrani.id)
        setKmReady(false)
        await naloziZadnjiKm(izbrani.id, izbrani.km_trenutni || 0)
        if (izbrani.gorivo === 'Diesel') setTipGoriva('diesel')
        else if (izbrani.gorivo === 'Bencin') setTipGoriva('95')
        trackEvent('fuel_add_open', { carId: izbrani.id })
      } else {
        setCarId('')
        setKmReady(false)
        setZadnjiKm(0)
        trackEvent('fuel_add_open', { carId: null })
      }
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
    setKmReady(false)
    const avto = avti.find((a: any) => a.id === noviId)
    if (!avto) {
      setZadnjiKm(0)
      return
    }
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
      🎤
    </button>
  )

  const preberiRacunIzDatoteke = async (file: File) => {
    if (!ocrAllowed) {
      setOcrMessage(tx(
        'Slika racuna je dodana. Avtomatsko branje je trenutno odklenjeno samo adminu za testiranje. Javni zagon je planiran v letu 2027.',
        'Receipt photo is added. Automatic reading is currently unlocked only for admin testing. Public launch is planned for 2027.'
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
      const unsupported = error?.code === 'TEXT_DETECTOR_UNSUPPORTED' || error?.message === 'TEXT_DETECTOR_UNSUPPORTED'
      setOcrMessage(unsupported
        ? tx(
            'Ta brskalnik trenutno ne podpira branja teksta iz slike. Za admin test prilepi tekst racuna v rocno polje spodaj; javni AI scan ostane zaklenjen do 2027.',
            'This browser does not currently support text detection from images. For admin testing, paste the receipt text into the manual field below; public AI scan remains locked until 2027.'
          )
        : `${error.message} ${tx('Lahko prilepis tekst racuna spodaj in kliknes "Uporabi tekst".', 'You can paste the receipt text below and click "Use text".')}`)
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
      setMessage(imageCompressionErrorText(error, language))
      return
    }
    setOcrText('')
    setOcrMessage(ocrAllowed
      ? isReceiptImageOcrSupported()
        ? tx(
            'Slika je pripravljena. Klikni "Preberi racun" za admin OCR test ali po potrebi vnesi tekst rocno.',
            'Photo is ready. Click "Read receipt" for the admin OCR test or enter the text manually if needed.'
          )
        : tx(
            'Slika je shranjena kot dokazilo. Ta brskalnik trenutno ne podpira OCR iz slike; za admin test prilepi tekst racuna rocno.',
            'Photo is saved as proof. This browser does not currently support image OCR; paste the receipt text manually for admin testing.'
          )
      : tx(
          'Slika racuna bo shranjena kot dokazilo. AI branje racunov bo javno odklenjeno v letu 2027.',
          'The receipt photo will be saved as proof. AI receipt reading will be publicly unlocked in 2027.'
        ))
  }

  useEffect(() => {
    if (!ocrAllowed) return
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
    const found: string[] = []
    if (result.date) setDatum(result.date)
    if (result.date) found.push(tx('datum', 'date'))
    if (result.liters) { setLitri(result.liters); found.push(tx('litri', 'liters')) }
    if (result.pricePerLiter) { setCenaNaLiter(result.pricePerLiter); found.push(tx('cena na liter', 'price per liter')) }
    if (result.station) { setPostaja(result.station); found.push(tx('postaja', 'station')) }
    if (result.fuelType) { setTipGoriva(result.fuelType); found.push(tx('tip goriva', 'fuel type')) }
    setOcrMessage(found.length > 0
      ? `${tx('Prebrano', 'Read')}: ${found.join(', ')}. ${tx('Kilometrov na racunu ponavadi ni, zato jih vnesi rocno. Pred shranjevanjem vse se enkrat preveri.', 'Fuel receipts usually do not contain mileage, so enter it manually. Check everything once more before saving.')}`
      : tx('Iz slike nisem prepoznal uporabnih podatkov. Poskusi svetlejso sliko ali prilepi tekst racuna spodaj.', 'I could not recognize usable data from the image. Try a brighter photo or paste the receipt text below.'))
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
        racun
          ? 'Slika racuna je dodana. Avtomatsko branje je trenutno odklenjeno samo adminu za testiranje. Rocni vnos in shranjevanje slike delujeta normalno.'
          : 'Najprej dodaj sliko racuna. Avtomatsko branje je trenutno odklenjeno samo adminu za testiranje.',
        racun
          ? 'Receipt photo is added. Automatic reading is currently unlocked only for admin testing. Manual entry and photo storage work normally.'
          : 'First add a receipt photo. Automatic reading is currently unlocked only for admin testing.'
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
    if (!racun || !ocrAllowed) return null
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const ext = racun.name.split('.').pop() || 'jpg'
    const path = `${user.id}/fuel_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('service-documents').upload(path, racun, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('service-documents').getPublicUrl(path)
    return data.publicUrl
  }

  const selectedCar = avti.find((a: any) => a.id === carId)

  const shrani = async () => {
    if (!carId) {
      setMessage(tx('Najprej izberi vozilo.', 'Choose a vehicle first.'))
      return
    }
    if (!kmReady) {
      setMessage(tx('Počakaj, da se naložijo zadnji kilometri vozila.', 'Wait until the latest vehicle mileage is loaded.'))
      return
    }
    if (!km || !litri) {
      setMessage(tx('Km in litri sta obvezna!', 'Mileage and liters are required!'))
      return
    }
    if (polniRezervar === null) {
      setMessage(tx(
        'Izberi nacin tankanja: Poln rezervar ali Delno tankovanje.',
        'Choose fill-up type: Full tank or Partial fill-up.'
      ))
      return
    }

    const vneseniKm = parseInt(km)
    const sveziKm = await sveziMinimalniKm(carId)
    if (vneseniKm < sveziKm) {
      setZadnjiKm(sveziKm)
      setMessage(`${tx('Km ne smejo biti nižji od', 'Mileage cannot be lower than')} ${formatDistance(sveziKm, enotaRazdalje)}!`)
      return
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
    if (!user) {
      window.location.href = '/'
      return
    }

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

    const fuelPayload = {
      car_id: carId,
      datum,
      km: vneseniKm,
      litri: parseFloat(litri),
      cena_na_liter: cenaNaLiter ? parseFloat(cenaNaLiter) : null,
      cena_skupaj: cenaSkupaj ? parseFloat(cenaSkupaj) : null,
      polni_rezervar: polniRezervar,
      postaja: postajaZOpombo,
      tip_goriva: tipGoriva || null,
      receipt_url: receiptUrl,
      verified_document_url: receiptUrl,
      verification_level: 'basic',
    }

    let payloadForInsert: Record<string, unknown> = fuelPayload
    let insertResult = await supabase.from('fuel_logs').insert(payloadForInsert).select('id,car_id,km,datum').single()
    let error = insertResult.error
    const removedColumns = new Set<string>()

    while (error) {
      const missingColumn = getMissingSchemaColumn(error)
      if (!missingColumn || !optionalFuelInsertColumns.has(missingColumn) || removedColumns.has(missingColumn)) break

      removedColumns.add(missingColumn)
      payloadForInsert = stripColumns(fuelPayload, removedColumns)
      insertResult = await supabase.from('fuel_logs').insert(payloadForInsert).select('id,car_id,km,datum').single()
      error = insertResult.error
    }

    if (error) {
      setMessage(tx('Napaka: ', 'Error: ') + error.message)
      setLoading(false)
      return
    }
    if (!insertResult.data?.id) {
      setMessage(tx(
        'Tankanje ni bilo potrjeno v bazi. Osvezi stran in poskusi znova.',
        'The fill-up was not confirmed in the database. Refresh the page and try again.'
      ))
      setLoading(false)
      return
    }

    const { data: confirmedFuel, error: confirmError } = await supabase
      .from('fuel_logs')
      .select('id,car_id,km,datum')
      .eq('id', insertResult.data.id)
      .eq('car_id', carId)
      .maybeSingle()

    if (confirmError || !confirmedFuel?.id) {
      setMessage(tx(
        'Tankanje je bilo poslano, vendar ga aplikacija ni mogla potrditi. Preveri zgodovino goriva pred ponovnim vnosom.',
        'The fill-up was sent, but the app could not confirm it. Check fuel history before entering it again.'
      ))
      setLoading(false)
      return
    }

    const { error: carUpdateError } = await supabase
      .from('cars')
      .update({ km_trenutni: Math.max(sveziKm, vneseniKm) })
      .eq('id', carId)
      .eq('user_id', user.id)

    if (carUpdateError) {
      setMessage(tx(
        'Tankanje je shranjeno, kilometrov vozila pa ni bilo mogoče posodobiti. Preveri vozilo v garaži.',
        'The fill-up was saved, but vehicle mileage could not be updated. Check the vehicle in the garage.'
      ))
      clearVehicleDataCaches(carId)
      setLoading(false)
      return
    }

    clearVehicleDataCaches(carId)
    trackEvent('fuel_saved', { carId, hasReceipt: !!receiptUrl, verificationLevel: 'basic' })
    setMessage(tx('Tankanje uspesno shranjeno!', 'Fill-up saved successfully!'))
    setTimeout(() => {
      window.location.href = `/zgodovina-goriva?car=${carId}`
    }, 1000)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24 xl:pl-[280px] xl:pr-8">
      <div className="w-full xl:mx-auto xl:max-w-5xl">
      <div className="flex items-center gap-3 mb-8">
        <BackButton />
        <div>
          <p className="hidden text-sm font-black text-[#6c63ff] xl:block">GarageBase</p>
          <h1 className="text-xl font-bold text-white xl:text-4xl">⛽ {tx('Vnos goriva', 'Fuel entry')}</h1>
          <p className="mt-1 hidden text-sm font-semibold text-[#8a8aa8] xl:block">{tx('Vnesi točenje, kilometre in račun na enem preglednem mestu.', 'Enter fill-up, mileage and receipt in one clear place.')}</p>
        </div>
      </div>

      {poslusam && (
        <div className="bg-[#ef444422] border border-[#ef444444] rounded-xl p-3 mb-4 flex items-center gap-3">
          <span className="text-xl animate-pulse">🎤</span>
          <p className="text-[#ef4444] text-sm font-semibold">{tx('Poslusam... govori zdaj', 'Listening... speak now')}</p>
        </div>
      )}

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 flex flex-col gap-4 shadow-xl shadow-black/10 xl:rounded-[28px] xl:p-8">
        {nacin === 'lite' && selectedCar && (
          <div className="rounded-2xl border border-[#3ecfcf66] bg-[#3ecfcf14] px-4 py-3">
            <p className="text-[#3ecfcf] text-xs font-black uppercase tracking-wide">{tx('Izbrano vozilo', 'Selected vehicle')}</p>
            <p className="mt-1 text-white text-lg font-black">{selectedCar.znamka} {selectedCar.model}</p>
          </div>
        )}

        {avti.length > 0 && (nacin !== 'lite' || !selectedCar) && (
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Avto', 'Car')}</label>
            <select
              value={carId}
              onChange={(event) => menjavaAvta(event.target.value)}
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#3ecfcf] transition-colors"
            >
              <option value="">{tx('Izberi vozilo', 'Choose vehicle')}</option>
              {avti.map((a: any) => <option key={a.id} value={a.id}>{a.znamka} {a.model}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3 block">{tx('Tip goriva', 'Fuel type')}</label>
          <div className="grid grid-cols-3 gap-3 xl:gap-4">
            {tipiGoriva.map((tip) => (
              <button
                key={tip.value}
                type="button"
                onClick={() => setTipGoriva(tipGoriva === tip.value ? '' : tip.value)}
                className={`relative py-4 rounded-xl border-2 transition-all flex flex-col items-center gap-1 xl:py-6 ${
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
            {tx('Kilometri', 'Mileage')} * <span className="text-[#3a3a5a] normal-case">({tx('zadnji', 'last')}: {carId ? (kmReady ? formatDistance(zadnjiKm, enotaRazdalje) : tx('nalagam...', 'loading...')) : tx('izberi vozilo', 'choose vehicle')})</span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={km}
              onChange={(event) => setKm(event.target.value)}
              placeholder={carId ? (kmReady ? `${tx('najmanj', 'at least')} ${formatDistance(zadnjiKm, enotaRazdalje)}` : tx('nalagam zadnje km...', 'loading latest mileage...')) : tx('najprej izberi vozilo', 'choose a vehicle first')}
              className={`flex-1 bg-[#13131f] border rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors ${
                km && parseInt(km) < zadnjiKm ? 'border-[#ef4444]' : 'border-[#1e1e32] focus:border-[#3ecfcf]'
              }`}
            />
            <MicButton polje="km" />
          </div>
          {km && parseInt(km) < zadnjiKm && (
            <div className="mt-2 p-2 rounded-lg bg-[#ef444422] border border-[#ef444444]">
              <p className="text-[#ef4444] text-xs">{tx('Km ne smejo biti nizji od', 'Mileage cannot be lower than')} {formatDistance(zadnjiKm, enotaRazdalje)}!</p>
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
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Nacin tankanja', 'Fill-up type')} *</label>
          <div className={`grid grid-cols-2 gap-2 rounded-2xl ${message.includes('Izberi nacin') || message.includes('Choose fill-up type') ? 'ring-4 ring-[#ef444455]' : ''}`}>
            <button
              type="button"
              onClick={() => setPolniRezervar(true)}
              className={`flex items-center justify-between px-4 py-4 rounded-xl border text-left transition-colors ${
                polniRezervar === true
                  ? 'bg-[#3ecfcf22] border-[#3ecfcf] text-[#3ecfcf] shadow-[0_0_0_2px_rgba(62,207,207,0.18)]'
                  : 'bg-[#13131f] border-[#1e1e32] text-[#7b7ba6]'
              }`}
              aria-pressed={polniRezervar === true}
            >
              <span className="font-black">{tx('Poln rezervar', 'Full tank')}</span>
              <span className="text-xl">⛽</span>
            </button>
            <button
              type="button"
              onClick={() => setPolniRezervar(false)}
              className={`flex items-center justify-between px-4 py-4 rounded-xl border text-left transition-colors ${
                polniRezervar === false
                  ? 'bg-[#64748b22] border-[#94a3b8] text-[#cbd5e1] shadow-[0_0_0_2px_rgba(148,163,184,0.18)]'
                  : 'bg-[#13131f] border-[#1e1e32] text-[#7b7ba6]'
              }`}
              aria-pressed={polniRezervar === false}
            >
              <span className="font-black">{tx('Delno tankovanje', 'Partial fill-up')}</span>
              <span className="text-xl">◐</span>
            </button>
          </div>
          <p className="mt-2 text-xs text-[#7b7ba6]">
            {tx('Privzeto je nastavljen poln rezervar. Spremeni na delno samo, ce nisi tankal do polnega.', 'Full tank is selected by default. Switch to partial only if you did not fill up completely.')}
          </p>
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

        {ocrAllowed && (
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Racun', 'Receipt')}</label>
          <input ref={receiptInputRef} type="file" accept="image/*" capture="environment" onChange={dodajRacun} className="hidden" />
          {!racunPreview ? (
            <button
              type="button"
              onClick={() => receiptInputRef.current?.click()}
              disabled={ocrLoading || !adminCheckDone}
              className={`w-full rounded-xl border px-4 py-4 text-center font-bold transition-colors disabled:opacity-60 ${
                ocrAllowed
                  ? 'bg-[#3ecfcf18] border-[#3ecfcf66] text-[#3ecfcf] hover:bg-[#3ecfcf28]'
                  : 'bg-[#f59e0b14] border-[#f59e0b55] text-[#f59e0b]'
              }`}
            >
              {ocrLoading
                ? tx('Berem racun...', 'Reading receipt...')
                : adminCheckDone
                  ? tx('Slikaj racun (admin)', 'Take receipt photo (admin)')
                  : tx('Preverjam dostop...', 'Checking access...')}
            </button>
          ) : (
            <div className="rounded-xl border border-[#1e1e32] bg-[#13131f] p-3">
              <img src={racunPreview} alt={tx('Racun', 'Receipt')} className="w-full max-h-56 object-contain rounded-lg" />
              <div className="mt-3 grid grid-cols-2 gap-2">
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
                      ? tx('Preberi racun', 'Read receipt')
                      : tx('AI scan prihaja v 2027', 'AI scan coming in 2027')}
                </button>
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
              </div>
            </div>
          )}

          {ocrAllowed && racunPreview && (
            <details className="mt-3 rounded-xl border border-[#6c63ff55] bg-[#6c63ff14] p-3">
              <summary className="cursor-pointer text-sm font-bold text-[#a09aff]">{tx('Rocni tekst racuna', 'Manual receipt text')}</summary>
              <textarea
                value={ocrText}
                onChange={(event) => setOcrText(event.target.value)}
                placeholder={tx(
                  'Ce avtomatsko branje ne najde podatkov, prilepi tekst racuna sem...',
                  'If automatic reading does not find the data, paste the receipt text here...'
                )}
                rows={3}
                className="mt-3 w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-[#3ecfcf] transition-colors resize-none"
              />
              <button
                type="button"
                onClick={() => uporabiPrebranTekst(ocrText)}
                className="mt-2 w-full rounded-xl border border-[#3ecfcf55] bg-[#3ecfcf18] px-3 py-2 text-sm font-semibold text-[#3ecfcf]"
              >
                {tx('Uporabi tekst', 'Use text')}
              </button>
            </details>
          )}

          {ocrMessage && (
            <div className="mt-3 rounded-xl border border-[#6c63ff55] bg-[#6c63ff14] p-3">
              <p className="text-[#a09aff] text-xs leading-relaxed">{ocrMessage}</p>
            </div>
          )}
        </div>
        )}

        {message && (
          <div className={`p-3 rounded-xl text-sm border ${
            message.includes('uspesno') || message.includes('successfully') ? 'bg-[#16a34a22] border-[#16a34a44] text-[#4ade80]' : 'bg-[#ef444422] border-[#ef444444] text-[#fca5a5]'
          }`}>
            {message}
          </div>
        )}

        <div className="rounded-xl border border-[#f59e0b44] bg-[#f59e0b12] p-3">
          <p className="text-[#fbbf24] text-xs leading-relaxed">
            {tx('Pozor: po shranjevanju je ročno tankanje mogoče urejati samo 24 ur. Potem se vnos zaklene zaradi sledljivosti zgodovine.', 'Note: after saving, a manual fill-up can be edited for 24 hours only. After that it is locked to keep the history traceable.')}
          </p>
        </div>

        <button
          onClick={shrani}
          disabled={loading}
          className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 mt-2"
        >
          {loading ? tx('Shranjevanje...', 'Saving...') : `${tx('Shrani tankanje', 'Save fill-up')} ->`}
        </button>
      </div>

      </div>
      <HomeButton />
    </div>
  )
}

