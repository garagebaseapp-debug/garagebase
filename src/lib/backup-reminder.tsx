'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getStoredLanguage } from '@/lib/i18n'

type BackupSettings = {
  frequency?: 'off' | 'weekly' | 'monthly' | 'quarterly'
  lastBackupAt?: string
  lastDismissedAt?: string
}

const STORAGE_KEY = 'garagebase_backup_settings'
const DAY = 24 * 60 * 60 * 1000

const intervalDays: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
}

const readSettings = (): BackupSettings => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

const isDue = (settings: BackupSettings) => {
  const frequency = settings.frequency || 'off'
  if (frequency === 'off') return false
  const days = intervalDays[frequency]
  if (!days) return false
  const lastBackup = settings.lastBackupAt ? new Date(settings.lastBackupAt).getTime() : 0
  const lastDismissed = settings.lastDismissedAt ? new Date(settings.lastDismissedAt).getTime() : 0
  const now = Date.now()
  if (lastDismissed && now - lastDismissed < DAY) return false
  if (!lastBackup) return true
  return now - lastBackup >= days * DAY
}

export function BackupReminder() {
  const [visible, setVisible] = useState(false)
  const [language, setLanguage] = useState<'sl' | 'en'>('sl')

  const tx = (sl: string, en: string) => language === 'en' ? en : sl

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      if (typeof window === 'undefined') return
      const path = window.location.pathname
      if (path === '/' || path.startsWith('/login') || path.startsWith('/privacy') || path.startsWith('/terms')) return
      const session = await supabase.auth.getSession()
      if (cancelled || !session.data.session?.user) return
      setLanguage(getStoredLanguage() === 'en' ? 'en' : 'sl')
      setVisible(isDue(readSettings()))
    }
    check()
    return () => { cancelled = true }
  }, [])

  const dismiss = () => {
    const current = readSettings()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, lastDismissedAt: new Date().toISOString() }))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[90] md:left-auto md:right-5 md:w-[380px]">
      <div className="rounded-2xl border border-[#6c63ff55] bg-[#101020] p-4 text-white shadow-2xl shadow-black/35">
        <p className="text-sm font-black">{tx('Čas je za varnostno kopijo.', 'Time for a backup.')}</p>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-[#b9b8d4]">
          {tx('Prenesi svoje GarageBase podatke v JSON datoteko.', 'Download your GarageBase data as a JSON file.')}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => { window.location.href = '/varnostna-kopija' }}
            className="flex-1 rounded-xl bg-[#6c63ff] px-3 py-2 text-xs font-black text-white shadow-lg shadow-[#6c63ff44]"
          >
            {tx('Odpri backup', 'Open backup')}
          </button>
          <button
            onClick={dismiss}
            className="rounded-xl border border-[#2a2a44] bg-[#181827] px-3 py-2 text-xs font-black text-[#d8d8e8]"
          >
            {tx('Kasneje', 'Later')}
          </button>
        </div>
      </div>
    </div>
  )
}
