'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton } from '@/lib/nav'
import { useLanguage } from '@/lib/i18n'

const statusOptions = [
  { value: 'new', sl: 'Novo', en: 'New', color: 'text-[#3ecfcf]', bg: 'bg-[#3ecfcf18] border-[#3ecfcf55]' },
  { value: 'planned', sl: 'Planirano', en: 'Planned', color: 'text-[#a09aff]', bg: 'bg-[#6c63ff18] border-[#6c63ff55]' },
  { value: 'done', sl: 'Reseno', en: 'Done', color: 'text-[#4ade80]', bg: 'bg-[#16a34a18] border-[#16a34a55]' },
  { value: 'rejected', sl: 'Zavrnjeno', en: 'Rejected', color: 'text-[#fca5a5]', bg: 'bg-[#ef444418] border-[#ef444455]' },
]

const labels: any = {
  daily: { sl: 'Vsak dan', en: 'Every day' },
  weekly: { sl: 'Vsak teden', en: 'Every week' },
  monthly: { sl: 'Obcasno', en: 'Sometimes' },
  rarely: { sl: 'Redko', en: 'Rarely' },
  personal: { sl: 'Osebno', en: 'Personal' },
  company: { sl: 'Podjetje', en: 'Company' },
  both: { sl: 'Oboje', en: 'Both' },
  low: { sl: 'Nizko', en: 'Low' },
  normal: { sl: 'Srednje', en: 'Normal' },
  high: { sl: 'Visoko', en: 'High' },
}

export default function AdminFeedbackPage() {
  const { language } = useLanguage()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState('all')

  const tx = (sl: string, en: string) => language === 'en' ? en : sl
  const pick = (value: string) => labels[value]?.[language] || value

  const filtered = useMemo(() => (
    filter === 'all' ? items : items.filter((item) => item.status === filter)
  ), [items, filter])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/'
        return
      }
      await loadFeedback()
    }
    init()
  }, [])

  const loadFeedback = async () => {
    setLoading(true)
    setMessage('')
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(tx(
        'Admin dostop se ni vklopljen. Za to stran zazeni SQL SUPABASE_MIGRACIJA_ADMIN_FEEDBACK.sql.',
        'Admin access is not enabled yet. Run SUPABASE_MIGRACIJA_ADMIN_FEEDBACK.sql for this page.'
      ))
      setItems([])
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }

  const updateStatus = async (id: string, status: string) => {
    const previous = items
    setItems(items.map((item) => item.id === id ? { ...item, status } : item))
    const { error } = await supabase.from('feedback').update({ status }).eq('id', id)
    if (error) {
      setItems(previous)
      setMessage(tx('Statusa ni bilo mogoce shraniti.', 'Could not save the status.'))
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">{tx('Nalaganje...', 'Loading...')}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <BackButton href="/nastavitve" />
        <div>
          <h1 className="text-xl font-bold text-white">Admin feedback</h1>
          <p className="text-[#5a5a80] text-sm">{tx('Pregled predlogov uporabnikov.', 'User suggestion inbox.')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <button onClick={() => setFilter('all')} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${filter === 'all' ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]' : 'bg-[#0f0f1a] border-[#1e1e32] text-[#5a5a80]'}`}>
          {tx('Vse', 'All')} · {items.length}
        </button>
        {statusOptions.map((status) => (
          <button key={status.value} onClick={() => setFilter(status.value)}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${filter === status.value ? status.bg + ' ' + status.color : 'bg-[#0f0f1a] border-[#1e1e32] text-[#5a5a80]'}`}>
            {language === 'en' ? status.en : status.sl} · {items.filter((item) => item.status === status.value).length}
          </button>
        ))}
      </div>

      {message && (
        <div className="mb-4 rounded-xl border border-[#f59e0b55] bg-[#f59e0b18] p-4 text-sm text-[#f59e0b]">
          {message}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-6 text-center text-[#5a5a80]">
            {tx('Ni predlogov.', 'No suggestions.')}
          </div>
        ) : filtered.map((item) => {
          const status = statusOptions.find((s) => s.value === item.status) || statusOptions[0]
          return (
            <div key={item.id} className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-white font-bold">{item.feature_description}</p>
                  <p className="text-[#5a5a80] text-xs mt-1">{new Date(item.created_at).toLocaleString(language === 'en' ? 'en-US' : 'sl-SI')}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${status.bg} ${status.color}`}>
                  {language === 'en' ? status.en : status.sl}
                </span>
              </div>

              <p className="text-[#d7d7ea] text-sm mb-3">{item.usefulness_reason}</p>

              <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                <div className="rounded-xl bg-[#13131f] p-3">
                  <p className="text-[#5a5a80] uppercase mb-1">{tx('Uporaba', 'Usage')}</p>
                  <p className="text-white font-semibold">{pick(item.usage_frequency)}</p>
                </div>
                <div className="rounded-xl bg-[#13131f] p-3">
                  <p className="text-[#5a5a80] uppercase mb-1">{tx('Tip', 'Type')}</p>
                  <p className="text-white font-semibold">{pick(item.user_type)}</p>
                </div>
                <div className="rounded-xl bg-[#13131f] p-3">
                  <p className="text-[#5a5a80] uppercase mb-1">{tx('Prioriteta', 'Priority')}</p>
                  <p className="text-white font-semibold">{pick(item.priority)}</p>
                </div>
              </div>

              {item.page_context && (
                <p className="mb-3 break-all text-[11px] text-[#5a5a80]">{item.page_context}</p>
              )}

              <div className="grid grid-cols-4 gap-2">
                {statusOptions.map((option) => (
                  <button key={option.value} onClick={() => updateStatus(item.id, option.value)}
                    className={`rounded-xl border px-2 py-2 text-xs font-semibold ${item.status === option.value ? option.bg + ' ' + option.color : 'border-[#1e1e32] bg-[#13131f] text-[#5a5a80]'}`}>
                    {language === 'en' ? option.en : option.sl}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
