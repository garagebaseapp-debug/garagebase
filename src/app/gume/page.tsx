'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton, BottomNav } from '@/lib/nav'
import { useLanguage } from '@/lib/i18n'
import { clearVehicleDataCaches } from '@/lib/vehicle-cache'
import { TireSeasonIcon } from '@/lib/tire-icon'

type TireSet = {
  id: string
  car_id: string
  season: string
  brand: string | null
  model: string | null
  size: string | null
  dot: string | null
  tread_depth_mm: number | null
  purchase_date: string | null
  installed_at: string | null
  installed_km: number | null
  removed_at: string | null
  removed_km: number | null
  next_change_date: string | null
  remind_days_before: number | null
  total_km: number | null
  status: string
  notes: string | null
}

type TireSeasonSettings = {
  countryLabel: string
  winterStart: string
  winterEnd: string
  warnDaysBefore: string
}

const TIRE_SEASON_SETTINGS_KEY = 'garagebase_tire_season_settings'
const defaultSeasonSettings: TireSeasonSettings = {
  countryLabel: 'Slovenija',
  winterStart: '11-15',
  winterEnd: '03-15',
  warnDaysBefore: '7',
}

const todayIso = () => new Date().toISOString().split('T')[0]
const numberOrNull = (value: string) => {
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}
const pad2 = (value: number) => String(value).padStart(2, '0')
const normalizeMonthDay = (value: string) => {
  const match = String(value || '').trim().match(/^(\d{1,2})[-./](\d{1,2})$/)
  if (!match) return ''
  const month = Number(match[1])
  const day = Number(match[2])
  if (month < 1 || month > 12 || day < 1 || day > 31) return ''
  return `${pad2(month)}-${pad2(day)}`
}
const dateFromMonthDay = (monthDay: string, year: number) => {
  const normalized = normalizeMonthDay(monthDay)
  if (!normalized) return null
  const [month, day] = normalized.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}
const toIsoDate = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}
const nextSeasonReminderDate = (season: string, settings: TireSeasonSettings) => {
  const warnDays = Math.max(0, numberOrNull(settings.warnDaysBefore) ?? 7)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const targetMonthDay = season === 'winter' ? settings.winterEnd : settings.winterStart
  let target = dateFromMonthDay(targetMonthDay, today.getFullYear())
  if (!target) return ''
  target.setDate(target.getDate() - warnDays)
  if (target < today) {
    target = dateFromMonthDay(targetMonthDay, today.getFullYear() + 1)
    if (!target) return ''
    target.setDate(target.getDate() - warnDays)
  }
  return toIsoDate(target)
}

export default function GumePage() {
  const { language } = useLanguage()
  const tx = (sl: string, en: string) => language === 'en' ? en : sl
  const locale = language === 'en' ? 'en-US' : 'sl-SI'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [cars, setCars] = useState<any[]>([])
  const [car, setCar] = useState<any>(null)
  const [tires, setTires] = useState<TireSet[]>([])
  const [showForm, setShowForm] = useState(false)
  const [archiveCurrent, setArchiveCurrent] = useState(true)
  const [seasonSettings, setSeasonSettings] = useState<TireSeasonSettings>(defaultSeasonSettings)
  const [form, setForm] = useState({
    season: 'summer',
    brand: '',
    model: '',
    size: '',
    dot: '',
    treadDepth: '',
    purchaseDate: '',
    installedAt: todayIso(),
    installedKm: '',
    nextChangeDate: '',
    remindDaysBefore: '7',
    notes: '',
  })

  const currentKm = Number(car?.km_trenutni || 0)
  const activeTires = tires.filter((item) => item.status === 'active')
  const archivedTires = tires.filter((item) => item.status !== 'active')
  const seasonLabel = (season: string) => ({
    summer: tx('Letne', 'Summer'),
    winter: tx('Zimske', 'Winter'),
    all_season: tx('Celoletne', 'All-season'),
  }[season] || season)
  const formatKm = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value)
    ? `${value.toLocaleString(locale)} km`
    : '-'
  const tireKm = (item: TireSet) => {
    const base = Number(item.total_km || 0)
    if (item.status !== 'active') return base || Math.max(0, Number(item.removed_km || 0) - Number(item.installed_km || 0))
    const start = Number(item.installed_km || item.removed_km || 0)
    return base + Math.max(0, currentKm - start)
  }
  const bestTire = useMemo(() => {
    const list = tires.map((item) => ({ item, km: tireKm(item) })).sort((a, b) => b.km - a.km)
    return list[0] || null
  }, [tires, currentKm])
  const calculatedReminderDate = useMemo(
    () => nextSeasonReminderDate(form.season, seasonSettings),
    [form.season, seasonSettings]
  )
  const seasonReminderText = (season: string) => {
    if (season === 'winter') return tx('opomnik pred koncem zimske sezone', 'reminder before winter season ends')
    if (season === 'all_season') return tx('opomnik za pregled pred zimo', 'reminder to check tires before winter')
    return tx('opomnik pred zimsko sezono', 'reminder before winter season')
  }

  const loadData = async (forcedCarId?: string) => {
    setLoading(true)
    setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/'
      return
    }
    const params = new URLSearchParams(window.location.search)
    const requestedCarId = forcedCarId || params.get('car') || ''
    const { data: carRows, error: carError } = await supabase
      .from('cars')
      .select('id,user_id,znamka,model,km_trenutni,arhivirano,vrstni_red')
      .eq('user_id', user.id)
      .or('arhivirano.is.null,arhivirano.eq.false')
      .order('vrstni_red', { ascending: true })
    if (carError) {
      setMessage(`${tx('Napaka pri nalaganju vozil:', 'Error loading vehicles:')} ${carError.message}`)
      setLoading(false)
      return
    }
    const nextCars = carRows || []
    setCars(nextCars)
    const selected = nextCars.find((item: any) => item.id === requestedCarId) || nextCars[0]
    if (!selected) {
      setLoading(false)
      return
    }
    setCar(selected)
    setForm((prev) => ({ ...prev, installedKm: String(selected.km_trenutni || '') }))
    const { data: tireRows, error: tireError } = await supabase
      .from('tire_sets')
      .select('*')
      .eq('user_id', user.id)
      .eq('car_id', selected.id)
      .order('status', { ascending: true })
      .order('installed_at', { ascending: false })
      .order('created_at', { ascending: false })
    if (tireError) {
      setTires([])
      setMessage(tx('Za gume najprej zaženi SQL migracijo SUPABASE_MIGRACIJA_GUME.sql.', 'Run the SUPABASE_MIGRACIJA_GUME.sql migration before using tire tracking.'))
    } else {
      setTires(tireRows || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TIRE_SEASON_SETTINGS_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      if (parsed) {
        setSeasonSettings({
          countryLabel: String(parsed.countryLabel || defaultSeasonSettings.countryLabel),
          winterStart: normalizeMonthDay(parsed.winterStart) || defaultSeasonSettings.winterStart,
          winterEnd: normalizeMonthDay(parsed.winterEnd) || defaultSeasonSettings.winterEnd,
          warnDaysBefore: String(numberOrNull(parsed.warnDaysBefore) ?? 7),
        })
      }
    } catch {}
    loadData()
  }, [])

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      nextChangeDate: calculatedReminderDate,
      remindDaysBefore: seasonSettings.warnDaysBefore,
    }))
  }, [calculatedReminderDate, seasonSettings.warnDaysBefore])

  const updateForm = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }))
  const updateSeasonSettings = (key: keyof TireSeasonSettings, value: string) => {
    setSeasonSettings((prev) => {
      const next = { ...prev, [key]: key === 'winterStart' || key === 'winterEnd' ? normalizeMonthDay(value) || value : value }
      try { localStorage.setItem(TIRE_SEASON_SETTINGS_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }
  const saveTires = async () => {
    if (!car?.id) return
    if (!form.brand.trim() && !form.size.trim()) {
      setMessage(tx('Vnesi vsaj znamko ali dimenzijo gum.', 'Enter at least the tire brand or size.'))
      return
    }
    setSaving(true)
    setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/'
      return
    }
    const installedKm = numberOrNull(form.installedKm) ?? currentKm
    if (archiveCurrent && activeTires.length > 0) {
      await Promise.all(activeTires.map((item) => {
        const usedKm = tireKm(item)
        return supabase
          .from('tire_sets')
          .update({
            status: 'archived',
            removed_at: form.installedAt || todayIso(),
            removed_km: installedKm,
            total_km: usedKm,
          })
          .eq('id', item.id)
          .eq('user_id', user.id)
      }))
    }
    const { data: inserted, error } = await supabase
      .from('tire_sets')
      .insert({
        user_id: user.id,
        car_id: car.id,
        season: form.season,
        brand: form.brand.trim() || null,
        model: form.model.trim() || null,
        size: form.size.trim() || null,
        dot: form.dot.trim() || null,
        tread_depth_mm: numberOrNull(form.treadDepth),
        purchase_date: form.purchaseDate || null,
        installed_at: form.installedAt || todayIso(),
        installed_km: installedKm,
        next_change_date: form.nextChangeDate || null,
        remind_days_before: numberOrNull(form.remindDaysBefore) || 7,
        notes: form.notes.trim() || null,
        status: 'active',
      })
      .select('id')
      .single()
    if (error) {
      setMessage(`${tx('Napaka pri shranjevanju gum:', 'Error saving tires:')} ${error.message}`)
      setSaving(false)
      return
    }
    if (form.nextChangeDate) {
      const { data: existingReminder } = await supabase
        .from('reminders')
        .select('id')
        .eq('car_id', car.id)
        .eq('tip', 'gume')
        .eq('datum', form.nextChangeDate)
        .limit(1)

      if (!existingReminder?.length) {
        await supabase.from('reminders').insert({
          car_id: car.id,
          tip: 'gume',
          datum: form.nextChangeDate,
          km_opomnik: null,
          opozorilo_dni_prej: numberOrNull(form.remindDaysBefore) || 7,
        })
      }
    }
    setShowForm(false)
    setForm({
      season: 'summer',
      brand: '',
      model: '',
      size: '',
      dot: '',
      treadDepth: '',
      purchaseDate: '',
      installedAt: todayIso(),
      installedKm: String(currentKm || ''),
      nextChangeDate: calculatedReminderDate,
      remindDaysBefore: seasonSettings.warnDaysBefore,
      notes: '',
    })
    clearVehicleDataCaches(car.id)
    setMessage(inserted?.id ? tx('Gume so shranjene.', 'Tires saved.') : '')
    await loadData(car.id)
    setSaving(false)
  }

  const archiveTireSet = async (item: TireSet) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('tire_sets')
      .update({
        status: 'archived',
        removed_at: todayIso(),
        removed_km: currentKm,
        total_km: tireKm(item),
      })
      .eq('id', item.id)
      .eq('user_id', user.id)
    clearVehicleDataCaches(car.id)
    await loadData(car.id)
  }

  const cardClass = 'rounded-[24px] border border-[#2e344a] bg-[#101524] p-4 shadow-xl shadow-black/12'
  const inputClass = 'w-full rounded-2xl border border-[#30364c] bg-[#0b1020] px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#6c63ff]'

  return (
    <div className="min-h-screen bg-[#0d1020] px-4 py-5 pb-24 text-white xl:pl-[300px] xl:pr-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7f77ff]">GarageBase</p>
              <h1 className="text-2xl font-black">{tx('Gume', 'Tires')}</h1>
              <p className="text-sm font-semibold text-[#a8b0c0]">{tx('Sezone, opomniki in kilometri po kompletu gum.', 'Seasons, reminders and mileage by tire set.')}</p>
            </div>
          </div>
          <button onClick={() => setShowForm(true)} className="rounded-2xl bg-[#6c63ff] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#6c63ff55]">
            + {tx('Dodaj gume', 'Add tires')}
          </button>
        </div>

        {cars.length > 1 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {cars.map((item) => (
              <button
                key={item.id}
                onClick={() => loadData(item.id)}
                className={`shrink-0 rounded-2xl border px-4 py-2 text-sm font-black ${car?.id === item.id ? 'border-[#6c63ff] bg-[#6c63ff] text-white' : 'border-[#30364c] bg-[#101524] text-[#d8def0]'}`}
              >
                {item.znamka} {item.model}
              </button>
            ))}
          </div>
        )}

        {message && <div className="mb-4 rounded-2xl border border-[#3ecfcf66] bg-[#3ecfcf14] px-4 py-3 text-sm font-bold text-[#9ff3f3]">{message}</div>}

        {loading ? (
          <div className={cardClass}>{tx('Nalaganje...', 'Loading...')}</div>
        ) : !car ? (
          <div className={cardClass}>{tx('Najprej dodaj vozilo.', 'Add a vehicle first.')}</div>
        ) : (
          <>
            <div className="mb-5 grid gap-3 md:grid-cols-3">
              <div className={cardClass}>
                <p className="text-xs font-black uppercase text-[#a8b0c0]">{tx('Trenutni km vozila', 'Current vehicle mileage')}</p>
                <p className="mt-2 text-3xl font-black">{formatKm(currentKm)}</p>
              </div>
              <div className={cardClass}>
                <p className="text-xs font-black uppercase text-[#a8b0c0]">{tx('Aktivni kompleti', 'Active sets')}</p>
                <p className="mt-2 text-3xl font-black text-[#3ecfcf]">{activeTires.length}</p>
              </div>
              <div className={cardClass}>
                <p className="text-xs font-black uppercase text-[#a8b0c0]">{tx('Največ zdržale', 'Longest lasting')}</p>
                <p className="mt-2 text-xl font-black">{bestTire ? formatKm(bestTire.km) : '-'}</p>
                <p className="mt-1 text-xs font-bold text-[#a8b0c0]">{bestTire ? `${bestTire.item.brand || ''} ${bestTire.item.model || ''}`.trim() || seasonLabel(bestTire.item.season) : tx('Ni podatkov', 'No data')}</p>
              </div>
            </div>

            <div className="mb-5 rounded-[28px] border border-[#2e344a] bg-[#101524] p-4 shadow-xl shadow-black/12">
              <div className="mb-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7f77ff]">{tx('Sezonsko pravilo', 'Season rule')}</p>
                  <h2 className="mt-1 text-xl font-black">{tx('Zimska sezona po državi', 'Winter season by country')}</h2>
                  <p className="mt-1 text-sm font-semibold text-[#a8b0c0]">
                    {tx('Vpiši pravilo za svojo državo. GarageBase na osnovi teh datumov samodejno nastavi opomnik za menjavo gum.', 'Enter the rule for your country. GarageBase uses these dates to set the tire change reminder automatically.')}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <label className="text-sm font-black">{tx('Država / pravilo', 'Country / rule')}
                  <input value={seasonSettings.countryLabel} onChange={(e) => updateSeasonSettings('countryLabel', e.target.value)} className={inputClass} />
                </label>
                <label className="text-sm font-black">{tx('Začetek zime', 'Winter starts')}
                  <input value={seasonSettings.winterStart} onChange={(e) => updateSeasonSettings('winterStart', e.target.value)} placeholder="11-15" className={inputClass} />
                </label>
                <label className="text-sm font-black">{tx('Konec zime', 'Winter ends')}
                  <input value={seasonSettings.winterEnd} onChange={(e) => updateSeasonSettings('winterEnd', e.target.value)} placeholder="03-15" className={inputClass} />
                </label>
                <label className="text-sm font-black">{tx('Opozori dni prej', 'Warn days before')}
                  <input value={seasonSettings.warnDaysBefore} onChange={(e) => updateSeasonSettings('warnDaysBefore', e.target.value)} inputMode="numeric" className={inputClass} />
                </label>
              </div>
            </div>

            {showForm && (
              <div className="mb-5 rounded-[28px] border border-[#6c63ff55] bg-[#11182a] p-4 shadow-2xl shadow-[#6c63ff22]">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-black">{tx('Nov komplet gum', 'New tire set')}</h2>
                  <button onClick={() => setShowForm(false)} className="rounded-xl border border-[#30364c] px-3 py-2 text-sm font-black text-[#d8def0]">{tx('Zapri', 'Close')}</button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="text-sm font-black">{tx('Sezona', 'Season')}<select value={form.season} onChange={(e) => updateForm('season', e.target.value)} className={inputClass}><option value="summer">{tx('Letne', 'Summer')}</option><option value="winter">{tx('Zimske', 'Winter')}</option><option value="all_season">{tx('Celoletne', 'All-season')}</option></select></label>
                  <div className="rounded-2xl border border-[#30364c] bg-[#0b1020] p-3">
                    <div className="flex items-center gap-3">
                      <TireSeasonIcon season={form.season} className="h-12 w-12 shrink-0" />
                      <div>
                        <p className="text-sm font-black">{seasonLabel(form.season)}</p>
                        <p className="text-xs font-bold text-[#a8b0c0]">{seasonReminderText(form.season)}</p>
                      </div>
                    </div>
                  </div>
                  <label className="text-sm font-black">{tx('Znamka', 'Brand')}<input value={form.brand} onChange={(e) => updateForm('brand', e.target.value)} className={inputClass} /></label>
                  <label className="text-sm font-black">{tx('Model', 'Model')}<input value={form.model} onChange={(e) => updateForm('model', e.target.value)} className={inputClass} /></label>
                  <label className="text-sm font-black">{tx('Dimenzija', 'Size')}<input value={form.size} onChange={(e) => updateForm('size', e.target.value)} placeholder="205/55 R16" className={inputClass} /></label>
                  <label className="text-sm font-black">DOT<input value={form.dot} onChange={(e) => updateForm('dot', e.target.value)} placeholder="DOT 2424" className={inputClass} /></label>
                  <label className="text-sm font-black">{tx('Profil mm', 'Tread mm')}<input value={form.treadDepth} onChange={(e) => updateForm('treadDepth', e.target.value)} inputMode="decimal" className={inputClass} /></label>
                  <label className="text-sm font-black">{tx('Datum nakupa', 'Purchase date')}<input type="date" value={form.purchaseDate} onChange={(e) => updateForm('purchaseDate', e.target.value)} className={inputClass} /></label>
                  <label className="text-sm font-black">{tx('Montirano dne', 'Installed on')}<input type="date" value={form.installedAt} onChange={(e) => updateForm('installedAt', e.target.value)} className={inputClass} /></label>
                  <label className="text-sm font-black">{tx('Začetni km', 'Start mileage')}<input value={form.installedKm} onChange={(e) => updateForm('installedKm', e.target.value)} inputMode="numeric" className={inputClass} /></label>
                  <label className="text-sm font-black">{tx('Samodejni opomnik', 'Automatic reminder')}<input type="date" value={form.nextChangeDate} onChange={(e) => updateForm('nextChangeDate', e.target.value)} className={inputClass} /></label>
                  <label className="text-sm font-black">{tx('Opozori dni prej', 'Warn days before')}<input value={form.remindDaysBefore} onChange={(e) => updateForm('remindDaysBefore', e.target.value)} inputMode="numeric" className={inputClass} /></label>
                  <label className="flex items-center gap-3 rounded-2xl border border-[#30364c] bg-[#0b1020] px-4 py-3 text-sm font-black"><input type="checkbox" checked={archiveCurrent} onChange={(e) => setArchiveCurrent(e.target.checked)} />{tx('Arhiviraj trenutne aktivne gume', 'Archive current active tires')}</label>
                  <p className="rounded-2xl border border-[#3ecfcf44] bg-[#3ecfcf14] px-4 py-3 text-sm font-bold text-[#9ff3f3] md:col-span-3">
                    {tx('Izračunano iz pravila', 'Calculated from rule')}: {seasonSettings.countryLabel || '-'} ({seasonSettings.winterStart || '-'} - {seasonSettings.winterEnd || '-'}) · {seasonReminderText(form.season)}
                  </p>
                  <label className="text-sm font-black md:col-span-3">{tx('Opombe', 'Notes')}<textarea value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} rows={3} className={inputClass} /></label>
                </div>
                <button disabled={saving} onClick={saveTires} className="mt-4 w-full rounded-2xl bg-[#6c63ff] px-5 py-4 text-sm font-black text-white shadow-lg shadow-[#6c63ff44] disabled:opacity-60">
                  {saving ? tx('Shranjujem...', 'Saving...') : tx('Shrani komplet gum', 'Save tire set')}
                </button>
              </div>
            )}

            <section className="mb-6">
              <h2 className="mb-3 text-xl font-black">{tx('Aktivne gume', 'Active tires')}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {activeTires.length === 0 && <div className={cardClass}>{tx('Ni aktivnih gum za to vozilo.', 'No active tires for this vehicle.')}</div>}
                {activeTires.map((item) => (
                  <div key={item.id} className={cardClass}>
                    <div className="flex items-start justify-between gap-3">
                      <TireSeasonIcon season={item.season} className="h-12 w-12 shrink-0" />
                      <div>
                        <p className="text-xs font-black uppercase text-[#3ecfcf]">{seasonLabel(item.season)}</p>
                        <h3 className="mt-1 text-xl font-black">{[item.brand, item.model].filter(Boolean).join(' ') || tx('Gume', 'Tires')}</h3>
                        <p className="text-sm font-bold text-[#a8b0c0]">{[item.size, item.dot].filter(Boolean).join(' · ') || '-'}</p>
                      </div>
                      <button onClick={() => archiveTireSet(item)} className="rounded-xl border border-[#f59e0b66] bg-[#f59e0b14] px-3 py-2 text-xs font-black text-[#fbbf24]">{tx('Arhiviraj', 'Archive')}</button>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-2xl bg-[#0b1020] p-3"><p className="text-[#a8b0c0]">{tx('Prevoženo', 'Driven')}</p><p className="font-black">{formatKm(tireKm(item))}</p></div>
                      <div className="rounded-2xl bg-[#0b1020] p-3"><p className="text-[#a8b0c0]">{tx('Profil', 'Tread')}</p><p className="font-black">{item.tread_depth_mm ? `${item.tread_depth_mm} mm` : '-'}</p></div>
                      <div className="rounded-2xl bg-[#0b1020] p-3"><p className="text-[#a8b0c0]">{tx('Montirano', 'Installed')}</p><p className="font-black">{item.installed_at || '-'}</p></div>
                      <div className="rounded-2xl bg-[#0b1020] p-3"><p className="text-[#a8b0c0]">{tx('Opomnik', 'Reminder')}</p><p className="font-black">{item.next_change_date || '-'}</p></div>
                    </div>
                    {item.notes && <p className="mt-3 rounded-2xl bg-[#0b1020] p-3 text-sm font-semibold text-[#d8def0]">{item.notes}</p>}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-black">{tx('Arhiv gum', 'Tire archive')}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {archivedTires.length === 0 && <div className={cardClass}>{tx('Arhiv je še prazen.', 'Archive is still empty.')}</div>}
                {archivedTires.map((item) => (
                  <div key={item.id} className={`${cardClass} opacity-90`}>
                    <TireSeasonIcon season={item.season} className="mb-2 h-10 w-10" />
                    <p className="text-xs font-black uppercase text-[#a8b0c0]">{seasonLabel(item.season)}</p>
                    <h3 className="mt-1 text-lg font-black">{[item.brand, item.model].filter(Boolean).join(' ') || tx('Gume', 'Tires')}</h3>
                    <p className="text-sm font-bold text-[#a8b0c0]">{[item.size, item.dot].filter(Boolean).join(' · ') || '-'}</p>
                    <p className="mt-3 text-2xl font-black text-[#6c63ff]">{formatKm(tireKm(item))}</p>
                    <p className="mt-1 text-xs font-bold text-[#a8b0c0]">{item.installed_at || '-'} - {item.removed_at || '-'}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
      <BottomNav aktivna="servis" />
    </div>
  )
}
