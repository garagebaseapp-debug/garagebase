'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'
import { trackEvent } from '@/lib/analytics'
import { compressImageFile, uploadImageProfiles } from '@/lib/image-compress'
import { getStoredLanguage, type Language } from '@/lib/i18n'

export default function VnosServisa() {
  const [datum, setDatum] = useState(new Date().toISOString().split('T')[0])
  const [km, setKm] = useState('')
  const [opis, setOpis] = useState('')
  const [servis, setServis] = useState('')
  const [cena, setCena] = useState('')
  const [carId, setCarId] = useState('')
  const [avti, setAvti] = useState<any[]>([])
  const [zadnjiKm, setZadnjiKm] = useState(0)
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
  const [language, setLanguage] = useState<Language>('sl')
  const servisRef = useRef<HTMLDivElement>(null)

  const danes = new Date().toISOString().split('T')[0]
  const jeNaknaden = datum < danes
  const jeEn = language === 'en'
  const tx = (sl: string, en: string) => jeEn ? en : sl

  useEffect(() => {
    setLanguage(getStoredLanguage())
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const params = new URLSearchParams(window.location.search)
      const carParam = params.get('car')
      const { data } = await supabase.from('cars').select('id, znamka, model, km_trenutni').eq('user_id', user.id)
      if (data && data.length > 0) {
        setAvti(data)
        const izbrani = data.find((a: any) => a.id === carParam) || data[0]
        setCarId(izbrani.id)
        trackEvent('service_add_open', { carId: izbrani.id })
        await Promise.all([
          naloziZadnjiKm(izbrani.id, izbrani.km_trenutni || 0),
          naloziServisHistory(data.map((a: any) => a.id)),
        ])
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

  const naloziZadnjiKm = async (id: string, kmAvta: number) => {
    const [{ data: servisData }, { data: gorivoData }] = await Promise.all([
      supabase.from('service_logs').select('km').eq('car_id', id).order('km', { ascending: false }).limit(1),
      supabase.from('fuel_logs').select('km').eq('car_id', id).order('km', { ascending: false }).limit(1),
    ])
    const maxServis = servisData?.[0]?.km || 0
    const maxGorivo = gorivoData?.[0]?.km || 0
    setZadnjiKm(Math.max(kmAvta, maxServis, maxGorivo))
  }

  const naloziServisHistory = async (carIds: string[]) => {
    if (carIds.length === 0) return
    const { data } = await supabase
      .from('service_logs')
      .select('servis')
      .in('car_id', carIds)
      .not('servis', 'is', null)
      .order('datum', { ascending: false })
      .limit(200)
    if (data) {
      const unikatni = [...new Set(data.map((v: any) => v.servis).filter(Boolean))] as string[]
      setServisHistory(unikatni)
    }
  }

  const menjavaAvta = async (noviId: string) => {
    setCarId(noviId)
    const avto = avti.find((a: any) => a.id === noviId)
    if (avto) await naloziZadnjiKm(noviId, avto.km_trenutni || 0)
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

  const dodajSliko = async (e: any) => {
    const files = Array.from(e.target.files) as File[]
    if (slike.length + files.length > 3) { setMessage('Največ 3 slike na servis!'); return }
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
    } catch (error: any) {
      setMessage(error.message || tx('Slike racuna ni bilo mogoce pripraviti.', 'Receipt photos could not be prepared.'))
    }
  }

  const odstraniSliko = (index: number) => {
    const noveSlike = slike.filter((_, i) => i !== index)
    setSlike(noveSlike)
    setSlikePreview(noveSlike.map((f: File) => URL.createObjectURL(f)))
  }

  const dodajStevec = async (e: any) => {
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
    } catch (error: any) {
      setMessage(error.message || tx('Slike stevca ni bilo mogoce pripraviti.', 'Odometer photo could not be prepared.'))
      return
    }
  }

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

  const MicButton = ({ polje }: { polje: string }) => (
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

    await supabase.from('reminders').insert({
      car_id: carId,
      tip: 'servis',
      datum: datumNaslednji,
      km_opomnik: kmNaslednji,
      opozorilo_dni_prej: 30,
    })
  }
  const shrani = async () => {
    if (!km || !opis) { setMessage(tx('Km in opis sta obvezna!', 'Mileage and work description are required!')); return }
    const vneseniKm = parseInt(km)
    if (vneseniKm < zadnjiKm) {
      setMessage(`⚠️ ${tx('Km ne smejo biti nizji od', 'Mileage cannot be lower than')} ${zadnjiKm.toLocaleString()} km!`)
      return
    }
    setLoading(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/'; return }

    const { data: servisData, error } = await supabase.from('service_logs').insert({
      car_id: carId, datum, km: vneseniKm,
      opis: jeNaknaden ? `${opis} [Naknadno vnešeno: ${danes}]` : opis,
      servis: servis || null,
      cena: cena ? parseFloat(cena) : null,
    }).select().single()

    if (error) { setMessage(tx('Napaka: ', 'Error: ') + error.message); setLoading(false); return }

    await supabase.from('cars').update({ km_trenutni: vneseniKm }).eq('id', carId)
    trackEvent('service_saved', { carId, hasReceipt: slike.length > 0 })
    await ustvariServisniOpomnik(vneseniKm)

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
        }
      }
      if (slikeUrls.length > 0) {
        await supabase.from('service_logs').update({ foto_url: slikeUrls.join(',') }).eq('id', servisData.id)
      }
      setUploadProgress(false)
    }

    setMessage('✅ Servis uspešno shranjen!')
    let odometerUrl: string | null = null
    if (stevec) {
      setUploadProgress(true)
      const fileExt = stevec.name.split('.').pop() || 'jpg'
      const fileName = `${user.id}/${servisData.id}_odometer.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('service-documents').upload(fileName, stevec, { upsert: true })
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('service-documents').getPublicUrl(fileName)
        odometerUrl = urlData.publicUrl
      }
      setUploadProgress(false)
    }

    const verificationLevel = odometerUrl && slike.length > 0 ? 'strong' : odometerUrl ? 'photo' : 'basic'
    const zaklepPo24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('service_logs').update({
      odometer_photo_url: odometerUrl,
      verified_document_url: slike.length > 0 ? 'service_receipt_attached' : null,
      verification_level: verificationLevel,
      locked_at: zaklepPo24h,
    }).eq('id', servisData.id)
    trackEvent('service_verification_set', { carId, verificationLevel, hasOdometerPhoto: !!odometerUrl, hasReceipt: slike.length > 0 })

    setTimeout(() => window.location.href = `/zgodovina-servisa?car=${carId}`, 1500)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">

      <div className="flex items-center gap-3 mb-8">
        <BackButton />
        <h1 className="text-xl font-bold text-white">🔧 {tx('Vnos servisa', 'Service entry')}</h1>
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
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#f59e0b] transition-colors">
              {avti.map((a: any) => <option key={a.id} value={a.id}>{a.znamka} {a.model}</option>)}
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
            {tx('Kilometri', 'Mileage')} * <span className="text-[#3a3a5a] normal-case">({tx('zadnji', 'last')}: {zadnjiKm.toLocaleString()} km)</span>
          </label>
          <div className="flex gap-2">
            <input type="number" value={km} onChange={e => setKm(e.target.value)}
              placeholder={`${tx('najmanj', 'at least')} ${zadnjiKm.toLocaleString()}`}
              className={`flex-1 bg-[#13131f] border rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors ${km && parseInt(km) < zadnjiKm ? 'border-[#ef4444]' : 'border-[#1e1e32] focus:border-[#f59e0b]'}`} />
            <MicButton polje="km" />
          </div>
          {km && parseInt(km) < zadnjiKm && (
            <div className="mt-2 p-2 rounded-lg bg-[#ef444422] border border-[#ef444444]">
              <p className="text-[#ef4444] text-xs">⛔ {tx('Km ne smejo biti nizji od', 'Mileage cannot be lower than')} {zadnjiKm.toLocaleString()} km!</p>
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
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-[#5a5a8044] bg-[#5a5a8018] p-2 text-center">
              <p className="text-[11px] font-black text-white">Basic</p>
              <p className="mt-1 text-[9px] leading-tight text-[#9a9ab8]">{tx('Brez slike', 'No photo')}</p>
            </div>
            <div className="rounded-xl border border-[#3ecfcf66] bg-[#3ecfcf18] p-2 text-center">
              <p className="text-[11px] font-black text-[#3ecfcf]">Photo</p>
              <p className="mt-1 text-[9px] leading-tight text-[#9a9ab8]">{tx('Slika stevca', 'Odometer photo')}</p>
            </div>
            <div className="rounded-xl border border-[#f59e0b66] bg-[#f59e0b18] p-2 text-center">
              <p className="text-[11px] font-black text-[#f59e0b]">Strong</p>
              <p className="mt-1 text-[9px] leading-tight text-[#9a9ab8]">{tx('Stevec + racun', 'Odometer + receipt')}</p>
            </div>
          </div>
        </div>

        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Opis dela', 'Work performed')} *</label>
          <div className="flex gap-2">
            <textarea value={opis} onChange={e => setOpis(e.target.value)}
              placeholder={tx('npr. Menjava olja + filter', 'e.g. Oil and filter change')} rows={3}
              className="flex-1 bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#f59e0b] transition-colors resize-none" />
            <MicButton polje="opis" />
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
            <MicButton polje="servis" />
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
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Cena', 'Price')} (€)</label>
          <div className="flex gap-2">
            <input type="number" step="0.01" value={cena} onChange={e => setCena(e.target.value)} placeholder={tx('npr. 320', 'e.g. 320')}
              className="flex-1 bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#f59e0b] transition-colors" />
            <MicButton polje="cena" />
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
