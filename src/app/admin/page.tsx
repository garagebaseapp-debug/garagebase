'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton } from '@/lib/nav'
import { useLanguage } from '@/lib/i18n'

type StatCard = {
  label: string
  value: string | number
  hint: string
  color: string
}

const statusLabel: Record<string, { sl: string; en: string }> = {
  new: { sl: 'Novo', en: 'New' },
  planned: { sl: 'Planirano', en: 'Planned' },
  done: { sl: 'Reseno', en: 'Done' },
  rejected: { sl: 'Zavrnjeno', en: 'Rejected' },
}

export default function AdminPage() {
  const { language } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [message, setMessage] = useState('')
  const [stats, setStats] = useState<any>({
    cars: 0,
    users: 0,
    fuel: 0,
    services: 0,
    expenses: 0,
    push: 0,
    transfers: 0,
    feedback: 0,
    newFeedback: 0,
  })
  const [recentFeedback, setRecentFeedback] = useState<any[]>([])
  const [recentCars, setRecentCars] = useState<any[]>([])

  const tx = (sl: string, en: string) => language === 'en' ? en : sl

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        window.location.href = '/'
        return
      }

      const { data: adminRow, error: adminError } = await supabase
        .from('admin_users')
        .select('email')
        .eq('email', user.email)
        .maybeSingle()

      if (adminError || !adminRow) {
        setIsAdmin(false)
        setMessage(tx('Ta racun nima admin dostopa.', 'This account does not have admin access.'))
        setLoading(false)
        return
      }

      setIsAdmin(true)
      await loadAdminData()
      setLoading(false)
    }
    init()
  }, [])

  const countTable = async (table: string) => {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    if (error) throw error
    return count || 0
  }

  const loadAdminData = async () => {
    setMessage('')
    try {
      const [
        carsCount,
        fuelCount,
        servicesCount,
        expensesCount,
        pushCount,
        transfersCount,
        feedbackCount,
        carsData,
        feedbackData,
      ] = await Promise.all([
        countTable('cars'),
        countTable('fuel_logs'),
        countTable('service_logs'),
        countTable('expenses'),
        countTable('push_subscriptions'),
        countTable('vehicle_transfers'),
        countTable('feedback'),
        supabase.from('cars').select('id,user_id,znamka,model,tip_vozila,created_at').order('created_at', { ascending: false }).limit(8),
        supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(8),
      ])

      if (carsData.error) throw carsData.error
      if (feedbackData.error) throw feedbackData.error

      const uniqueUsers = new Set((carsData.data || []).map((car: any) => car.user_id).filter(Boolean))
      const newFeedback = (feedbackData.data || []).filter((item: any) => item.status === 'new').length

      setStats({
        cars: carsCount,
        users: uniqueUsers.size,
        fuel: fuelCount,
        services: servicesCount,
        expenses: expensesCount,
        push: pushCount,
        transfers: transfersCount,
        feedback: feedbackCount,
        newFeedback,
      })
      setRecentCars(carsData.data || [])
      setRecentFeedback(feedbackData.data || [])
    } catch (error: any) {
      setMessage(tx(
        'Admin statistika se ni dostopna. Zazeni posodobljen SQL SUPABASE_MIGRACIJA_ADMIN_FEEDBACK.sql.',
        'Admin statistics are not available yet. Run the updated SUPABASE_MIGRACIJA_ADMIN_FEEDBACK.sql.'
      ) + ` ${error.message || ''}`)
    }
  }

  const statCards: StatCard[] = useMemo(() => [
    { label: tx('Vozila', 'Vehicles'), value: stats.cars, hint: tx('vsa vozila v sistemu', 'all vehicles in the system'), color: 'text-[#a09aff]' },
    { label: tx('Znani uporabniki', 'Known users'), value: stats.users, hint: tx('iz zadnjih vozil', 'from recent vehicles'), color: 'text-[#3ecfcf]' },
    { label: tx('Tankanja', 'Fill-ups'), value: stats.fuel, hint: tx('vnosi goriva', 'fuel entries'), color: 'text-[#3ecfcf]' },
    { label: tx('Servisi', 'Services'), value: stats.services, hint: tx('servisni vnosi', 'service entries'), color: 'text-[#f59e0b]' },
    { label: tx('Stroski', 'Expenses'), value: stats.expenses, hint: tx('dodatni stroski', 'additional expenses'), color: 'text-[#a09aff]' },
    { label: tx('Push naprave', 'Push devices'), value: stats.push, hint: tx('naročene naprave', 'subscribed devices'), color: 'text-[#4ade80]' },
    { label: tx('QR prenosi', 'QR transfers'), value: stats.transfers, hint: tx('ustvarjene QR kode', 'created QR codes'), color: 'text-[#fca5a5]' },
    { label: tx('Feedback', 'Feedback'), value: stats.feedback, hint: `${stats.newFeedback} ${tx('novih', 'new')}`, color: 'text-[#f59e0b]' },
  ], [stats, language])

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">{tx('Nalaganje...', 'Loading...')}</p>
    </div>
  )

  if (!isAdmin) return (
    <div className="min-h-screen bg-[#080810] px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <BackButton href="/nastavitve" />
        <h1 className="text-xl font-bold text-white">Admin</h1>
      </div>
      <div className="rounded-2xl border border-[#ef444455] bg-[#ef444418] p-5 text-[#fca5a5]">
        {message}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <BackButton href="/nastavitve" />
          <div>
            <h1 className="text-xl font-bold text-white">GarageBase Admin</h1>
            <p className="text-[#5a5a80] text-sm">{tx('Osnovni pregled sistema.', 'Basic system overview.')}</p>
          </div>
        </div>
        <button onClick={loadAdminData}
          className="rounded-xl border border-[#6c63ff66] bg-[#6c63ff22] px-4 py-2 text-sm font-semibold text-[#a09aff]">
          {tx('Osvezi', 'Refresh')}
        </button>
      </div>

      {message && (
        <div className="mb-4 rounded-xl border border-[#f59e0b55] bg-[#f59e0b18] p-4 text-sm text-[#f59e0b]">
          {message}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-4">
            <p className="text-[#5a5a80] text-xs uppercase tracking-wider">{card.label}</p>
            <p className={`mt-2 text-3xl font-black ${card.color}`}>{card.value}</p>
            <p className="mt-1 text-xs text-[#5a5a80]">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold">{tx('Zadnji predlogi', 'Recent suggestions')}</h2>
              <p className="text-[#5a5a80] text-xs">{tx('Hiter pogled na feedback.', 'Quick look at feedback.')}</p>
            </div>
            <button onClick={() => window.location.href = '/admin-feedback'}
              className="rounded-xl bg-[#6c63ff] px-3 py-2 text-xs font-semibold text-white">
              {tx('Odpri vse', 'Open all')}
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {recentFeedback.length === 0 ? (
              <p className="rounded-xl bg-[#13131f] p-4 text-sm text-[#5a5a80]">{tx('Ni predlogov.', 'No suggestions.')}</p>
            ) : recentFeedback.map((item) => (
              <div key={item.id} className="rounded-xl bg-[#13131f] p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-white text-sm font-semibold">{item.feature_description}</p>
                  <span className="shrink-0 rounded-full bg-[#6c63ff22] px-2 py-1 text-[10px] font-bold text-[#a09aff]">
                    {statusLabel[item.status]?.[language] || item.status}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[#5a5a80]">{item.usefulness_reason}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
          <h2 className="text-white font-bold">{tx('Zadnja vozila', 'Recent vehicles')}</h2>
          <p className="mb-4 text-[#5a5a80] text-xs">{tx('Zadnja dodana vozila v sistemu.', 'Latest vehicles added to the system.')}</p>
          <div className="flex flex-col gap-3">
            {recentCars.length === 0 ? (
              <p className="rounded-xl bg-[#13131f] p-4 text-sm text-[#5a5a80]">{tx('Ni vozil.', 'No vehicles.')}</p>
            ) : recentCars.map((car) => (
              <div key={car.id} className="flex items-center justify-between rounded-xl bg-[#13131f] p-3">
                <div>
                  <p className="text-white text-sm font-semibold">{car.znamka} {car.model}</p>
                  <p className="text-[#5a5a80] text-xs">{car.tip_vozila || tx('Vozilo', 'Vehicle')}</p>
                </div>
                <p className="text-right text-[11px] text-[#5a5a80]">
                  {car.created_at ? new Date(car.created_at).toLocaleDateString(language === 'en' ? 'en-US' : 'sl-SI') : '-'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
