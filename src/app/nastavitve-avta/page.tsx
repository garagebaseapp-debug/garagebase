'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'
import { compressImageFile, imageCompressionErrorText, uploadImageProfiles } from '@/lib/image-compress'
import { getStoredLanguage } from '@/lib/i18n'
import { clearVehicleDataCaches } from '@/lib/vehicle-cache'

const ownershipSettingsKey = (carId: string) => `garagebase_vehicle_ownership_${carId}`
const readStoredOwnershipSettings = (carId: string) => {
  try {
    return JSON.parse(localStorage.getItem(ownershipSettingsKey(carId)) || '{}')
  } catch {
    return {}
  }
}
const writeStoredOwnershipSettings = (carId: string, data: Record<string, unknown>) => {
  try {
    localStorage.setItem(ownershipSettingsKey(carId), JSON.stringify(data))
  } catch {}
}

export default function NastavitveAvta() {
  const [avto, setAvto] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [uploadingSlika, setUploadingSlika] = useState(false)
  const [tipVozila, setTipVozila] = useState('avto')
  const [tipVozilaCustom, setTipVozilaCustom] = useState('')
  const [oblika, setOblika] = useState('')
  const [znamka, setZnamka] = useState('')
  const [model, setModel] = useState('')
  const [letnik, setLetnik] = useState('')
  const [gorivo, setGorivo] = useState('')
  const [rezervarLitri, setRezervarLitri] = useState('')
  const [barva, setBarva] = useState('')
  const [tablica, setTabla] = useState('')
  const [vin, setVin] = useState('')
  const [kubikaza, setKubikaza] = useState('')
  const [kw, setKw] = useState('')
  const [menjalnik, setMenjalnik] = useState('')
  const [pogon, setPogon] = useState('')
  const [stLastnikov, setStLastnikov] = useState('')
  const [lastnikMesto, setLastnikMesto] = useState('')
  const [lastnikStarost, setLastnikStarost] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [purchaseMileage, setPurchaseMileage] = useState('')
  const [downPayment, setDownPayment] = useState('')
  const [financeTotalPaid, setFinanceTotalPaid] = useState('')
  const [financeOverpayment, setFinanceOverpayment] = useState('')
  const [monthlyPayment, setMonthlyPayment] = useState('')
  const [resaleValue, setResaleValue] = useState('')
  const [includeVehiclePriceInCosts, setIncludeVehiclePriceInCosts] = useState(false)
  const [prenosSoglasje, setPrenosSoglasje] = useState(false)
  const [prenosOpomba, setPrenosOpomba] = useState('')
  const [homologacijaStevilka, setHomologacijaStevilka] = useState('')
  const [homologacijaOpis, setHomologacijaOpis] = useState('')
  const [homologacijaUrl, setHomologacijaUrl] = useState('')
  const [uploadingHomologacija, setUploadingHomologacija] = useState(false)
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

  const standardniTipi = ['avto', 'motor', 'kombi', 'tovornjak', 'plovilo']
  const imageError = (error: unknown) => imageCompressionErrorText(error, getStoredLanguage() === 'en' ? 'en' : 'sl')
  const lockedRecordMessage = () => getStoredLanguage() === 'en'
    ? 'Some vehicle records are older than 24 hours and are protected from changes. If something is wrong, contact support.'
    : 'Nekateri zapisi vozila so starejši od 24 ur in so zaščiteni pred spremembami. Če je prišlo do napake, kontaktiraj podporo.'
  const isLockedRecordError = (error: any) => String(error?.message || '').includes('manual_record_locked_after_24h')
  const decimalValue = (value: string) => {
    const parsed = Number(String(value || '').replace(',', '.'))
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }
  const isMissingReservoirColumn = (error: any) => {
    const message = String(error?.message || '')
    return message.includes('rezervar_litri') || message.includes('tank_capacity')
  }
  const isMissingOwnershipColumn = (error: any) => {
    const message = String(error?.message || '')
    return ['purchase_price', 'purchase_date', 'purchase_mileage', 'down_payment', 'finance_total_paid', 'finance_overpayment', 'monthly_payment', 'resale_value', 'include_vehicle_price_in_costs']
      .some((column) => message.includes(column))
  }
  const normalizedVin = () => String(vin || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const hasLookupVin = () => normalizedVin().length >= 6
  const setRegistryOption = (key: keyof typeof registryVisibility, value: boolean) => {
    setRegistryVisibility((current) => ({ ...current, [key]: value }))
  }

  const saveRegistryConsent = async () => {
    if (!avto?.id) return true
    if (registryEnabled && !hasLookupVin()) {
      setMessage(tx('Za preverjanje vozila najprej vnesi VIN/številko šasije.', 'Enter the VIN/chassis number before enabling vehicle lookup.'))
      return false
    }
    if (registryEnabled && !registryUnderstand) {
      setMessage(tx('Najprej potrdi, da razumeš, kaj bo vidno pri preverjanju vozila.', 'Confirm that you understand what will be visible in vehicle lookup.'))
      return false
    }
    if (!registryEnabled && hasLookupVin() && !registrySkipConfirmed) {
      const ok = window.confirm(tx(
        'Ali ste prepričani, da ne želite deliti preverjanja tega vozila? Brez privolitve drugi lastnik ali kupec vozila ne bo mogel preveriti zgodovine v GarageBase bazi.',
        'Are you sure you do not want to share lookup for this vehicle? Without consent, another owner or buyer will not be able to verify its GarageBase history.',
      ))
      if (!ok) {
        setRegistryEnabled(true)
        return false
      }
      setRegistrySkipConfirmed(true)
    }
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) return false
    const response = await fetch('/api/vehicle-registry/consent', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        carId: avto.id,
        vin,
        enabled: registryEnabled,
        understood: registryUnderstand,
        visibility: registryVisibility,
      }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(result.error === 'invalid_vin'
        ? tx('VIN/številka šasije ni dovolj dolga za preverjanje.', 'VIN/chassis number is not long enough for lookup.')
        : tx('Napaka pri shranjevanju preverjanja vozila: ', 'Vehicle lookup consent save error: ') + (result.details || result.error || ''))
      return false
    }
    return true
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const params = new URLSearchParams(window.location.search)
      const carId = params.get('car')
      if (!carId) { window.location.href = '/garaza'; return }
      const { data } = await supabase.from('cars').select('*').eq('id', carId).eq('user_id', user.id).maybeSingle()
      if (!data) { window.location.href = '/garaza'; return }
      if (data) {
        setAvto(data)
        // Če tip ni standardni, je custom
        if (data.tip_vozila && !standardniTipi.includes(data.tip_vozila)) {
          setTipVozila('drugo')
          setTipVozilaCustom(data.tip_vozila)
        } else {
          setTipVozila(data.tip_vozila || 'avto')
        }
        setOblika(data.oblika || '')
        setZnamka(data.znamka || '')
        setModel(data.model || '')
        setLetnik(data.letnik?.toString() || '')
        setGorivo(data.gorivo || '')
        setRezervarLitri((data.rezervar_litri ?? data.tank_capacity_liters ?? '')?.toString?.() || '')
        setBarva(data.barva || '')
        setTabla(data.tablica || '')
        setVin(data.vin || '')
        setKubikaza(data.kubikaza?.toString() || '')
        setKw(data.kw?.toString() || '')
        setMenjalnik(data.menjalnik || '')
        setPogon(data.pogon || '')
        setStLastnikov(data.st_lastnikov?.toString() || '')
        setLastnikMesto(data.lastnik_mesto || '')
        setLastnikStarost(data.lastnik_starost?.toString() || '')
        const storedOwnership = readStoredOwnershipSettings(data.id)
        setPurchasePrice((data.purchase_price ?? storedOwnership.purchase_price ?? '')?.toString() || '')
        setPurchaseDate((data.purchase_date ?? storedOwnership.purchase_date ?? '')?.toString() || '')
        setPurchaseMileage((data.purchase_mileage ?? storedOwnership.purchase_mileage ?? data.km_ob_vnosu ?? '')?.toString() || '')
        setDownPayment((data.down_payment ?? storedOwnership.down_payment ?? '')?.toString() || '')
        setFinanceTotalPaid((data.finance_total_paid ?? storedOwnership.finance_total_paid ?? '')?.toString() || '')
        setFinanceOverpayment((data.finance_overpayment ?? storedOwnership.finance_overpayment ?? '')?.toString() || '')
        setMonthlyPayment((data.monthly_payment ?? storedOwnership.monthly_payment ?? '')?.toString() || '')
        setResaleValue((data.resale_value ?? storedOwnership.resale_value ?? '')?.toString() || '')
        setIncludeVehiclePriceInCosts(data.include_vehicle_price_in_costs === true || storedOwnership.include_vehicle_price_in_costs === true)
        setPrenosSoglasje(data.prenos_soglasje === true)
        setPrenosOpomba(data.prenos_opomba || '')
        setHomologacijaStevilka(data.homologacija_stevilka || '')
        setHomologacijaOpis(data.homologacija_opis || '')
        setHomologacijaUrl(data.homologacija_url || '')
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        if (token) {
          const registryResponse = await fetch(`/api/vehicle-registry/consent?car=${encodeURIComponent(data.id)}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          })
          const registryResult = await registryResponse.json().catch(() => ({}))
          if (registryResponse.ok) {
            const consent = registryResult.consent || {}
            const visibility = consent.visibility || {}
            setRegistryEnabled(consent.enabled === true)
            setRegistryUnderstand(consent.enabled === true)
            setRegistryVisibility({
              showPlate: Boolean(visibility.showPlate),
              showMileage: visibility.showMileage !== false,
              showServiceSummary: visibility.showServiceSummary !== false,
              showCostSummary: Boolean(visibility.showCostSummary),
              showDocuments: Boolean(visibility.showDocuments),
            })
          }
        }
      }
      setLoading(false)
    }
    init()
  }, [])

  const naloziSliko = async (e: any) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingSlika(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploadingSlika(false); return }
    let preparedFile = file
    try {
      preparedFile = (await compressImageFile(file, uploadImageProfiles.vehicle)).file
    } catch (error: any) {
      setMessage(imageError(error))
      setUploadingSlika(false)
      return
    }
    const fileExt = preparedFile.name.split('.').pop() || 'jpg'
    const previousPath = String(avto?.slika_url || '').split('/car-images/')[1]?.split('?')[0]
    const fileName = `${user.id}/${avto.id}-${Date.now()}.${fileExt}`
    const { error: uploadError } = await supabase.storage.from('car-images').upload(fileName, preparedFile, { cacheControl: '31536000', upsert: false })
    if (uploadError) { setMessage('Napaka pri nalaganju slike'); setUploadingSlika(false); return }
    const { data: urlData } = supabase.storage.from('car-images').getPublicUrl(fileName)
    const { error: updateError } = await supabase.from('cars').update({ slika_url: urlData.publicUrl }).eq('id', avto.id).eq('user_id', user.id)
    if (updateError) { setMessage('Napaka pri shranjevanju slike'); setUploadingSlika(false); return }
    if (previousPath) await supabase.storage.from('car-images').remove([decodeURIComponent(previousPath)])
    clearVehicleDataCaches(avto.id)
    setAvto({ ...avto, slika_url: urlData.publicUrl })
    setMessage('✅ Slika uspešno naložena!')
    setUploadingSlika(false)
  }

  const naloziHomologacijo = async (e: any) => {
    const file = e.target.files[0]
    if (!file || !avto?.id) return
    setUploadingHomologacija(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploadingHomologacija(false); return }
    let preparedFile = file
    if (file.type.startsWith('image/')) {
      try {
        preparedFile = (await compressImageFile(file, uploadImageProfiles.document)).file
      } catch (error: any) {
        setMessage(imageError(error))
        setUploadingHomologacija(false)
        return
      }
    }
    const fileExt = preparedFile.name.split('.').pop()
    const fileName = `${user.id}/homologacija_${avto.id}.${fileExt}`
    const { error: uploadError } = await supabase.storage.from('service-documents').upload(fileName, preparedFile, { upsert: true })
    if (uploadError) {
      setMessage('Napaka pri nalaganju homologacije.')
      setUploadingHomologacija(false)
      return
    }
    const { data: urlData } = supabase.storage.from('service-documents').getPublicUrl(fileName)
    setHomologacijaUrl(urlData.publicUrl)
    await supabase.from('cars').update({ homologacija_url: urlData.publicUrl }).eq('id', avto.id).eq('user_id', user.id)
    setAvto({ ...avto, homologacija_url: urlData.publicUrl })
    setMessage('✅ Homologacija uspešno naložena!')
    setUploadingHomologacija(false)
  }

  const shrani = async () => {
    if (tipVozila === 'drugo' && !tipVozilaCustom) { setMessage('Vnesi tip vozila!'); return }
    setSaving(true)
    setMessage('')
    const finalniTip = tipVozila === 'drugo' ? tipVozilaCustom : tipVozila
    const ownershipPayload = {
      purchase_price: decimalValue(purchasePrice),
      purchase_date: purchaseDate || null,
      purchase_mileage: purchaseMileage ? parseInt(purchaseMileage) : null,
      down_payment: decimalValue(downPayment),
      finance_total_paid: decimalValue(financeTotalPaid),
      finance_overpayment: decimalValue(financeOverpayment),
      monthly_payment: decimalValue(monthlyPayment),
      resale_value: decimalValue(resaleValue),
      include_vehicle_price_in_costs: includeVehiclePriceInCosts,
    }
    if (avto?.id) writeStoredOwnershipSettings(avto.id, ownershipPayload)
    const payload: any = {
      tip_vozila: finalniTip,
      oblika: oblika || null,
      znamka, model,
      letnik: letnik ? parseInt(letnik) : null,
      gorivo, barva: barva || null,
      rezervar_litri: decimalValue(rezervarLitri),
      tablica: tablica || null,
      vin: vin || null,
      kubikaza: kubikaza ? parseInt(kubikaza) : null,
      kw: kw ? parseInt(kw) : null,
      menjalnik: menjalnik || null,
      pogon: pogon || null,
      st_lastnikov: stLastnikov ? parseInt(stLastnikov) : null,
      lastnik_mesto: lastnikMesto || null,
      lastnik_starost: lastnikStarost ? parseInt(lastnikStarost) : null,
      ...ownershipPayload,
      prenos_soglasje: prenosSoglasje,
      prenos_opomba: prenosOpomba || null,
      homologacija_stevilka: homologacijaStevilka || null,
      homologacija_opis: homologacijaOpis || null,
      homologacija_url: homologacijaUrl || null,
    }
    let { error } = await supabase.from('cars').update(payload).eq('id', avto.id).eq('user_id', avto.user_id)
    let reservoirFallback = false
    if (error && isMissingReservoirColumn(error)) {
      delete payload.rezervar_litri
      const retry = await supabase.from('cars').update(payload).eq('id', avto.id).eq('user_id', avto.user_id)
      error = retry.error
      reservoirFallback = !retry.error
    }
    let ownershipFallback = false
    if (error && isMissingOwnershipColumn(error)) {
      delete payload.purchase_price
      delete payload.purchase_date
      delete payload.purchase_mileage
      delete payload.down_payment
      delete payload.finance_total_paid
      delete payload.finance_overpayment
      delete payload.monthly_payment
      delete payload.resale_value
      delete payload.include_vehicle_price_in_costs
      const retry = await supabase.from('cars').update(payload).eq('id', avto.id).eq('user_id', avto.user_id)
      error = retry.error
      ownershipFallback = !retry.error
    }
    if (error) setMessage(error.message.includes('homologacija') ? 'Napaka: v Supabase najprej zaženi SUPABASE_MIGRACIJA_HOMOLOGACIJA.sql' : error.message.includes('st_lastnikov') ? 'Napaka: v Supabase najprej zaženi SUPABASE_MIGRACIJA_PRENOS.sql' : 'Napaka: ' + error.message)
    else {
      const consentSaved = await saveRegistryConsent()
      if (!consentSaved) {
        setSaving(false)
        return
      }
      clearVehicleDataCaches(avto.id)
      setMessage(reservoirFallback ? '✅ Nastavitve shranjene. Za doseg zaženi SQL za polje rezervoarja.' : '✅ Nastavitve shranjene!')
      setAvto({ ...avto })
    }
    setSaving(false)
  }

  const nastaviArhiv = async (value: boolean) => {
    if (!avto?.id) return
    setSaving(true)
    setMessage('')
    const { error } = await supabase.from('cars').update({
      arhivirano: value,
      archived_at: value ? new Date().toISOString() : null,
    }).eq('id', avto.id).eq('user_id', avto.user_id)
    if (error) {
      setMessage(error.message.includes('arhivirano') ? 'Napaka: v Supabase najprej zazeni SUPABASE_MIGRACIJA_ARHIV_VOZIL.sql' : 'Napaka: ' + error.message)
    } else {
      clearVehicleDataCaches(avto.id)
      setAvto({ ...avto, arhivirano: value, archived_at: value ? new Date().toISOString() : null })
      setMessage(value ? 'Vozilo je premaknjeno v arhiv.' : 'Vozilo je vrnjeno med aktivna vozila.')
    }
    setSaving(false)
  }

  const izbrisiVozilo = async () => {
    if (!avto?.id) return

    const potrdi = window.confirm(`Ali res želiš izbrisati ${avto?.znamka || ''} ${avto?.model || ''}? Vsi podatki bodo trajno izgubljeni!`)
    if (!potrdi) return
    const potrdi2 = window.confirm('Si prepričan? Tega dejanja ni možno razveljaviti!')
    if (!potrdi2) return

    setSaving(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      window.location.href = '/'
      return
    }

    const { data: ownedCar, error: ownershipError } = await supabase
      .from('cars')
      .select('id')
      .eq('id', avto.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (ownershipError || !ownedCar) {
      setMessage(ownershipError ? `Napaka: ${ownershipError.message}` : 'Vozila ni bilo možno potrditi za ta račun.')
      setSaving(false)
      return
    }

    const deleteSteps = [
      () => supabase.from('fuel_logs').delete().eq('car_id', avto.id),
      () => supabase.from('service_logs').delete().eq('car_id', avto.id),
      () => supabase.from('expenses').delete().eq('car_id', avto.id),
      () => supabase.from('reminders').delete().eq('car_id', avto.id),
      () => supabase.from('cars').delete().eq('id', avto.id).eq('user_id', user.id),
    ]

    for (const step of deleteSteps) {
      const { error } = await step()
      if (error) {
        setMessage(isLockedRecordError(error) ? lockedRecordMessage() : `Napaka pri brisanju vozila: ${error.message}`)
        setSaving(false)
        return
      }
    }

    clearVehicleDataCaches(avto.id)
    window.location.href = '/garaza'
  }

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">Nalaganje...</p>
    </div>
  )

  return (
    <div className="gb-settings-page min-h-screen bg-[#080810] px-4 py-6 pb-24 xl:px-6">
      <div className="mx-auto w-full max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <BackButton href={`/dashboard?car=${avto?.id}`} />
        <div>
          <h1 className="text-xl font-bold text-white">⚙️ Nastavitve vozila</h1>
          <p className="text-[#5a5a80] text-xs">{avto?.znamka} {avto?.model}</p>
        </div>
      </div>

      {/* Slika */}
      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl overflow-hidden mb-4">
        {avto?.slika_url ? (
          <div className="relative">
            <img src={avto.slika_url} alt="Avto" className="h-48 w-full bg-[#080810] object-contain object-center sm:h-56 lg:h-64" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <label className="absolute bottom-3 right-3 bg-[#6c63ff] text-white text-xs font-semibold px-3 py-1.5 rounded-xl cursor-pointer hover:bg-[#5a52e0] transition-colors">
              {uploadingSlika ? 'Nalaganje...' : '📷 Zamenjaj'}
              <input type="file" accept="image/*" onChange={naloziSliko} className="hidden" />
            </label>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center h-36 cursor-pointer hover:bg-[#13131f] transition-colors">
            <span className="text-3xl mb-2">📷</span>
            <span className="text-[#5a5a80] text-sm font-semibold">{uploadingSlika ? 'Nalaganje...' : 'Dodaj sliko'}</span>
            <input type="file" accept="image/*" onChange={naloziSliko} className="hidden" />
          </label>
        )}
      </div>

      {/* Tip vozila */}
      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
        <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3 block">Tip vozila</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 flex flex-col gap-4 mb-4">
        <h2 className="text-white font-semibold">Osnovni podatki</h2>
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Znamka</label>
          <input value={znamka} onChange={e => setZnamka(e.target.value)}
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
        </div>
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Model</label>
          <input value={model} onChange={e => setModel(e.target.value)}
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Letnik</label>
            <input value={letnik} onChange={e => setLetnik(e.target.value)} type="number"
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
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Barva</label>
          <input value={barva} onChange={e => setBarva(e.target.value)} placeholder="npr. Siva metalik"
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
        </div>
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Velikost rezervoarja (L)</label>
          <input value={rezervarLitri} onChange={e => setRezervarLitri(e.target.value)} placeholder="npr. 70" inputMode="decimal"
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          <p className="mt-2 text-xs text-[#5a5a80]">Opcijsko. Uporabi se za približen izračun dosega na strani Gorivo.</p>
        </div>
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Registrska tablica</label>
          <input value={tablica} onChange={e => setTabla(e.target.value)}
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
        </div>
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">VIN številka</label>
          <input value={vin} onChange={e => setVin(e.target.value)} placeholder="17-mestna VIN koda" maxLength={17}
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors font-mono tracking-widest" />
        </div>
      </div>

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 flex flex-col gap-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-white font-semibold">{tx('Preverjanje vozila v bazi', 'Vehicle lookup in database')}</h2>
            <p className="text-[#8a8aa8] text-xs mt-1 leading-relaxed">
              {tx('Privzeto je izklopljeno. Če vklopiš, lahko druga oseba z VIN/šasijo preveri samo podatke, ki jih izbereš spodaj.', 'Off by default. If enabled, another person can use the VIN/chassis number to see only the data you select below.')}
            </p>
          </div>
          <button onClick={() => {
              if (registryEnabled) {
                const ok = window.confirm(tx(
                  'Ali ste prepričani, da želite izklopiti preverjanje vozila? Drugi lastnik ali kupec ga po VIN/šasiji ne bo več mogel preveriti v GarageBase bazi.',
                  'Are you sure you want to disable vehicle lookup? Another owner or buyer will no longer be able to verify it in the GarageBase database by VIN/chassis number.',
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

        {!hasLookupVin() && (
          <p className="rounded-xl border border-[#f59e0b55] bg-[#f59e0b12] px-3 py-2 text-xs font-bold leading-relaxed text-[#fbbf24]">
            {tx('Za vklop preverjanja mora biti vpisana VIN/številka šasije.', 'A VIN/chassis number is required before enabling lookup.')}
          </p>
        )}

        {registryEnabled && (
          <div className="rounded-2xl border border-[#6c63ff44] bg-[#6c63ff10] p-4">
            <p className="text-sm font-black text-white">{tx('Kaj dovoljuješ za prikaz?', 'What do you allow to be shown?')}</p>
            <p className="mt-2 text-xs leading-relaxed text-[#c7c7d8]">
              {tx('Ime, e-mail, naslov, zasebne opombe in originalni dokumenti se ne pokažejo. Dokumenti se pokažejo samo, če to posebej dovoliš.', 'Name, email, address, private notes and original documents are not shown. Documents are shown only if you explicitly allow it.')}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                ['showMileage', tx('Zadnji znani kilometri', 'Latest known mileage')],
                ['showServiceSummary', tx('Servisni povzetek', 'Service summary')],
                ['showCostSummary', tx('Stroškovni povzetek', 'Cost summary')],
                ['showPlate', tx('Registrska tablica', 'License plate')],
                ['showDocuments', tx('Dokazila na zahtevo', 'Documents on request')],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-xl border border-[#2a2a40] bg-[#13131f] p-3 text-xs font-bold text-white">
                  <input type="checkbox" checked={Boolean(registryVisibility[key as keyof typeof registryVisibility])}
                    onChange={(e) => setRegistryOption(key as keyof typeof registryVisibility, e.target.checked)}
                    className="h-4 w-4 accent-[#6c63ff]" />
                  {label}
                </label>
              ))}
            </div>
            <label className="mt-4 flex items-start gap-3 rounded-xl border border-[#0f766e66] bg-[#ccfbf1] p-3 text-xs font-bold leading-relaxed text-[#0f172a] dark:border-[#3ecfcf55] dark:bg-[#3ecfcf12] dark:text-[#d8ffff]">
              <input type="checkbox" checked={registryUnderstand} onChange={(e) => setRegistryUnderstand(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#3ecfcf]" />
              <span>{tx('Razumem, da bo vozilo mogoče preveriti po VIN/šasiji in da lahko to kadarkoli izklopim.', 'I understand that this vehicle can be checked by VIN/chassis number and that I can disable this at any time.')}</span>
            </label>
          </div>
        )}
      </div>

      {/* Napredne nastavitve */}
      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 flex flex-col gap-4 mb-4">
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

        <div className="grid gap-3 sm:grid-cols-2">
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
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Menjalnik</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 flex flex-col gap-4 mb-4">
        <div>
          <h2 className="text-white font-semibold">{tx('Cena vozila in lastništvo', 'Vehicle price and ownership')}</h2>
          <p className="text-[#5a5a80] text-xs mt-1">
            {tx('Uporabi se za ločen izračun skupnega stroška lastništva. Osnovni stroški na km ostanejo prikazani tudi brez cene vozila.', 'Used for a separate total ownership cost calculation. Running cost per km remains available without vehicle price.')}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Nakupna cena', 'Purchase price')}</label>
            <input value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} inputMode="decimal" placeholder="npr. 18500"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Datum nakupa', 'Purchase date')}</label>
            <input value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} type="date"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Km ob nakupu', 'Mileage at purchase')}</label>
            <input value={purchaseMileage} onChange={e => setPurchaseMileage(e.target.value)} inputMode="numeric" placeholder="npr. 125000"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            <p className="mt-2 rounded-xl border border-[#6c63ff55] bg-[#6c63ff14] px-3 py-2 text-xs font-black leading-snug text-[#8b7cff]">
              {tx(
                'Začetne kilometre je najbolje popraviti čim prej. Priporočeno okno za popravek je 24 ur po dodajanju vozila.',
                'It is best to correct starting mileage as soon as possible. The recommended correction window is 24 hours after adding the vehicle.'
              )}
            </p>
          </div>
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Polog', 'Down payment')}</label>
            <input value={downPayment} onChange={e => setDownPayment(e.target.value)} inputMode="decimal" placeholder="npr. 3000"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Skupaj plačano kredit/lizing', 'Total finance paid')}</label>
            <input value={financeTotalPaid} onChange={e => setFinanceTotalPaid(e.target.value)} inputMode="decimal" placeholder="npr. 22000"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Preplačilo/obresti', 'Overpayment/interest')}</label>
            <input value={financeOverpayment} onChange={e => setFinanceOverpayment(e.target.value)} inputMode="decimal" placeholder="npr. 1800"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Mesečni obrok', 'Monthly payment')}</label>
            <input value={monthlyPayment} onChange={e => setMonthlyPayment(e.target.value)} inputMode="decimal" placeholder="npr. 280"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Prodajna vrednost', 'Resale value')}</label>
            <input value={resaleValue} onChange={e => setResaleValue(e.target.value)} inputMode="decimal" placeholder="npr. 12000"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>
        </div>
        <label className="flex items-center gap-3 rounded-xl border border-[#6c63ff44] bg-[#6c63ff10] p-4 text-sm font-bold text-white">
          <input type="checkbox" checked={includeVehiclePriceInCosts} onChange={e => setIncludeVehiclePriceInCosts(e.target.checked)} className="h-4 w-4 accent-[#6c63ff]" />
          {tx('V stroških privzeto prikaži tudi ceno vozila', 'Include vehicle price in costs by default')}
        </label>
      </div>


      {/* Homologacija */}
      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 flex flex-col gap-4 mb-4">
        <div>
          <h2 className="text-white font-semibold">Homologacija</h2>
          <p className="text-[#5a5a80] text-xs mt-1">Vnesi številko, opombo ali priloži sliko/PDF homologacije.</p>
        </div>
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Številka homologacije</label>
          <input value={homologacijaStevilka} onChange={e => setHomologacijaStevilka(e.target.value)} placeholder="npr. e1*2007/46*1234"
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
        </div>
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Opis homologacije</label>
          <textarea value={homologacijaOpis} onChange={e => setHomologacijaOpis(e.target.value)} rows={3} placeholder="npr. Vpisane pnevmatike, platišča, vlečna kljuka..."
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors resize-none" />
        </div>
        <div className="flex flex-col gap-3">
          {homologacijaUrl && (
            <a href={homologacijaUrl} target="_blank" rel="noreferrer"
              className="bg-[#3ecfcf11] border border-[#3ecfcf44] text-[#3ecfcf] rounded-xl px-4 py-3 text-sm font-semibold">
              Odpri priloženo homologacijo
            </a>
          )}
          <label className="flex items-center gap-3 bg-[#13131f] border border-dashed border-[#2a2a40] rounded-xl px-4 py-3 cursor-pointer hover:border-[#6c63ff] transition-colors">
            <span className="text-2xl">📄</span>
            <div>
              <p className="text-[#5a5a80] text-sm font-semibold">{uploadingHomologacija ? 'Nalaganje...' : homologacijaUrl ? 'Zamenjaj dokument' : 'Dodaj dokument ali sliko'}</p>
              <p className="text-[#3a3a5a] text-xs">Slika ali PDF dokument</p>
            </div>
            <input type="file" accept="image/*,.pdf" onChange={naloziHomologacijo} className="hidden" />
          </label>
        </div>
      </div>

      {/* Lastništvo in prenos */}
      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 flex flex-col gap-4 mb-4">
        <h2 className="text-white font-semibold">Lastništvo in prenos</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Št. lastnikov</label>
            <input value={stLastnikov} onChange={e => setStLastnikov(e.target.value)} type="number" min="0"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Mesto</label>
            <input value={lastnikMesto} onChange={e => setLastnikMesto(e.target.value)} placeholder="npr. Ljubljana"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>
          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Starost</label>
            <input value={lastnikStarost} onChange={e => setLastnikStarost(e.target.value)} type="number" min="0"
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>
        </div>
        <div className="flex justify-between items-center gap-4 bg-[#13131f] border border-[#1e1e32] rounded-xl p-4">
          <div>
            <p className="text-white text-sm font-semibold">Dovolim prenos zgodovine</p>
            <p className="text-[#5a5a80] text-xs mt-0.5">Uporabi se za QR prenos in report za naslednjega lastnika.</p>
          </div>
          <button onClick={() => setPrenosSoglasje(!prenosSoglasje)} type="button"
            className={`w-12 h-6 rounded-full transition-all relative ${prenosSoglasje ? 'bg-[#6c63ff]' : 'bg-[#2a2a40]'}`}>
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${prenosSoglasje ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
        <div>
          <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">Opomba pri prenosu</label>
          <textarea value={prenosOpomba} onChange={e => setPrenosOpomba(e.target.value)} rows={3} placeholder="npr. Vozilo redno servisirano, računi priloženi..."
            className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors resize-none" />
        </div>
      </div>
      {message && (
        <div className={`p-3 rounded-xl text-sm border mb-4 ${
          message.includes('✅') ? 'bg-[#16a34a22] border-[#16a34a44] text-[#4ade80]' : 'bg-[#ef444422] border-[#ef444444] text-[#fca5a5]'
        }`}>{message}</div>
      )}

      <button onClick={shrani} disabled={saving}
        className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50">
        {saving ? 'Shranjevanje...' : 'Shrani spremembe →'}
      </button>

      <button onClick={() => nastaviArhiv(!avto?.arhivirano)} disabled={saving}
        className="w-full mt-3 bg-[#3ecfcf18] border border-[#3ecfcf55] text-[#3ecfcf] font-semibold py-3 rounded-xl hover:bg-[#3ecfcf22] transition-colors disabled:opacity-50">
        {avto?.arhivirano ? 'Vrni med aktivna vozila' : 'Arhiviraj vozilo'}
      </button>

      {/* Gumb za brisanje vozila */}
      <button onClick={izbrisiVozilo} disabled={saving}
        className="w-full mt-3 bg-transparent border border-[#ef444433] text-[#ef4444] font-semibold py-3 rounded-xl hover:bg-[#ef444411] transition-colors disabled:opacity-50">
        🗑️ Izbriši vozilo
      </button>

      <HomeButton />
      </div>
    </div>
  )
}
