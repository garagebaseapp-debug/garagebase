'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BottomNav, BackButton } from '@/lib/nav'
import { getStoredLanguage } from '@/lib/i18n'

type CarInsertPayload = {
  user_id: string
  tip_vozila: string
  oblika: string | null
  znamka: string
  model: string
  letnik: number | null
  gorivo: string
  rezervar_litri?: number | null
  barva: string | null
  tablica: string | null
  vin: string | null
  km_trenutni: number | null
  km_ob_vnosu: number | null
  kubikaza: number | null
  kw: number | null
  menjalnik: string | null
  pogon: string | null
}

export default function DodajAvto() {
  const [tipVozila, setTipVozila] = useState('avto')
  const [tipVozilaCustom, setTipVozilaCustom] = useState('')
  const [oblika, setOblika] = useState('')
  const [znamka, setZnamka] = useState('')
  const [model, setModel] = useState('')
  const [letnik, setLetnik] = useState('')
  const [gorivo, setGorivo] = useState('Bencin')
  const [rezervarLitri, setRezervarLitri] = useState('')
  const [barva, setBarva] = useState('')
  const [tablica, setTabla] = useState('')
  const [vin, setVin] = useState('')
  const [km, setKm] = useState('')
  const [kubikaza, setKubikaza] = useState('')
  const [kw, setKw] = useState('')
  const [menjalnik, setMenjalnik] = useState('')
  const [pogon, setPogon] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [korak, setKorak] = useState(1)
  const [language] = useState<'sl' | 'en'>(() => getStoredLanguage() === 'en' ? 'en' : 'sl')
  const [registryEnabled, setRegistryEnabled] = useState(false)
  const [registryUnderstand, setRegistryUnderstand] = useState(false)
  const [registrySkipConfirmed, setRegistrySkipConfirmed] = useState(false)
  const [registryVisibility, setRegistryVisibility] = useState({
    showPlate: false,
    showMileage: true,
    showServiceSummary: true,
    showCostSummary: false,
    showDocuments: false,
  })
  const tx = (sl: string, en: string) => language === 'en' ? en : sl

  const tipiVozil = [
    { vrednost: 'avto', ikona: '🚗', naziv: 'Avto' },
    { vrednost: 'motor', ikona: '🏍️', naziv: 'Motor' },
    { vrednost: 'kombi', ikona: '🚐', naziv: 'Kombi' },
    { vrednost: 'tovornjak', ikona: '🚛', naziv: 'Tovornjak' },
    { vrednost: 'plovilo', ikona: '⛵', naziv: 'Plovilo' },
    { vrednost: 'drugo', ikona: '⚙️', naziv: 'Drugo' },
  ]

  const oblikeAvta: { [key: string]: string[] } = {
    avto: ['Sedan', 'Karavan', 'SUV', 'Kabriolet', 'Kupe', 'Hatchback', 'Crossover', 'Pickup'],
    kombi: ['Van', 'Minivan', 'Minibus', 'Bus'],
    tovornjak: ['Poltovornjak', 'Tovornjak', 'Vlačilec', 'Prikolica'],
    motor: ['Naked', 'Sport', 'Touring', 'Enduro', 'Scooter', 'Chopper'],
    plovilo: ['Čoln', 'Jahta', 'Jadrnica', 'Gumenjak'],
    drugo: ['Traktor', 'Quad', 'ATV', 'Skuter', 'Drugo'],
  }

  const decimalValue = (value: string) => {
    const parsed = Number(String(value || '').replace(',', '.'))
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }

  const isMissingReservoirColumn = (error: unknown) => {
    const message = String(typeof error === 'object' && error && 'message' in error ? error.message : '')
    return message.includes('rezervar_litri') || message.includes('tank_capacity')
  }
  const normalizedVin = () => String(vin || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const hasLookupVin = () => normalizedVin().length >= 6
  const setRegistryOption = (key: keyof typeof registryVisibility, value: boolean) => {
    setRegistryVisibility((current) => ({ ...current, [key]: value }))
  }

  const shrani = async () => {
    if (!znamka || !model) { setMessage(tx('Znamka in model sta obvezna!', 'Make and model are required!')); return }
    if (tipVozila === 'drugo' && !tipVozilaCustom) { setMessage(tx('Vnesi tip vozila!', 'Enter the vehicle type!')); return }
    if (!km.trim()) {
      const ok = window.confirm(tx(
        'Brez trenutnih kilometrov bo PDF/QR poročilo manj verodostojno, ker ni jasno, pri katerem stanju števca se evidenca začne. Vozilo lahko vseeno shraniš, trenutne kilometre pa priporočamo za bolj zanesljivo zgodovino.',
        'Without current mileage, the PDF/QR report will be less credible because it is not clear at which odometer reading the history starts. You can still save the vehicle, but current mileage is recommended for a more reliable history.'
      ))
      if (!ok) return
    } else {
      const ok = window.confirm(tx(
        'Vpiši trenutne kilometre, ki jih ima vozilo danes. Stare servise, tankanja in stroške lahko vneseš naknadno, km ob nakupu pa nastaviš v lastništvu vozila. Po shranjevanju lahko trenutne km popraviš še 24 ur.',
        'Enter the current mileage the vehicle has today. Older services, fuel entries and costs can be entered later, and purchase mileage can be set in vehicle ownership. After saving, you can still correct current mileage for 24 hours.'
      ))
      if (!ok) return
    }
    setLoading(true)
    setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/'; return }
    const activeCountResult = await supabase
      .from('cars')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('arhivirano', false)

    let vehicleCount = activeCountResult.count || 0
    if (activeCountResult.error) {
      const fallbackCountResult = await supabase
        .from('cars')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
      if (fallbackCountResult.error) {
        setMessage(tx('Napaka pri preverjanju stevila vozil: ', 'Could not check vehicle limit: ') + fallbackCountResult.error.message)
        setLoading(false)
        return
      }
      vehicleCount = fallbackCountResult.count || 0
    }

    if (vehicleCount >= 10) {
      setMessage(tx('Dosezen je limit 10 vozil. Arhiviraj ali izbriši vozilo, da lahko dodaš novo.', 'The 10 vehicle limit has been reached. Archive or delete a vehicle before adding a new one.'))
      setLoading(false)
      return
    }
    const finalniTip = tipVozila === 'drugo' ? tipVozilaCustom : tipVozila
    const payload: CarInsertPayload = {
      user_id: user.id,
      tip_vozila: finalniTip,
      oblika: oblika || null,
      znamka, model,
      letnik: letnik ? parseInt(letnik) : null,
      gorivo,
      rezervar_litri: decimalValue(rezervarLitri),
      barva: barva || null,
      tablica: tablica || null,
      vin: vin || null,
      km_trenutni: km ? parseInt(km) : null,
      km_ob_vnosu: km ? parseInt(km) : null,
      kubikaza: kubikaza ? parseInt(kubikaza) : null,
      kw: kw ? parseInt(kw) : null,
      menjalnik: menjalnik || null,
      pogon: pogon || null,
    }
    if (registryEnabled && !hasLookupVin()) {
      setMessage(tx('Za preverjanje vozila najprej vnesi VIN/številko šasije.', 'Enter the VIN/chassis number before enabling vehicle lookup.'))
      setLoading(false)
      return
    }
    if (registryEnabled && !registryUnderstand) {
      setMessage(tx('Najprej potrdi, da razumeš, kaj bo vidno pri preverjanju vozila.', 'Confirm that you understand what will be visible in vehicle lookup.'))
      setLoading(false)
      return
    }
    if (!registryEnabled && hasLookupVin() && !registrySkipConfirmed) {
      const ok = window.confirm(tx(
        'Ali ste prepričani, da ne želite deliti preverjanja tega vozila? Brez privolitve drugi lastnik ali kupec vozila ne bo mogel preveriti zgodovine v GarageBase bazi.',
        'Are you sure you do not want to share lookup for this vehicle? Without consent, another owner or buyer will not be able to verify its GarageBase history.',
      ))
      if (!ok) {
        setRegistryEnabled(true)
        setLoading(false)
        return
      }
      setRegistrySkipConfirmed(true)
    }
    let insertResult = await supabase.from('cars').insert(payload).select('id').single()
    let error = insertResult.error
    let reservoirFallback = false
    if (error && isMissingReservoirColumn(error)) {
      delete payload.rezervar_litri
      const retry = await supabase.from('cars').insert(payload).select('id').single()
      insertResult = retry
      error = retry.error
      reservoirFallback = !retry.error
    }
    if (error) setMessage(tx('Napaka: ', 'Error: ') + error.message)
    else {
      if (registryEnabled && insertResult.data?.id) {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        if (token) {
          const consentResponse = await fetch('/api/vehicle-registry/consent', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              carId: insertResult.data.id,
              vin,
              enabled: true,
              understood: registryUnderstand,
              visibility: registryVisibility,
            }),
          })
          if (!consentResponse.ok) {
            setMessage(tx('Vozilo je shranjeno, preverjanje v bazi pa ni bilo vklopljeno. Odpri nastavitve vozila in poskusi znova.', 'Vehicle is saved, but database lookup was not enabled. Open vehicle settings and try again.'))
            setLoading(false)
            return
          }
        }
      }
      setMessage(reservoirFallback
        ? tx('Vozilo shranjeno. Za izračun dosega kasneje zaženi SQL za rezervoar.', 'Vehicle saved. Run the tank-capacity SQL later to enable range calculation.')
        : tx('Vozilo uspesno shranjeno!', 'Vehicle saved successfully!'))
      if (!km.trim()) {
        setMessage(prev => prev + ' ' + tx('Opomba: brez kilometrov PDF/QR porocilo ne bo popolnoma verodostojno.', 'Note: without mileage the PDF/QR report will not be fully credible.'))
      }
      setTimeout(() => window.location.href = '/garaza', 1000)
    }
    setLoading(false)
  }

  const naprej = () => {
    if (korak === 1 && tipVozila === 'drugo' && !tipVozilaCustom.trim()) {
      setMessage(tx('Najprej vnesi tip vozila.', 'Enter the vehicle type first.'))
      return
    }
    if (korak === 2 && (!znamka.trim() || !model.trim())) {
      setMessage(tx('Znamka in model sta nujna podatka.', 'Make and model are required.'))
      return
    }
    setMessage('')
    setKorak(Math.min(3, korak + 1))
  }

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24 xl:pl-[280px]">
      <div className="mx-auto w-full max-w-5xl">
      <div className="flex items-center gap-3 mb-8">
        <BackButton href="/garaza" />
        <div>
          <h1 className="text-xl font-bold text-white">{tx('Dodaj vozilo', 'Add vehicle')}</h1>
          <p className="text-[#5a5a80] text-xs">
            {tx('Korak', 'Step')} {korak}/3 · {tx('najprej nujni podatki, nato opcijski.', 'required details first, optional details after.')}
          </p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2">
        {[tx('Tip', 'Type'), tx('Osnovno', 'Basic'), tx('Dodatno', 'Extra')].map((label, index) => (
          <button key={label} type="button" onClick={() => setKorak(index + 1)}
            className={`rounded-xl border py-2 text-xs font-bold ${
              korak === index + 1 ? 'border-[#6c63ff66] bg-[#6c63ff22] text-[#a09aff]' : 'border-[#1e1e32] bg-[#0f0f1a] text-[#5a5a80]'
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div className="mb-5 rounded-2xl border border-[#3ecfcf44] bg-[#3ecfcf11] p-4">
        <p className="text-sm font-black text-[#3ecfcf]">{tx('Kaj je nujno?', 'What is required?')}</p>
        <p className="mt-2 text-sm leading-relaxed text-[#d8d8e8]">
          {tx(
            'Za shranjevanje vozila sta nujna samo znamka in model. Tip vozila je izbran vnaprej in ga spremeniš samo, če ni pravi.',
            'Only make and model are required to save a vehicle. Vehicle type is preselected and you only change it if needed.',
          )}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-[#8a8aa8]">
          {tx(
            'Letnik, kilometri, gorivo, tablica, barva in tehnični podatki niso obvezni. Več kot jih dodaš, bolj verodostojno in uporabno bo poročilo, ker se ti podatki lahko izvozijo v PDF/QR report.',
            'Year, mileage, fuel type, plate, color and technical details are optional. The more you add, the more credible and useful the report becomes, because these details can be exported to the PDF/QR report.',
          )}
        </p>
      </div>

      <div className="flex flex-col gap-4">

        {/* Tip vozila */}
        <div className={`${korak === 1 ? '' : 'hidden'} bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5`}>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3 block">Tip vozila</label>
          <div className="grid grid-cols-3 gap-2">
            {tipiVozil.map((tip) => (
              <button key={tip.vrednost} type="button"
                onClick={() => { setTipVozila(tip.vrednost); setOblika(''); setTipVozilaCustom('') }}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                  tipVozila === tip.vrednost
                    ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                    : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80] hover:border-[#6c63ff33]'
                }`}>
                <span className="text-2xl">{tip.ikona}</span>
                <span className="text-xs font-semibold">{tip.naziv}</span>
              </button>
            ))}
          </div>

          {/* Custom tip */}
          {tipVozila === 'drugo' && (
            <div className="mt-3">
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Natančen tip vozila *</label>
              <input value={tipVozilaCustom} onChange={e => setTipVozilaCustom(e.target.value)}
                placeholder="npr. Štirikoles, Traktor, Quad..."
                className="w-full bg-[#13131f] border border-[#6c63ff44] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            </div>
          )}
        </div>

        {/* Osnovno */}
        <div className={`${korak === 2 ? '' : 'hidden'} bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 flex flex-col gap-4`}>
          <div>
            <h2 className="text-white font-semibold">{tx('Osnovni podatki', 'Basic details')}</h2>
            <p className="text-[#5a5a80] text-xs mt-1">
              {tx('Znamka in model sta nujna. Ostalo lahko dopolniš kasneje.', 'Make and model are required. Everything else can be completed later.')}
            </p>
          </div>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Znamka *</label>
            <input value={znamka} onChange={e => setZnamka(e.target.value)} placeholder="npr. Volvo"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Model *</label>
            <input value={model} onChange={e => setModel(e.target.value)} placeholder="npr. XC90"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Letnik</label>
              <input value={letnik} onChange={e => setLetnik(e.target.value)} placeholder="2021" type="number"
                className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            </div>
            <div>
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Gorivo</label>
              <select value={gorivo} onChange={e => setGorivo(e.target.value)}
                className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors">
                <option>Bencin</option>
                <option>Diesel</option>
                <option>Električni</option>
                <option>Hibrid</option>
                <option>Plin</option>
                <option>Vodik</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Trenutni km</label>
            <input value={km} onChange={e => setKm(e.target.value)} placeholder="npr. 54200" type="number"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            {!km.trim() && (
              <p className="mt-2 rounded-xl border border-[#f59e0b66] bg-[#f59e0b18] px-3 py-2 text-xs font-black leading-snug text-[#fbbf24]">
                {tx(
                  'Brez trenutnih kilometrov bo PDF/QR poročilo manj verodostojno. Vozilo lahko vseeno shraniš, če poročila ne potrebuješ.',
                  'Without current mileage the PDF/QR report will be less credible. You can still save the vehicle if you do not need the report.'
                )}
              </p>
            )}
            {km.trim() && (
              <p className="mt-2 rounded-xl border border-[#6c63ff55] bg-[#6c63ff14] px-3 py-2 text-xs font-black leading-snug text-[#4f46e5]">
                {tx(
                  'To je trenutno stanje števca. Stare vnose lahko dodaš naknadno, km ob nakupu pa nastaviš v lastništvu vozila.',
                  'This is the current odometer reading. Older entries can be added later, and purchase mileage can be set in vehicle ownership.'
                )}
              </p>
            )}
          </div>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Registrska tablica</label>
            <input value={tablica} onChange={e => setTabla(e.target.value)} placeholder="npr. LJ X9-MK1"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Barva</label>
            <input value={barva} onChange={e => setBarva(e.target.value)} placeholder="npr. Siva metalik"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('VIN / številka šasije', 'VIN / chassis number')}</label>
            <input value={vin} onChange={e => setVin(e.target.value)} placeholder="17-mestna VIN koda" maxLength={32}
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors font-mono tracking-widest" />
          </div>

          <div className="rounded-2xl border border-[#1e1e32] bg-[#13131f] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-white">{tx('Dovoli preverjanje vozila', 'Allow vehicle lookup')}</p>
                <p className="mt-1 text-xs leading-relaxed text-[#8a8aa8]">
                  {tx('Privzeto je izklopljeno. Če vklopiš, lahko druga oseba z VIN/šasijo preveri izbrane podatke o tem vozilu.', 'Off by default. If enabled, another person can use the VIN/chassis number to see selected details about this vehicle.')}
                </p>
              </div>
              <button onClick={() => {
                  if (registryEnabled) {
                    const ok = window.confirm(tx(
                      'Ali ste prepričani, da želite izklopiti preverjanje vozila?',
                      'Are you sure you want to disable vehicle lookup?',
                    ))
                    if (!ok) return
                    setRegistrySkipConfirmed(true)
                  }
                  setRegistryEnabled(!registryEnabled)
                  if (!registryEnabled) setRegistrySkipConfirmed(false)
                }} type="button"
                className={`h-8 w-16 shrink-0 rounded-full transition-all relative ${registryEnabled ? 'bg-[#6c63ff]' : 'bg-[#2a2a40]'}`}>
                <div className={`w-7 h-7 bg-white rounded-full absolute top-0.5 transition-all ${registryEnabled ? 'left-8' : 'left-0.5'}`} />
              </button>
            </div>

            {registryEnabled && (
              <div className="mt-4 rounded-2xl border border-[#6c63ff44] bg-[#6c63ff10] p-4">
                <p className="text-xs font-bold leading-relaxed text-[#c7c7d8]">
                  {tx('Ime, e-mail, naslov, zasebne opombe in originalni dokumenti se ne pokažejo. Izberi samo podatke, ki jih želiš deliti.', 'Name, email, address, private notes and original documents are not shown. Select only the data you want to share.')}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[
                    ['showMileage', tx('Zadnji znani kilometri', 'Latest known mileage')],
                    ['showServiceSummary', tx('Servisni povzetek', 'Service summary')],
                    ['showCostSummary', tx('Stroškovni povzetek', 'Cost summary')],
                    ['showPlate', tx('Registrska tablica', 'License plate')],
                    ['showDocuments', tx('Dokazila na zahtevo', 'Documents on request')],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 rounded-xl border border-[#2a2a40] bg-[#0f0f1a] p-3 text-xs font-bold text-white">
                      <input type="checkbox" checked={Boolean(registryVisibility[key as keyof typeof registryVisibility])}
                        onChange={(e) => setRegistryOption(key as keyof typeof registryVisibility, e.target.checked)}
                        className="h-4 w-4 accent-[#6c63ff]" />
                      {label}
                    </label>
                  ))}
                </div>
                <label className="mt-3 flex items-start gap-3 rounded-xl border border-[#0f766e66] bg-[#ccfbf1] p-3 text-xs font-bold leading-relaxed text-[#0f172a] dark:border-[#3ecfcf55] dark:bg-[#3ecfcf12] dark:text-[#d8ffff]">
                  <input type="checkbox" checked={registryUnderstand} onChange={(e) => setRegistryUnderstand(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#3ecfcf]" />
                  <span>{tx('Razumem, da bo vozilo mogoče preveriti po VIN/šasiji in da lahko to kadarkoli izklopim.', 'I understand that this vehicle can be checked by VIN/chassis number and that I can disable this at any time.')}</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Napredne nastavitve */}
        <div className={`${korak === 3 ? '' : 'hidden'} bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 flex flex-col gap-4`}>
          <h2 className="text-white font-semibold">Napredni podatki <span className="text-[#5a5a80] text-xs font-normal">(po želji)</span></h2>

          {oblikeAvta[tipVozila] && (
            <div>
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Oblika</label>
              <div className="flex flex-wrap gap-2">
                {oblikeAvta[tipVozila].map((o) => (
                  <button key={o} type="button" onClick={() => setOblika(oblika === o ? '' : o)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      oblika === o
                        ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                        : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80] hover:border-[#6c63ff33]'
                    }`}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Kubikаža (ccm)</label>
              <input value={kubikaza} onChange={e => setKubikaza(e.target.value)} placeholder="npr. 1968" type="number"
                className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            </div>
            <div>
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Moč (kW)</label>
              <input value={kw} onChange={e => setKw(e.target.value)} placeholder="npr. 140" type="number"
                className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            </div>
          </div>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Velikost rezervoarja (L)</label>
            <input value={rezervarLitri} onChange={e => setRezervarLitri(e.target.value)} placeholder="npr. 70" inputMode="decimal"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            <p className="mt-2 text-xs text-[#5a5a80]">
              {tx('Opcijsko. Uporabi se za približen doseg na strani Gorivo.', 'Optional. Used for estimated range on the Fuel page.')}
            </p>
          </div>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Menjalnik</label>
            <div className="grid grid-cols-3 gap-2">
              {['Ročni', 'Avtomatski', 'Polavtomatski'].map((m) => (
                <button key={m} type="button" onClick={() => setMenjalnik(menjalnik === m ? '' : m)}
                  className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                    menjalnik === m
                      ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                      : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80] hover:border-[#6c63ff33]'
                  }`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Pogon</label>
            <div className="grid grid-cols-3 gap-2">
              {['Sprednji', 'Zadnji', '4x4'].map((p) => (
                <button key={p} type="button" onClick={() => setPogon(pogon === p ? '' : p)}
                  className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                    pogon === p
                      ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                      : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80] hover:border-[#6c63ff33]'
                  }`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {message && (
          <div className={`p-3 rounded-xl text-sm border ${
            message.includes('✅') ? 'bg-[#16a34a22] border-[#16a34a44] text-[#4ade80]' : 'bg-[#ef444422] border-[#ef444444] text-[#fca5a5]'
          }`}>{message}</div>
        )}

        {korak < 3 && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setKorak(Math.max(1, korak - 1))} disabled={korak === 1}
              className="w-full rounded-xl border border-[#1e1e32] bg-[#13131f] py-3 font-semibold text-[#5a5a80] disabled:opacity-40">
              Nazaj
            </button>
            <button onClick={naprej}
              className="w-full rounded-xl bg-[#6c63ff] py-3 font-semibold text-white transition-colors hover:bg-[#5a52e0]">
              Naprej →
            </button>
          </div>
        )}

        <button onClick={shrani} disabled={loading || korak < 3}
          className={`${korak < 3 ? 'hidden' : ''} w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50`}>
          {loading ? 'Shranjevanje...' : 'Shrani vozilo →'}
        </button>
      </div>
      </div>

      <BottomNav />
    </div>
  )
}
