'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton } from '@/lib/nav'
import { useLanguage } from '@/lib/i18n'
import { checkCurrentUserAdmin } from '@/lib/admin-access'

const statuses = [
  { value: 'new', sl: 'Novo', en: 'New', color: 'text-[#3ecfcf]', bg: 'bg-[#3ecfcf18] border-[#3ecfcf55]' },
  { value: 'checking', sl: 'Preverjam', en: 'Checking', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b18] border-[#f59e0b55]' },
  { value: 'fixed', sl: 'Popravljeno', en: 'Fixed', color: 'text-[#4ade80]', bg: 'bg-[#16a34a18] border-[#16a34a55]' },
]

const statusReply: Record<string, { sl: string; en: string }> = {
  new: {
    sl: 'Prijavo napake smo prejeli in caka prvi pregled.',
    en: 'We received the bug report and it is waiting for first review.',
  },
  checking: {
    sl: 'Napako preverjamo. Najprej poskusamo ponoviti tezavo in oceniti vpliv na stabilnost.',
    en: 'We are checking the bug. First we try to reproduce it and assess the stability impact.',
  },
  fixed: {
    sl: 'Napaka je oznacena kot popravljena. Popravek bo uporabljen v aplikaciji po naslednji objavi.',
    en: 'The bug is marked as fixed. The fix will be available in the app after the next release.',
  },
}

export default function AdminNapakePage() {
  const { language } = useLanguage()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const tx = (sl: string, en: string) => language === 'en' ? en : sl

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('bug_reports').select('*').order('created_at', { ascending: false }).limit(200)
    if (error) {
      setMessage(tx('Napake se še ne berejo. Zaženi SQL SUPABASE_MIGRACIJA_BUG_REPORTS.sql.', 'Bug reports are not available yet. Run SUPABASE_MIGRACIJA_BUG_REPORTS.sql.') + ` ${error.message}`)
      setItems([])
    } else {
      setItems(data || [])
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
        setMessage(tx('Ta račun nima admin dostopa.', 'This account does not have admin access.'))
        setLoading(false)
        return
      }
      await load()
    }
    init()
  }, [])

  const updateStatus = async (id: string, status: string) => {
    const previous = items
    setItems(items.map((item) => item.id === id ? { ...item, status } : item))
    const { error } = await supabase.from('bug_reports').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) {
      setItems(previous)
      setMessage(tx('Statusa ni bilo mogoče shraniti.', 'Could not save the status.'))
    }
  }

  const filtered = filter === 'all' ? items : items.filter((item) => item.status === filter)

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">{tx('Nalaganje...', 'Loading...')}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">
      <div className="mb-6 flex items-center gap-3">
        <BackButton href="/admin" />
        <div>
          <h1 className="text-xl font-bold text-white">{tx('Admin napake', 'Admin bugs')}</h1>
          <p className="text-sm text-[#5a5a80]">{tx('Prijave napak uporabnikov z opisom in napravo.', 'User bug reports with description and device info.')}</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <button onClick={() => setFilter('all')} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${filter === 'all' ? 'border-[#6c63ff66] bg-[#6c63ff22] text-[#a09aff]' : 'border-[#1e1e32] bg-[#0f0f1a] text-[#5a5a80]'}`}>
          {tx('Vse', 'All')} · {items.length}
        </button>
        {statuses.map((status) => (
          <button key={status.value} onClick={() => setFilter(status.value)}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${filter === status.value ? `${status.bg} ${status.color}` : 'border-[#1e1e32] bg-[#0f0f1a] text-[#5a5a80]'}`}>
            {language === 'en' ? status.en : status.sl} · {items.filter((item) => item.status === status.value).length}
          </button>
        ))}
      </div>

      {message && <div className="mb-4 rounded-xl border border-[#f59e0b55] bg-[#f59e0b18] p-4 text-sm text-[#f59e0b]">{message}</div>}

      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-6 text-center text-[#5a5a80]">
            {tx('Ni prijav napak.', 'No bug reports.')}
          </div>
        ) : filtered.map((item, index) => {
          const status = statuses.find((s) => s.value === item.status) || statuses[0]
          const isOpen = openId === item.id
          return (
            <div key={item.id} className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ef4444]">{tx(`Napaka ${index + 1}`, `Error ${index + 1}`)}</p>
                  <button onClick={() => setOpenId(isOpen ? null : item.id)} className="mt-1 text-left text-lg font-bold text-white underline-offset-4 hover:underline">
                    {item.title}
                  </button>
                  <p className="mt-1 text-xs text-[#5a5a80]">{item.email || '-'} · {new Date(item.created_at).toLocaleString(language === 'en' ? 'en-US' : 'sl-SI')}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${status.bg} ${status.color}`}>
                  {language === 'en' ? status.en : status.sl}
                </span>
              </div>
              {isOpen && (
                <>
              <div className="grid gap-3 lg:grid-cols-2">
                <Info label={tx('Opis', 'Description')} value={item.description} />
                <Info label={tx('Koraki', 'Steps')} value={item.steps} />
                <Info label={tx('Pričakovano', 'Expected')} value={item.expected} />
                <Info label={tx('Dejansko', 'Actual')} value={item.actual} />
                <Info label={tx('Področje', 'Area')} value={`${item.area || '-'} / ${item.priority || '-'}`} />
                <Info label={tx('Naprava', 'Device')} value={item.device_info} />
                <Info label={tx('Verzija', 'Version')} value={`${item.app_version || item.metadata?.appVersion || '-'} / ${item.release_channel || item.metadata?.releaseChannel || '-'}`} />
                <Info label={tx('Zadnji dogodki', 'Recent events')} value={(item.metadata?.recentEvents || []).map((event: any) => `${event.createdAt} ${event.eventName} ${event.pagePath || ''}`).join('\n')} />
              </div>
              {item.page_url && <p className="mt-3 break-all text-xs text-[#5a5a80]">{item.page_url}</p>}
                </>
              )}
              <p className="mt-3 rounded-xl border border-[#6c63ff44] bg-[#6c63ff14] p-3 text-xs font-semibold leading-relaxed text-[#a09aff]">
                {statusReply[item.status]?.[language] || statusReply.new[language]}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {statuses.map((option) => (
                  <button key={option.value} onClick={() => updateStatus(item.id, option.value)}
                    className={`rounded-xl border px-2 py-2 text-xs font-semibold ${item.status === option.value ? `${option.bg} ${option.color}` : 'border-[#1e1e32] bg-[#13131f] text-[#5a5a80]'}`}>
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

function Info({ label, value }: { label: string, value?: string | null }) {
  return (
    <div className="rounded-xl bg-[#13131f] p-3">
      <p className="mb-1 text-[11px] uppercase tracking-wider text-[#5a5a80]">{label}</p>
      <p className="whitespace-pre-wrap text-sm text-[#d7d7ea]">{value || '-'}</p>
    </div>
  )
}
