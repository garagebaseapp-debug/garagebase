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
  tire_scope?: string | null
  last_mounted_at?: string | null
  last_mounted_km?: number | null
}

type TireMount = {
  id: string
  tire_set_id: string
  mounted_at: string
  mounted_km: number
  removed_at: string | null
  removed_km: number | null
  km_driven: number | null
  axle_position?: string | null
}

type TireTreadMeasurement = {
  id: string
  tire_set_id: string
  measured_at: string
  km: number
  tread_mm: number | null
  front_tread_mm: number | null
  rear_tread_mm: number | null
  note: string | null
}

type TireCar = {
  id: string
  user_id?: string
  znamka?: string | null
  model?: string | null
  km_trenutni?: number | string | null
  arhivirano?: boolean | null
  vrstni_red?: number | null
}

type TirePayload = {
  user_id: string
  car_id: string
  season: string
  tire_scope: string
  brand: string | null
  model: string | null
  size: string | null
  dot: string | null
  tread_depth_mm: number | null
  purchase_date: string | null
  installed_at: string
  installed_km: number
  removed_at: null
  removed_km: null
  last_mounted_at: string
  last_mounted_km: number
  next_change_date: string | null
  remind_days_before: number
  notes: string | null
  status: string
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

function readSeasonSettings(): TireSeasonSettings {
  if (typeof window === 'undefined') return defaultSeasonSettings
  try {
    const raw = localStorage.getItem(TIRE_SEASON_SETTINGS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (!parsed) return defaultSeasonSettings
    return {
      countryLabel: String(parsed.countryLabel || defaultSeasonSettings.countryLabel),
      winterStart: normalizeMonthDay(parsed.winterStart) || defaultSeasonSettings.winterStart,
      winterEnd: normalizeMonthDay(parsed.winterEnd) || defaultSeasonSettings.winterEnd,
      warnDaysBefore: String(numberOrNull(parsed.warnDaysBefore) ?? 7),
    }
  } catch {
    return defaultSeasonSettings
  }
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
  if (season === 'all_season') return ''
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

const normalizeTireStatus = (status: string) => {
  if (status === 'active') return 'mounted'
  if (status === 'archived') return 'retired'
  if (status === 'stored') return 'stored'
  if (status === 'retired') return 'retired'
  return 'mounted'
}

const isMissingTireSchemaPart = (error: unknown) => {
  const message = String(typeof error === 'object' && error && 'message' in error ? error.message : '').toLowerCase()
  return message.includes('last_mounted')
    || message.includes('tire_scope')
    || message.includes('tire_mounts')
    || message.includes('schema cache')
    || message.includes('violates check constraint')
}

const defaultPositionForScope = (scope: string) => {
  if (scope === 'front_pair') return 'front'
  if (scope === 'rear_pair') return 'rear'
  return 'all'
}

export default function GumePage() {
  const { language } = useLanguage()
  const tx = (sl: string, en: string) => language === 'en' ? en : sl
  const locale = language === 'en' ? 'en-US' : 'sl-SI'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [cars, setCars] = useState<TireCar[]>([])
  const [car, setCar] = useState<TireCar | null>(null)
  const [tires, setTires] = useState<TireSet[]>([])
  const [mounts, setMounts] = useState<TireMount[]>([])
  const [treadMeasurements, setTreadMeasurements] = useState<TireTreadMeasurement[]>([])
  const [showForm, setShowForm] = useState(false)
  const [storeCurrent, setStoreCurrent] = useState(true)
  const [mountingTireId, setMountingTireId] = useState('')
  const [mountForm, setMountForm] = useState({ mountedAt: todayIso(), mountedKm: '', position: 'all' })
  const [measuringTireId, setMeasuringTireId] = useState('')
  const [treadForm, setTreadForm] = useState({ measuredAt: todayIso(), km: '', tread: '', front: '', rear: '', note: '' })
  const [seasonSettings, setSeasonSettings] = useState<TireSeasonSettings>(() => readSeasonSettings())
  const [form, setForm] = useState({
    season: 'summer',
    tireScope: 'full_set',
    brand: '',
    model: '',
    size: '',
    dot: '',
    treadDepth: '',
    purchaseDate: '',
    installedAt: todayIso(),
    installedKm: '',
    remindDaysBefore: '7',
    notes: '',
    lateEntryNote: '',
  })

  const currentKm = Number(car?.km_trenutni || 0)
  const mountedTires = tires.filter((item) => normalizeTireStatus(item.status) === 'mounted')
  const storedTires = tires.filter((item) => normalizeTireStatus(item.status) === 'stored')
  const retiredTires = tires.filter((item) => normalizeTireStatus(item.status) === 'retired')
  const seasonLabel = (season: string) => ({
    summer: tx('Letne', 'Summer'),
    winter: tx('Zimske', 'Winter'),
    all_season: tx('Celoletne', 'All-season'),
  }[season] || season)
  const scopeLabel = (scope: string | null | undefined) => ({
    full_set: tx('Vse 4 gume', 'All 4 tires'),
    front_pair: tx('Sprednji par', 'Front pair'),
    rear_pair: tx('Zadnji par', 'Rear pair'),
  }[scope || 'full_set'] || tx('Vse 4 gume', 'All 4 tires'))
  const positionLabel = (position: string | null | undefined) => ({
    all: tx('Vse pozicije', 'All positions'),
    front: tx('Spredaj', 'Front'),
    rear: tx('Zadaj', 'Rear'),
  }[position || 'all'] || tx('Vse pozicije', 'All positions'))
  const formatKm = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value)
    ? `${value.toLocaleString(locale)} km`
    : '-'
  const tireKm = (item: TireSet) => {
    const status = normalizeTireStatus(item.status)
    const itemMounts = mounts.filter((mount) => mount.tire_set_id === item.id)
    if (itemMounts.length === 0) {
      const base = Number(item.total_km || 0)
      if (status !== 'mounted') return base || Math.max(0, Number(item.removed_km || 0) - Number(item.installed_km || 0))
      const start = Number(item.installed_km || item.last_mounted_km || 0)
      return base + Math.max(0, currentKm - start)
    }
    return itemMounts.reduce((sum, mount) => {
      const start = Number(mount.mounted_km || 0)
      const end = mount.removed_km !== null && mount.removed_km !== undefined ? Number(mount.removed_km) : currentKm
      return sum + Math.max(0, end - start)
    }, 0)
  }
  const averageTread = (measurement: Partial<TireTreadMeasurement> | null | undefined) => {
    if (!measurement) return null
    const values = [measurement.tread_mm, measurement.front_tread_mm, measurement.rear_tread_mm]
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
    if (values.length === 0) return null
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }
  const tireTreadList = (item: TireSet) => treadMeasurements
    .filter((measurement) => measurement.tire_set_id === item.id)
    .sort((a, b) => {
      const dateDiff = new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime()
      if (dateDiff !== 0) return dateDiff
      return Number(b.km || 0) - Number(a.km || 0)
    })
  const latestTread = (item: TireSet) => {
    const latest = tireTreadList(item)[0]
    return averageTread(latest) ?? (Number(item.tread_depth_mm || 0) || null)
  }
  const treadLimitFor = (item: TireSet) => item.season === 'summer' ? 3 : 4
  const treadStats = (item: TireSet) => {
    const sorted = tireTreadList(item)
      .filter((measurement) => averageTread(measurement) !== null)
      .sort((a, b) => Number(a.km || 0) - Number(b.km || 0))
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    const latest = latestTread(item)
    if (!first || !last || first.id === last.id) return { latest, wearPer1000: null, remainingKm: null }
    const startTread = averageTread(first)
    const endTread = averageTread(last)
    const distance = Number(last.km || 0) - Number(first.km || 0)
    const wear = Number(startTread || 0) - Number(endTread || 0)
    const wearPer1000 = distance > 0 && wear > 0 ? (wear / distance) * 1000 : null
    const limit = treadLimitFor(item)
    const remainingKm = wearPer1000 && latest && latest > limit ? Math.round(((latest - limit) / wearPer1000) * 1000) : null
    return { latest, wearPer1000, remainingKm }
  }
  const openMountFor = (item: TireSet) => mounts.find((mount) => mount.tire_set_id === item.id && !mount.removed_at)
  const bestTire = useMemo(() => {
    const list = tires.map((item) => ({ item, km: tireKm(item) })).sort((a, b) => b.km - a.km)
    return list[0] || null
  }, [tires, currentKm])
  const calculatedReminderDate = useMemo(
    () => nextSeasonReminderDate(form.season, { ...seasonSettings, warnDaysBefore: form.remindDaysBefore }),
    [form.season, form.remindDaysBefore, seasonSettings]
  )
  const mountedKmValue = numberOrNull(form.installedKm) ?? currentKm
  const isBackfilledMount = mountedKmValue > 0 && currentKm > 0 && mountedKmValue < currentKm
  const seasonReminderText = (season: string) => {
    if (season === 'winter') return tx('opomnik pred koncem zimske sezone', 'reminder before winter season ends')
    if (season === 'all_season') return tx('celoletne gume nimajo konca sezone', 'all-season tires have no season end')
    return tx('opomnik pred zimsko sezono', 'reminder before winter season')
  }
  const seasonPeriodText = (season: string) => {
    if (season === 'winter') return tx(`Zimska sezona: ${seasonSettings.winterStart || '-'} - ${seasonSettings.winterEnd || '-'}`, `Winter season: ${seasonSettings.winterStart || '-'} - ${seasonSettings.winterEnd || '-'}`)
    if (season === 'summer') return tx(`Letna sezona: ${seasonSettings.winterEnd || '-'} - ${seasonSettings.winterStart || '-'}`, `Summer season: ${seasonSettings.winterEnd || '-'} - ${seasonSettings.winterStart || '-'}`)
    return tx('Celoletne gume so namenjene uporabi skozi vse leto.', 'All-season tires are intended for year-round use.')
  }

  const loadData = async (forcedCarId?: string) => {
    setLoading(true)
    setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.assign('/')
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
    const nextCars = (carRows || []) as TireCar[]
    setCars(nextCars)
    const selected = nextCars.find((item) => item.id === requestedCarId) || nextCars[0]
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
      setMounts([])
      setTreadMeasurements([])
      setMessage(tx('Za gume najprej zaženi SQL migracijo SUPABASE_MIGRACIJA_GUME.sql.', 'Run the SUPABASE_MIGRACIJA_GUME.sql migration before using tire tracking.'))
    } else {
      setTires(tireRows || [])
      const tireIds = (tireRows || []).map((item: TireSet) => item.id)
      if (tireIds.length > 0) {
        const { data: mountRows, error: mountError } = await supabase
          .from('tire_mounts')
          .select('*')
          .in('tire_set_id', tireIds)
          .order('mounted_at', { ascending: false })
        if (mountError) {
          setMounts([])
          setMessage(tx('Za natančno zgodovino montaž zaženi še SQL migracijo SUPABASE_MIGRACIJA_GUME_MONTAZE.sql.', 'Run SUPABASE_MIGRACIJA_GUME_MONTAZE.sql for exact tire mount history.'))
        } else {
          setMounts(mountRows || [])
        }
        const { data: treadRows, error: treadError } = await supabase
          .from('tire_tread_measurements')
          .select('*')
          .in('tire_set_id', tireIds)
          .order('measured_at', { ascending: false })
          .order('km', { ascending: false })
        if (treadError) {
          setTreadMeasurements([])
        } else {
          setTreadMeasurements(treadRows || [])
        }
      } else {
        setMounts([])
        setTreadMeasurements([])
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadData()
    })
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      setForm((prev) => ({
        ...prev,
        remindDaysBefore: seasonSettings.warnDaysBefore,
      }))
    })
  }, [seasonSettings.warnDaysBefore])

  const updateForm = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }))
  const updateSeasonSettings = (key: keyof TireSeasonSettings, value: string) => {
    setSeasonSettings((prev) => {
      const next = { ...prev, [key]: key === 'winterStart' || key === 'winterEnd' ? normalizeMonthDay(value) || value : value }
      try { localStorage.setItem(TIRE_SEASON_SETTINGS_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const closeMountedTires = async (userId: string, date: string, km: number, exceptId?: string) => {
    const tiresToStore = mountedTires.filter((item) => item.id !== exceptId)
    await Promise.all(tiresToStore.map(async (item) => {
      const usedKm = tireKm(item)
      const { data: openMount } = await supabase
        .from('tire_mounts')
        .select('id')
        .eq('tire_set_id', item.id)
        .eq('user_id', userId)
        .is('removed_at', null)
        .maybeSingle()
      await supabase
        .from('tire_mounts')
        .update({ removed_at: date, removed_km: km })
        .eq('tire_set_id', item.id)
        .eq('user_id', userId)
        .is('removed_at', null)
      await supabase
        .from('tire_sets')
        .update({
          status: 'stored',
          removed_at: date,
          removed_km: km,
          total_km: usedKm,
        })
        .eq('id', item.id)
        .eq('user_id', userId)
      await logMileageEvent(userId, 'tire_remove', openMount?.id || item.id, date, km)
    }))
  }

  const createTireReminder = async (date: string, warnDays: number) => {
    if (!date || !car?.id) return
    const { data: existingReminder } = await supabase
      .from('reminders')
      .select('id')
      .eq('car_id', car.id)
      .eq('tip', 'gume')
      .eq('datum', date)
      .limit(1)

    if (!existingReminder?.length) {
      await supabase.from('reminders').insert({
        car_id: car.id,
        tip: 'gume',
        datum: date,
        km_opomnik: null,
        opozorilo_dni_prej: warnDays,
      })
    }
  }

  const logMileageEvent = async (userId: string, type: 'tire_mount' | 'tire_remove', sourceId: string, date: string, km: number, note?: string) => {
    if (!car?.id || !km) return
    await supabase.from('vehicle_mileage_events').insert({
      user_id: userId,
      car_id: car.id,
      event_type: type,
      source_table: 'tire_mounts',
      source_id: sourceId,
      event_date: date,
      km,
      previous_known_km: currentKm || null,
      entry_timing: currentKm > 0 && km < currentKm ? 'backfilled' : 'normal',
      note: note || null,
    })
  }

  const saveTires = async () => {
    if (!car?.id) return
    const carId = car.id
    if (!form.brand.trim() && !form.size.trim()) {
      setMessage(tx('Vnesi vsaj znamko ali dimenzijo gum.', 'Enter at least the tire brand or size.'))
      return
    }
    setSaving(true)
    setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.assign('/')
      return
    }
    const installedKm = numberOrNull(form.installedKm) ?? currentKm
    const installedAt = form.installedAt || todayIso()
    if (storeCurrent && mountedTires.length > 0) await closeMountedTires(user.id, installedAt, installedKm)
    const tirePayload: TirePayload = {
      user_id: user.id,
      car_id: carId,
      season: form.season,
      tire_scope: form.tireScope,
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      size: form.size.trim() || null,
      dot: form.dot.trim() || null,
      tread_depth_mm: numberOrNull(form.treadDepth),
      purchase_date: form.purchaseDate || null,
      installed_at: installedAt,
      installed_km: installedKm,
      removed_at: null,
      removed_km: null,
      last_mounted_at: installedAt,
      last_mounted_km: installedKm,
      next_change_date: calculatedReminderDate || null,
      remind_days_before: numberOrNull(form.remindDaysBefore) || 7,
      notes: form.notes.trim() || null,
      status: 'mounted',
    }
    let insertResult = await supabase
      .from('tire_sets')
      .insert(tirePayload)
      .select('id')
      .single()
    if (insertResult.error && isMissingTireSchemaPart(insertResult.error)) {
      const legacyPayload = {
        user_id: tirePayload.user_id,
        car_id: tirePayload.car_id,
        season: tirePayload.season,
        brand: tirePayload.brand,
        model: tirePayload.model,
        size: tirePayload.size,
        dot: tirePayload.dot,
        tread_depth_mm: tirePayload.tread_depth_mm,
        purchase_date: tirePayload.purchase_date,
        installed_at: tirePayload.installed_at,
        installed_km: tirePayload.installed_km,
        removed_at: tirePayload.removed_at,
        removed_km: tirePayload.removed_km,
        next_change_date: tirePayload.next_change_date,
        remind_days_before: tirePayload.remind_days_before,
        notes: tirePayload.notes,
        status: 'active',
      }
      insertResult = await supabase
        .from('tire_sets')
        .insert(legacyPayload)
        .select('id')
        .single()
    }
    const { data: inserted, error } = insertResult
    if (error) {
      setMessage(`${tx('Napaka pri shranjevanju gum:', 'Error saving tires:')} ${error.message}`)
      setSaving(false)
      return
    }
    if (inserted?.id) {
      const { data: mountRow } = await supabase.from('tire_mounts').insert({
        user_id: user.id,
        car_id: car.id,
        tire_set_id: inserted.id,
        mounted_at: installedAt,
        mounted_km: installedKm,
        axle_position: defaultPositionForScope(form.tireScope),
      }).select('id').single()
      await logMileageEvent(user.id, 'tire_mount', mountRow?.id || inserted.id, installedAt, installedKm, form.lateEntryNote.trim() || undefined)
    }
    await createTireReminder(calculatedReminderDate, numberOrNull(form.remindDaysBefore) || 7)
    setShowForm(false)
    setForm({
      season: 'summer',
      tireScope: 'full_set',
      brand: '',
      model: '',
      size: '',
      dot: '',
      treadDepth: '',
      purchaseDate: '',
      installedAt: todayIso(),
      installedKm: String(currentKm || ''),
      remindDaysBefore: seasonSettings.warnDaysBefore,
      notes: '',
      lateEntryNote: '',
    })
    clearVehicleDataCaches(carId)
    setMessage(inserted?.id ? tx('Gume so shranjene.', 'Tires saved.') : '')
    await loadData(carId)
    setSaving(false)
  }

  const storeTireSet = async (item: TireSet) => {
    if (!car?.id) return
    const carId = car.id
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: openMount } = await supabase
      .from('tire_mounts')
      .select('id')
      .eq('tire_set_id', item.id)
      .eq('user_id', user.id)
      .is('removed_at', null)
      .maybeSingle()
    await supabase
      .from('tire_mounts')
      .update({ removed_at: todayIso(), removed_km: currentKm })
      .eq('tire_set_id', item.id)
      .eq('user_id', user.id)
      .is('removed_at', null)
    await supabase
      .from('tire_sets')
      .update({
        status: 'stored',
        removed_at: todayIso(),
        removed_km: currentKm,
        total_km: tireKm(item),
      })
      .eq('id', item.id)
      .eq('user_id', user.id)
    await logMileageEvent(user.id, 'tire_remove', openMount?.id || item.id, todayIso(), currentKm)
    clearVehicleDataCaches(carId)
    await loadData(carId)
  }

  const retireTireSet = async (item: TireSet) => {
    if (!car?.id) return
    const carId = car.id
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: openMount } = await supabase
      .from('tire_mounts')
      .select('id')
      .eq('tire_set_id', item.id)
      .eq('user_id', user.id)
      .is('removed_at', null)
      .maybeSingle()
    await supabase
      .from('tire_mounts')
      .update({ removed_at: todayIso(), removed_km: currentKm })
      .eq('tire_set_id', item.id)
      .eq('user_id', user.id)
      .is('removed_at', null)
    await supabase
      .from('tire_sets')
      .update({
        status: 'retired',
        removed_at: todayIso(),
        removed_km: currentKm,
        total_km: tireKm(item),
      })
      .eq('id', item.id)
      .eq('user_id', user.id)
    await logMileageEvent(user.id, 'tire_remove', openMount?.id || item.id, todayIso(), currentKm)
    clearVehicleDataCaches(carId)
    await loadData(carId)
  }

  const mountStoredTire = async (item: TireSet) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !car?.id) return
    const mountedAt = mountForm.mountedAt || todayIso()
    const mountedKm = numberOrNull(mountForm.mountedKm) ?? currentKm
    await closeMountedTires(user.id, mountedAt, mountedKm, item.id)
    await supabase
      .from('tire_sets')
      .update({
        status: 'mounted',
        installed_at: mountedAt,
        installed_km: mountedKm,
        removed_at: null,
        removed_km: null,
        last_mounted_at: mountedAt,
        last_mounted_km: mountedKm,
        next_change_date: nextSeasonReminderDate(item.season, seasonSettings) || null,
        remind_days_before: numberOrNull(seasonSettings.warnDaysBefore) || 7,
      })
      .eq('id', item.id)
      .eq('user_id', user.id)
    const mountPosition = item.tire_scope === 'full_set' ? 'all' : mountForm.position || defaultPositionForScope(item.tire_scope || 'full_set')
    const { data: mountRow } = await supabase.from('tire_mounts').insert({
      user_id: user.id,
      car_id: car.id,
      tire_set_id: item.id,
      mounted_at: mountedAt,
      mounted_km: mountedKm,
      axle_position: mountPosition,
    }).select('id').single()
    await logMileageEvent(user.id, 'tire_mount', mountRow?.id || item.id, mountedAt, mountedKm)
    await createTireReminder(nextSeasonReminderDate(item.season, seasonSettings), numberOrNull(seasonSettings.warnDaysBefore) || 7)
    setMountingTireId('')
    setMountForm({ mountedAt: todayIso(), mountedKm: String(currentKm || ''), position: 'all' })
    clearVehicleDataCaches(car.id)
    await loadData(car.id)
  }

  const openTreadMeasurement = (item: TireSet) => {
    const latest = latestTread(item)
    setMeasuringTireId(item.id)
    setTreadForm({
      measuredAt: todayIso(),
      km: String(currentKm || ''),
      tread: latest ? String(latest) : '',
      front: '',
      rear: '',
      note: '',
    })
  }

  const saveTreadMeasurement = async (item: TireSet) => {
    if (!car?.id) return
    const tread = numberOrNull(treadForm.tread)
    const front = numberOrNull(treadForm.front)
    const rear = numberOrNull(treadForm.rear)
    if (tread === null && front === null && rear === null) {
      setMessage(tx('Vnesi vsaj eno meritev profila v mm.', 'Enter at least one tread measurement in mm.'))
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const measuredKm = numberOrNull(treadForm.km) ?? currentKm
    const { error } = await supabase.from('tire_tread_measurements').insert({
      user_id: user.id,
      car_id: car.id,
      tire_set_id: item.id,
      measured_at: treadForm.measuredAt || todayIso(),
      km: measuredKm,
      tread_mm: tread,
      front_tread_mm: front,
      rear_tread_mm: rear,
      note: treadForm.note.trim() || null,
    })
    if (error) {
      setMessage(tx('Za meritve profila zaženi SQL migracijo SUPABASE_MIGRACIJA_GUME_PROFIL.sql.', 'Run SUPABASE_MIGRACIJA_GUME_PROFIL.sql for tread measurements.'))
      return
    }
    await supabase
      .from('tire_sets')
      .update({ tread_depth_mm: averageTread({ tread_mm: tread, front_tread_mm: front, rear_tread_mm: rear }) })
      .eq('id', item.id)
      .eq('user_id', user.id)
    setMeasuringTireId('')
    setMessage(tx('Meritev profila je shranjena.', 'Tread measurement saved.'))
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
                <p className="text-xs font-black uppercase text-[#a8b0c0]">{tx('Montirani kompleti', 'Mounted sets')}</p>
                <p className="mt-2 text-3xl font-black text-[#3ecfcf]">{mountedTires.length}</p>
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
                  <label className="text-sm font-black">{tx('Obseg gum', 'Tire scope')}<select value={form.tireScope} onChange={(e) => updateForm('tireScope', e.target.value)} className={inputClass}><option value="full_set">{tx('Vse 4 gume', 'All 4 tires')}</option><option value="front_pair">{tx('Sprednji par', 'Front pair')}</option><option value="rear_pair">{tx('Zadnji par', 'Rear pair')}</option></select></label>
                  <div className="rounded-2xl border border-[#30364c] bg-[#0b1020] p-3">
                    <div className="flex items-center gap-3">
                      <TireSeasonIcon season={form.season} className="h-12 w-12 shrink-0" />
                      <div>
                        <p className="text-sm font-black">{seasonLabel(form.season)}</p>
                        <p className="text-xs font-bold text-[#a8b0c0]">{scopeLabel(form.tireScope)} · {seasonPeriodText(form.season)}</p>
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
                  <label className="text-sm font-black">{tx('Opozori dni prej', 'Warn days before')}<input value={form.remindDaysBefore} onChange={(e) => updateForm('remindDaysBefore', e.target.value)} inputMode="numeric" className={inputClass} /></label>
                  <label className="flex items-center gap-3 rounded-2xl border border-[#30364c] bg-[#0b1020] px-4 py-3 text-sm font-black"><input type="checkbox" checked={storeCurrent} onChange={(e) => setStoreCurrent(e.target.checked)} />{tx('Trenutno montirane gume prestavi v hrambo', 'Move currently mounted tires to storage')}</label>
                  {isBackfilledMount && (
                    <label className="rounded-2xl border border-[#f59e0b66] bg-[#f59e0b14] px-4 py-3 text-sm font-black text-[#fbbf24] md:col-span-3">
                      {tx('Vpisuješ km, ki so nižji od trenutnih km vozila. To bomo označili kot naknadno vneseno.', 'You are entering mileage below the vehicle current mileage. This will be marked as entered later.')}
                      <input value={form.lateEntryNote} onChange={(e) => updateForm('lateEntryNote', e.target.value)} placeholder={tx('Opomba, npr. menjava je bila prejšnji teden', 'Note, e.g. change was last week')} className={`${inputClass} mt-2`} />
                    </label>
                  )}
                  <p className="rounded-2xl border border-[#8b5cf666] bg-[#ede9fe] px-4 py-3 text-sm font-black text-[#4338ca] md:col-span-3">
                    {seasonPeriodText(form.season)}{calculatedReminderDate ? ` · ${tx('opomnik', 'reminder')}: ${calculatedReminderDate}` : ''}
                  </p>
                  <label className="text-sm font-black md:col-span-3">{tx('Opombe', 'Notes')}<textarea value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} rows={3} className={inputClass} /></label>
                </div>
                <button disabled={saving} onClick={saveTires} className="mt-4 w-full rounded-2xl bg-[#6c63ff] px-5 py-4 text-sm font-black text-white shadow-lg shadow-[#6c63ff44] disabled:opacity-60">
                  {saving ? tx('Shranjujem...', 'Saving...') : tx('Shrani komplet gum', 'Save tire set')}
                </button>
              </div>
            )}

            <section className="mb-6">
              <h2 className="mb-3 text-xl font-black">{tx('Montirane gume', 'Mounted tires')}</h2>
              <div className="grid gap-3">
                {mountedTires.length === 0 && <div className={cardClass}>{tx('Ni montiranih gum za to vozilo.', 'No mounted tires for this vehicle.')}</div>}
                {mountedTires.map((item) => (
                  <div key={item.id} className={cardClass}>
                    <div className="flex items-start justify-between gap-3">
                      <TireSeasonIcon season={item.season} className="h-12 w-12 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black uppercase text-[#3ecfcf]">{seasonLabel(item.season)}</p>
                        <h3 className="mt-1 text-xl font-black">{[item.brand, item.model].filter(Boolean).join(' ') || tx('Gume', 'Tires')}</h3>
                        <p className="text-sm font-bold text-[#a8b0c0]">{[scopeLabel(item.tire_scope), item.size, item.dot].filter(Boolean).join(' · ')}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => storeTireSet(item)} className="rounded-xl border border-[#3ecfcf66] bg-[#3ecfcf14] px-3 py-2 text-xs font-black text-[#8df0f0]">{tx('V hrambo', 'Store')}</button>
                        <button onClick={() => retireTireSet(item)} className="rounded-xl border border-[#f59e0b66] bg-[#f59e0b14] px-3 py-2 text-xs font-black text-[#fbbf24]">{tx('V arhiv', 'Retire')}</button>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-2xl bg-[#0b1020] p-3"><p className="text-[#a8b0c0]">{tx('Prevoženo', 'Driven')}</p><p className="font-black">{formatKm(tireKm(item))}</p></div>
                      <div className="rounded-2xl bg-[#0b1020] p-3"><p className="text-[#a8b0c0]">{tx('Profil', 'Tread')}</p><p className="font-black">{treadStats(item).latest ? `${treadStats(item).latest?.toFixed(1)} mm` : '-'}</p></div>
                      <div className="rounded-2xl bg-[#0b1020] p-3"><p className="text-[#a8b0c0]">{tx('Montirano', 'Installed')}</p><p className="font-black">{item.installed_at || '-'}</p></div>
                      <div className="rounded-2xl bg-[#0b1020] p-3"><p className="text-[#a8b0c0]">{tx('Pozicija', 'Position')}</p><p className="font-black">{positionLabel(openMountFor(item)?.axle_position || defaultPositionForScope(item.tire_scope || 'full_set'))}</p></div>
                      <div className="rounded-2xl bg-[#0b1020] p-3"><p className="text-[#a8b0c0]">{tx('Obraba', 'Wear')}</p><p className="font-black">{treadStats(item).wearPer1000 ? `${treadStats(item).wearPer1000?.toFixed(2)} mm / 1000 km` : '-'}</p></div>
                      <div className="rounded-2xl bg-[#0b1020] p-3"><p className="text-[#a8b0c0]">{tx('Ocena še', 'Est. left')}</p><p className="font-black">{treadStats(item).remainingKm ? formatKm(treadStats(item).remainingKm) : '-'}</p></div>
                    </div>
                    <button onClick={() => openTreadMeasurement(item)} className="mt-3 rounded-xl border border-[#6c63ff66] bg-[#6c63ff22] px-3 py-2 text-xs font-black text-[#c8c4ff]">+ {tx('Meritev profila', 'Tread measurement')}</button>
                    {measuringTireId === item.id && (
                      <div className="mt-3 grid gap-3 rounded-2xl border border-[#30364c] bg-[#0b1020] p-3 md:grid-cols-3">
                        <label className="text-sm font-black">{tx('Datum', 'Date')}<input type="date" value={treadForm.measuredAt} onChange={(e) => setTreadForm((prev) => ({ ...prev, measuredAt: e.target.value }))} className={inputClass} /></label>
                        <label className="text-sm font-black">{tx('Km', 'Mileage')}<input value={treadForm.km} onChange={(e) => setTreadForm((prev) => ({ ...prev, km: e.target.value }))} inputMode="numeric" className={inputClass} /></label>
                        <label className="text-sm font-black">{tx('Povprečni profil mm', 'Average tread mm')}<input value={treadForm.tread} onChange={(e) => setTreadForm((prev) => ({ ...prev, tread: e.target.value }))} inputMode="decimal" className={inputClass} /></label>
                        <label className="text-sm font-black">{tx('Spredaj mm', 'Front mm')}<input value={treadForm.front} onChange={(e) => setTreadForm((prev) => ({ ...prev, front: e.target.value }))} inputMode="decimal" className={inputClass} /></label>
                        <label className="text-sm font-black">{tx('Zadaj mm', 'Rear mm')}<input value={treadForm.rear} onChange={(e) => setTreadForm((prev) => ({ ...prev, rear: e.target.value }))} inputMode="decimal" className={inputClass} /></label>
                        <label className="text-sm font-black">{tx('Opomba', 'Note')}<input value={treadForm.note} onChange={(e) => setTreadForm((prev) => ({ ...prev, note: e.target.value }))} className={inputClass} /></label>
                        <button onClick={() => saveTreadMeasurement(item)} className="rounded-2xl bg-[#6c63ff] px-4 py-3 text-sm font-black text-white md:col-span-2">{tx('Shrani meritev', 'Save measurement')}</button>
                        <button onClick={() => setMeasuringTireId('')} className="rounded-2xl border border-[#30364c] px-4 py-3 text-sm font-black text-[#d8def0]">{tx('Prekliči', 'Cancel')}</button>
                      </div>
                    )}
                    {item.notes && <p className="mt-3 rounded-2xl bg-[#0b1020] p-3 text-sm font-semibold text-[#d8def0]">{item.notes}</p>}
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-6">
              <h2 className="mb-3 text-xl font-black">{tx('Gume v hrambi', 'Stored tires')}</h2>
              <div className="grid gap-3">
                {storedTires.length === 0 && <div className={cardClass}>{tx('Ni gum v hrambi.', 'No stored tires.')}</div>}
                {storedTires.map((item) => (
                  <div key={item.id} className={cardClass}>
                    <div className="flex items-start justify-between gap-3">
                      <TireSeasonIcon season={item.season} className="h-12 w-12 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black uppercase text-[#a09aff]">{seasonLabel(item.season)}</p>
                        <h3 className="mt-1 text-xl font-black">{[item.brand, item.model].filter(Boolean).join(' ') || tx('Gume', 'Tires')}</h3>
                        <p className="text-sm font-bold text-[#a8b0c0]">{[scopeLabel(item.tire_scope), item.size, item.dot].filter(Boolean).join(' · ')}</p>
                        <p className="mt-2 text-xs font-bold text-[#a8b0c0]">{seasonPeriodText(item.season)}</p>
                      </div>
                      <button
                        onClick={() => {
                          setMountingTireId(item.id)
                          setMountForm({ mountedAt: todayIso(), mountedKm: String(currentKm || ''), position: defaultPositionForScope(item.tire_scope || 'full_set') })
                        }}
                        className="rounded-xl border border-[#6c63ff66] bg-[#6c63ff22] px-3 py-2 text-xs font-black text-[#c8c4ff]"
                      >
                        {tx('Montiraj', 'Mount')}
                      </button>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-2xl bg-[#0b1020] p-3"><p className="text-[#a8b0c0]">{tx('Skupaj prevoženo', 'Total driven')}</p><p className="font-black">{formatKm(tireKm(item))}</p></div>
                      <div className="rounded-2xl bg-[#0b1020] p-3"><p className="text-[#a8b0c0]">{tx('Profil', 'Tread')}</p><p className="font-black">{treadStats(item).latest ? `${treadStats(item).latest?.toFixed(1)} mm` : '-'}</p></div>
                    </div>
                    <button onClick={() => openTreadMeasurement(item)} className="mt-3 rounded-xl border border-[#6c63ff66] bg-[#6c63ff22] px-3 py-2 text-xs font-black text-[#c8c4ff]">+ {tx('Meritev profila', 'Tread measurement')}</button>
                    {measuringTireId === item.id && (
                      <div className="mt-3 grid gap-3 rounded-2xl border border-[#30364c] bg-[#0b1020] p-3 md:grid-cols-3">
                        <label className="text-sm font-black">{tx('Datum', 'Date')}<input type="date" value={treadForm.measuredAt} onChange={(e) => setTreadForm((prev) => ({ ...prev, measuredAt: e.target.value }))} className={inputClass} /></label>
                        <label className="text-sm font-black">{tx('Km', 'Mileage')}<input value={treadForm.km} onChange={(e) => setTreadForm((prev) => ({ ...prev, km: e.target.value }))} inputMode="numeric" className={inputClass} /></label>
                        <label className="text-sm font-black">{tx('Povprečni profil mm', 'Average tread mm')}<input value={treadForm.tread} onChange={(e) => setTreadForm((prev) => ({ ...prev, tread: e.target.value }))} inputMode="decimal" className={inputClass} /></label>
                        <label className="text-sm font-black">{tx('Spredaj mm', 'Front mm')}<input value={treadForm.front} onChange={(e) => setTreadForm((prev) => ({ ...prev, front: e.target.value }))} inputMode="decimal" className={inputClass} /></label>
                        <label className="text-sm font-black">{tx('Zadaj mm', 'Rear mm')}<input value={treadForm.rear} onChange={(e) => setTreadForm((prev) => ({ ...prev, rear: e.target.value }))} inputMode="decimal" className={inputClass} /></label>
                        <label className="text-sm font-black">{tx('Opomba', 'Note')}<input value={treadForm.note} onChange={(e) => setTreadForm((prev) => ({ ...prev, note: e.target.value }))} className={inputClass} /></label>
                        <button onClick={() => saveTreadMeasurement(item)} className="rounded-2xl bg-[#6c63ff] px-4 py-3 text-sm font-black text-white md:col-span-2">{tx('Shrani meritev', 'Save measurement')}</button>
                        <button onClick={() => setMeasuringTireId('')} className="rounded-2xl border border-[#30364c] px-4 py-3 text-sm font-black text-[#d8def0]">{tx('Prekliči', 'Cancel')}</button>
                      </div>
                    )}
                    {mountingTireId === item.id && (
                      <div className="mt-4 grid gap-3 rounded-2xl border border-[#30364c] bg-[#0b1020] p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                        <label className="text-sm font-black">{tx('Datum montaže', 'Mount date')}<input type="date" value={mountForm.mountedAt} onChange={(e) => setMountForm((prev) => ({ ...prev, mountedAt: e.target.value }))} className={inputClass} /></label>
                        <label className="text-sm font-black">{tx('Km ob montaži', 'Mileage at mount')}<input value={mountForm.mountedKm} onChange={(e) => setMountForm((prev) => ({ ...prev, mountedKm: e.target.value }))} inputMode="numeric" className={inputClass} /></label>
                        <label className="text-sm font-black">{tx('Pozicija', 'Position')}<select value={item.tire_scope === 'full_set' ? 'all' : mountForm.position} disabled={item.tire_scope === 'full_set'} onChange={(e) => setMountForm((prev) => ({ ...prev, position: e.target.value }))} className={inputClass}><option value="all">{tx('Vse pozicije', 'All positions')}</option><option value="front">{tx('Spredaj', 'Front')}</option><option value="rear">{tx('Zadaj', 'Rear')}</option></select></label>
                        <button onClick={() => mountStoredTire(item)} className="self-end rounded-2xl bg-[#6c63ff] px-4 py-3 text-sm font-black text-white">{tx('Potrdi', 'Confirm')}</button>
                        {(numberOrNull(mountForm.mountedKm) ?? currentKm) < currentKm && (
                          <p className="text-xs font-bold text-[#fbbf24] md:col-span-4">
                            {tx('Ta montaža bo označena kot naknadno vnesena, ker so km nižji od trenutnega stanja vozila.', 'This mount will be marked as entered later because mileage is below the current vehicle mileage.')}
                          </p>
                        )}
                      </div>
                    )}
                    <button onClick={() => retireTireSet(item)} className="mt-3 rounded-xl border border-[#f59e0b66] bg-[#f59e0b14] px-3 py-2 text-xs font-black text-[#fbbf24]">{tx('Premakni v arhiv', 'Move to archive')}</button>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-black">{tx('Arhiv gum', 'Tire archive')}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {retiredTires.length === 0 && <div className={cardClass}>{tx('Arhiv je še prazen.', 'Archive is still empty.')}</div>}
                {retiredTires.map((item) => (
                  <div key={item.id} className={`${cardClass} opacity-90`}>
                    <TireSeasonIcon season={item.season} className="mb-2 h-10 w-10" />
                    <p className="text-xs font-black uppercase text-[#a8b0c0]">{seasonLabel(item.season)}</p>
                    <h3 className="mt-1 text-lg font-black">{[item.brand, item.model].filter(Boolean).join(' ') || tx('Gume', 'Tires')}</h3>
                    <p className="text-sm font-bold text-[#a8b0c0]">{[scopeLabel(item.tire_scope), item.size, item.dot].filter(Boolean).join(' · ')}</p>
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
