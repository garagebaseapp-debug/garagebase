'use client'

import { useEffect, useState } from 'react'
import { subscribeOfflineQueue, syncOfflineQueue } from '@/lib/offline-queue'
import { useLanguage } from '@/lib/i18n'

export function OfflineSync() {
  const { language } = useLanguage()
  const [pending, setPending] = useState(0)
  const [failed, setFailed] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [online, setOnline] = useState(true)
  const tx = (sl: string, en: string) => language === 'en' ? en : sl

  useEffect(() => {
    setOnline(navigator.onLine)
    const unsubscribe = subscribeOfflineQueue((detail) => {
      setPending(detail.pending)
      setFailed(detail.failed)
      setSyncing(detail.syncing)
    })

    const sync = () => {
      setOnline(navigator.onLine)
      if (navigator.onLine) void syncOfflineQueue()
    }
    const onlineHandler = () => sync()
    const offlineHandler = () => setOnline(false)
    const interval = window.setInterval(sync, 45_000)

    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
    sync()

    return () => {
      unsubscribe()
      window.clearInterval(interval)
      window.removeEventListener('online', onlineHandler)
      window.removeEventListener('offline', offlineHandler)
    }
  }, [])

  if (pending === 0 && failed === 0) return null

  return (
    <button
      type="button"
      onClick={() => void syncOfflineQueue()}
      className={`fixed left-4 right-4 bottom-24 z-[95] rounded-2xl border px-4 py-3 text-left text-xs font-black shadow-2xl md:left-auto md:right-6 md:w-96 ${
        failed > 0
          ? 'border-[#f59e0b66] bg-[#2a1604] text-[#fbbf24]'
          : 'border-[#6c63ff66] bg-[#17122c] text-[#ded9ff]'
      }`}
    >
      {syncing
        ? tx('Sinhroniziram offline vnose...', 'Syncing offline entries...')
        : online
          ? tx(`${pending} vnosov čaka na sinhronizacijo. Tapni za poskus.`, `${pending} entries are waiting to sync. Tap to retry.`)
          : tx(`${pending} vnosov je shranjenih lokalno. Sinhronizacija se nadaljuje ob internetu.`, `${pending} entries are saved locally. Sync will continue when internet returns.`)}
      {failed > 0 && (
        <span className="mt-1 block text-[11px] font-bold opacity-90">
          {tx(`${failed} vnosov potrebuje ponoven poskus.`, `${failed} entries need another retry.`)}
        </span>
      )}
    </button>
  )
}
