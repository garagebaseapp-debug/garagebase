'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton } from '@/lib/nav'
import { useLanguage } from '@/lib/i18n'
import { checkCurrentUserAdmin } from '@/lib/admin-access'

const statusOptions = [
  { value: 'new', sl: 'Novo', en: 'New', color: 'text-[#3ecfcf]', bg: 'bg-[#3ecfcf18] border-[#3ecfcf55]' },
  { value: 'reviewing', sl: 'V razmisleku', en: 'Under review', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b18] border-[#f59e0b55]' },
  { value: 'planned', sl: 'Planirano', en: 'Planned', color: 'text-[#a09aff]', bg: 'bg-[#6c63ff18] border-[#6c63ff55]' },
  { value: 'done', sl: 'Reseno', en: 'Done', color: 'text-[#4ade80]', bg: 'bg-[#16a34a18] border-[#16a34a55]' },
  { value: 'rejected', sl: 'Zavrnjeno', en: 'Rejected', color: 'text-[#fca5a5]', bg: 'bg-[#ef444418] border-[#ef444455]' },
]

const statusReply: Record<string, { sl: string; en: string }> = {
  new: {
    sl: 'Predlog smo prejeli in caka prvi pregled.',
    en: 'We received the suggestion and it is waiting for first review.',
  },
  reviewing: {
    sl: 'Predlog smo pogledali in ga imamo v razmisleku. Trenutno preverjamo, ali se ujema z razvojem aplikacije.',
    en: 'We reviewed the suggestion and are considering it. We are checking whether it fits the app roadmap.',
  },
  planned: {
    sl: 'Predlog je sprejet v nacrt. Uvrstili ga bomo med prihodnje izboljsave, ko pride na vrsto.',
    en: 'The suggestion is accepted into the plan. We will add it to future improvements when it comes up.',
  },
  done: {
    sl: 'Predlog je obravnavan in resen. Hvala, ker si pomagal izboljsati GarageBase.',
    en: 'The suggestion has been reviewed and completed. Thank you for helping improve GarageBase.',
  },
  rejected: {
    sl: 'Predlog smo pregledali, vendar ga trenutno ne bomo dodali. Razlog je lahko stabilnost, zasebnost ali fokus aplikacije.',
    en: 'We reviewed the suggestion, but we will not add it right now. The reason may be stability, privacy or app focus.',
  },
}

type FeedbackItem = {
  id: string
  status?: string
  feature_description?: string
  usefulness_reason?: string
  usage_frequency?: string
  user_type?: string
  priority?: string
  page_context?: string | null
  created_at: string
}

const labels: Record<string, { sl: string; en: string }> = {
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
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const tx = (sl: string, en: string) => language === 'en' ? en : sl
  const pick = (value?: string | null) => labels[value || '']?.[language] || value || '-'

  const filtered = useMemo(() => (
    filter === 'all' ? items : items.filter((item) => item.status === filter)
  ), [items, filter])

  async function loadFeedback() {
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
      setItems((data || []) as FeedbackItem[])
    }
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      const adminCheck = await checkCurrentUserAdmin()
      if (!adminCheck.user) {
        window.location.href = '/'
        return
      }
      if (!adminCheck.isAdmin) {
        setMessage(tx('Ta racun nima admin dostopa.', 'This account does not have admin access.'))
        setLoading(false)
        return
      }
      await loadFeedback()
    }
    init()
  }, [])

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
        <BackButton href="/admin" />
        <div>
          <h1 className="text-xl font-bold text-white">Admin feedback</h1>
          <p className="text-[#8a8aa8] text-sm">{tx('Pregled predlogov uporabnikov.', 'User suggestion inbox.')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
        <button onClick={() => setFilter('all')} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${filter === 'all' ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#d7d2ff]' : 'bg-[#0f0f1a] border-[#2a2a44] text-[#d8d8e8]'}`}>
          {tx('Vse', 'All')} · {items.length}
        </button>
        {statusOptions.map((status) => (
          <button key={status.value} onClick={() => setFilter(status.value)}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${filter === status.value ? status.bg + ' ' + status.color : 'bg-[#0f0f1a] border-[#2a2a44] text-[#d8d8e8]'}`}>
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
          <div className="rounded-2xl border border-[#2a2a44] bg-[#0f0f1a] p-6 text-center text-[#c7c7d8]">
            {tx('Ni predlogov.', 'No suggestions.')}
          </div>
        ) : filtered.map((item, index) => {
          const status = statusOptions.find((s) => s.value === item.status) || statusOptions[0]
          const isOpen = openId === item.id
          return (
            <div key={item.id} className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5 shadow-xl shadow-black/20">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6c63ff]">{tx(`Predlog ${index + 1}`, `Suggestion ${index + 1}`)}</p>
                  <button onClick={() => setOpenId(isOpen ? null : item.id)} className="mt-1 text-left text-lg font-black text-white underline-offset-4 hover:underline">
                    {item.feature_description}
                  </button>
                  <p className="text-[#8a8aa8] text-xs mt-1">{new Date(item.created_at).toLocaleString(language === 'en' ? 'en-US' : 'sl-SI')}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${status.bg} ${status.color}`}>
                  {language === 'en' ? status.en : status.sl}
                </span>
              </div>

              {isOpen && (
                <>
                  <p className="rounded-2xl border border-[#1e1e32] bg-[#13131f] p-4 text-sm font-semibold leading-relaxed text-white mb-3">{item.usefulness_reason}</p>

                  <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                <div className="rounded-xl bg-[#13131f] p-3">
                  <p className="text-[#8a8aa8] uppercase mb-1">{tx('Uporaba', 'Usage')}</p>
                  <p className="text-white font-semibold">{pick(item.usage_frequency)}</p>
                </div>
                <div className="rounded-xl bg-[#13131f] p-3">
                  <p className="text-[#8a8aa8] uppercase mb-1">{tx('Tip', 'Type')}</p>
                  <p className="text-white font-semibold">{pick(item.user_type)}</p>
                </div>
                <div className="rounded-xl bg-[#13131f] p-3">
                  <p className="text-[#8a8aa8] uppercase mb-1">{tx('Prioriteta', 'Priority')}</p>
                  <p className="text-white font-semibold">{pick(item.priority)}</p>
                </div>
                  </div>

                  {item.page_context && (
                    <p className="mb-3 break-all rounded-xl bg-[#13131f] p-3 text-[11px] font-semibold text-[#8a8aa8]">{item.page_context}</p>
                  )}
                </>
              )}

              <div className="mb-3 rounded-xl border border-[#6c63ff44] bg-[#6c63ff14] p-3 text-xs font-semibold leading-relaxed text-[#a09aff]">
                {statusReply[item.status || 'new']?.[language] || statusReply.new[language]}
              </div>

              <div className="grid grid-cols-5 gap-2">
                {statusOptions.map((option) => (
                  <button key={option.value} onClick={() => updateStatus(item.id, option.value)}
                    className={`rounded-xl border px-2 py-2 text-xs font-semibold ${item.status === option.value ? option.bg + ' ' + option.color : 'border-[#1e1e32] bg-[#13131f] text-[#d8d8e8]'}`}>
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
