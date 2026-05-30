'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton, BottomNav } from '@/lib/nav'
import { getStoredLanguage, type Language } from '@/lib/i18n'

type BackupSettings = {
  frequency: 'off' | 'weekly' | 'monthly' | 'quarterly'
  lastBackupAt?: string
  lastDismissedAt?: string
}

const STORAGE_KEY = 'garagebase_backup_settings'

const defaultSettings: BackupSettings = {
  frequency: 'monthly',
}

const frequencies = [
  { value: 'off', sl: 'Izklopljeno', en: 'Off' },
  { value: 'weekly', sl: 'Vsak teden', en: 'Weekly' },
  { value: 'monthly', sl: 'Enkrat mesečno', en: 'Monthly' },
  { value: 'quarterly', sl: 'Vsake 3 mesece', en: 'Every 3 months' },
] as const

export default function BackupPage() {
  const [language, setLanguage] = useState<Language>('sl')
  const [settings, setSettings] = useState<BackupSettings>(defaultSettings)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [summary, setSummary] = useState<{ cars: number; rows: number } | null>(null)

  const tx = (sl: string, en: string) => language === 'en' ? en : sl

  useEffect(() => {
    setLanguage(getStoredLanguage())
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      setSettings({ ...defaultSettings, ...stored })
    } catch {
      setSettings(defaultSettings)
    }
  }, [])

  const lastBackupText = useMemo(() => {
    if (!settings.lastBackupAt) return tx('Backup še ni bil narejen.', 'No backup has been created yet.')
    return new Date(settings.lastBackupAt).toLocaleString(language === 'en' ? 'en-US' : 'sl-SI')
  }, [settings.lastBackupAt, language])

  const saveSettings = (next: BackupSettings) => {
    setSettings(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setMessage(tx('Nastavitev opomnika je shranjena.', 'Backup reminder setting saved.'))
  }

  const safeQuery = async (label: string, query: PromiseLike<any>) => {
    const result = await query
    if (result.error) {
      console.warn(`[GarageBase backup] ${label} skipped`, result.error)
      return []
    }
    return result.data || []
  }

  const downloadBackup = async () => {
    setLoading(true)
    setMessage('')
    setSummary(null)
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw new Error(tx('Uporabnik ni prijavljen.', 'User is not signed in.'))
      const user = userData.user

      const cars = await safeQuery('cars', supabase.from('cars').select('*').eq('user_id', user.id).order('created_at', { ascending: true }))
      const carIds = cars.map((car: any) => car.id).filter(Boolean)

      const [fuelLogs, serviceLogs, expenses, reminders, transfers, tireSets, tireMounts, mileageEvents] = carIds.length ? await Promise.all([
        safeQuery('fuel_logs', supabase.from('fuel_logs').select('*').in('car_id', carIds).order('datum', { ascending: true })),
        safeQuery('service_logs', supabase.from('service_logs').select('*').in('car_id', carIds).order('datum', { ascending: true })),
        safeQuery('expenses', supabase.from('expenses').select('*').in('car_id', carIds).order('datum', { ascending: true })),
        safeQuery('reminders', supabase.from('reminders').select('*').in('car_id', carIds).order('datum', { ascending: true })),
        safeQuery('vehicle_transfers', supabase.from('vehicle_transfers').select('id,car_id,mode,created_at,expires_at,used_at,status').in('car_id', carIds).order('created_at', { ascending: false })),
        safeQuery('tire_sets', supabase.from('tire_sets').select('*').in('car_id', carIds).order('created_at', { ascending: true })),
        safeQuery('tire_mounts', supabase.from('tire_mounts').select('*').in('car_id', carIds).order('mounted_at', { ascending: true })),
        safeQuery('vehicle_mileage_events', supabase.from('vehicle_mileage_events').select('*').in('car_id', carIds).order('event_date', { ascending: true })),
      ]) : [[], [], [], [], [], [], [], []]

      const localSettings = {
        garagebase_nastavitve: localStorage.getItem('garagebase_nastavitve'),
        garagebase_backup_settings: localStorage.getItem(STORAGE_KEY),
      }

      const payload = {
        app: 'GarageBase',
        version: 1,
        exported_at: new Date().toISOString(),
        user: {
          id: user.id,
          email: user.email || null,
        },
        note_sl: 'To je osebna varnostna kopija podatkov. Slike in dokumenti so izvoženi kot povezave, ne kot binarne datoteke.',
        note_en: 'This is a personal data backup. Images and documents are exported as links, not as binary files.',
        data: {
          cars,
          fuel_logs: fuelLogs,
          service_logs: serviceLogs,
          expenses,
          reminders,
          vehicle_transfers: transfers,
          tire_sets: tireSets,
          tire_mounts: tireMounts,
          vehicle_mileage_events: mileageEvents,
          local_settings: localSettings,
        },
      }

      const json = JSON.stringify(payload, null, 2)
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `garagebase-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      const next = { ...settings, lastBackupAt: new Date().toISOString(), lastDismissedAt: new Date().toISOString() }
      setSettings(next)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setSummary({ cars: cars.length, rows: fuelLogs.length + serviceLogs.length + expenses.length + reminders.length + tireSets.length + tireMounts.length + mileageEvents.length })
      setMessage(tx('Varnostna kopija je prenesena.', 'Backup downloaded.'))
    } catch (error: any) {
      setMessage(error.message || tx('Backup ni uspel.', 'Backup failed.'))
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#080810] px-4 pt-5 pb-28 text-white md:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <BackButton href="/vec" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#6c63ff]">GarageBase</p>
            <h1 className="mt-1 text-3xl font-black text-white">{tx('Varnostna kopija', 'Backup')}</h1>
            <p className="mt-1 text-sm font-semibold text-[#9b9bb8]">
              {tx('Prenesi svoje podatke in nastavi opomnik za redno shranjevanje.', 'Download your data and set a reminder for regular saving.')}
            </p>
          </div>
        </div>

        <section className="rounded-[28px] border border-[#242744] bg-[radial-gradient(circle_at_top_right,rgba(108,99,255,0.24),transparent_34%),#101020] p-5 shadow-2xl shadow-black/25">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-sm font-black text-[#3ecfcf]">{tx('Ročni izvoz', 'Manual export')}</p>
              <h2 className="mt-2 text-2xl font-black text-white">{tx('Moji GarageBase podatki', 'My GarageBase data')}</h2>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-[#c9c8dc]">
                {tx(
                  'Datoteka vsebuje vozila, gorivo, servise, stroške, opomnike, prenose zgodovine in lokalne nastavitve. Slike in PDF dokumenti so zapisani kot povezave.',
                  'The file contains vehicles, fuel, services, expenses, reminders, history transfers and local settings. Images and PDF documents are stored as links.'
                )}
              </p>
              <button
                onClick={downloadBackup}
                disabled={loading}
                className="mt-5 rounded-2xl bg-[#6c63ff] px-6 py-4 text-base font-black text-white shadow-xl shadow-[#6c63ff55] transition-transform active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? tx('Pripravljam backup...', 'Preparing backup...') : tx('Prenesi moje podatke', 'Download my data')}
              </button>
            </div>

            <div className="rounded-2xl border border-[#2a2a44] bg-[#151528] p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b8cff]">{tx('Opomnik', 'Reminder')}</p>
              <p className="mt-3 text-sm font-semibold text-[#c9c8dc]">{tx('Kako pogosto naj te GarageBase spomni?', 'How often should GarageBase remind you?')}</p>
              <div className="mt-3 grid gap-2">
                {frequencies.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => saveSettings({ ...settings, frequency: item.value })}
                    className={`rounded-xl border px-4 py-3 text-left text-sm font-black transition-colors ${
                      settings.frequency === item.value
                        ? 'border-[#6c63ff] bg-[#6c63ff22] text-white'
                        : 'border-[#2a2a44] bg-[#0f0f1a] text-[#b9b8d4]'
                    }`}
                  >
                    {language === 'en' ? item.en : item.sl}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs font-semibold leading-relaxed text-[#8f8fad]">
                {tx('Zadnji backup:', 'Last backup:')} {lastBackupText}
              </p>
            </div>
          </div>
        </section>

        {message && (
          <div className="mt-4 rounded-2xl border border-[#3ecfcf55] bg-[#3ecfcf18] p-4 text-sm font-bold text-[#8ff5f5]">
            {message}
            {summary && (
              <span className="ml-2 text-[#d8ffff]">
                {tx(`${summary.cars} vozil, ${summary.rows} zapisov.`, `${summary.cars} vehicles, ${summary.rows} records.`)}
              </span>
            )}
          </div>
        )}
      </div>
      <BottomNav aktivna="nastavitve" />
    </div>
  )
}
