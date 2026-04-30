'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton, BottomNav } from '@/lib/nav'
import { useLanguage } from '@/lib/i18n'
import { trackEvent } from '@/lib/analytics'

const areas = [
  { value: 'garage', sl: 'Garaža', en: 'Garage' },
  { value: 'fuel', sl: 'Gorivo', en: 'Fuel' },
  { value: 'service', sl: 'Servis', en: 'Service' },
  { value: 'costs', sl: 'Stroški', en: 'Costs' },
  { value: 'report', sl: 'PDF / QR report', en: 'PDF / QR report' },
  { value: 'notifications', sl: 'Obvestila', en: 'Notifications' },
  { value: 'settings', sl: 'Nastavitve', en: 'Settings' },
  { value: 'other', sl: 'Drugo', en: 'Other' },
]

const priorities = [
  { value: 'low', sl: 'Ni nujno', en: 'Not urgent' },
  { value: 'normal', sl: 'Moti uporabo', en: 'Affects use' },
  { value: 'high', sl: 'Ne morem nadaljevati', en: 'Blocking' },
]

export default function PrijavaNapakePage() {
  const { language } = useLanguage()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [area, setArea] = useState('garage')
  const [priority, setPriority] = useState('normal')
  const [steps, setSteps] = useState('')
  const [expected, setExpected] = useState('')
  const [actual, setActual] = useState('')

  const tx = (sl: string, en: string) => language === 'en' ? en : sl

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/'
        return
      }
      setUser(user)
      trackEvent('bug_report_open')
      setLoading(false)
    }
    init()
  }, [])

  const submit = async () => {
    setMessage('')
    if (!title.trim() || !description.trim()) {
      setMessage(tx('Vnesi kratek naslov in opis napake.', 'Enter a short title and bug description.'))
      return
    }
    setSaving(true)
    const deviceInfo = typeof window !== 'undefined'
      ? `${navigator.userAgent} | ${window.innerWidth}x${window.innerHeight}`
      : null
    const { error } = await supabase.from('bug_reports').insert({
      user_id: user.id,
      email: user.email,
      title: title.trim(),
      description: description.trim(),
      area,
      steps: steps.trim() || null,
      expected: expected.trim() || null,
      actual: actual.trim() || null,
      device_info: deviceInfo,
      priority,
      status: 'new',
      page_url: typeof window !== 'undefined' ? window.location.href : null,
    })

    if (error) {
      setMessage(tx('Napake ni bilo mogoče poslati. Zaženi SQL za bug_reports tabelo.', 'Could not send the bug report. Run the SQL for the bug_reports table.') + ` ${error.message}`)
      setSaving(false)
      return
    }

    trackEvent('bug_report_sent', { area, priority })
    setTitle('')
    setDescription('')
    setSteps('')
    setExpected('')
    setActual('')
    setMessage(tx('Hvala, napaka je poslana v admin panel.', 'Thank you, the bug report was sent to the admin panel.'))
    setSaving(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">{tx('Nalaganje...', 'Loading...')}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">
      <div className="mb-6 flex items-center gap-3">
        <BackButton href="/nastavitve" />
        <div>
          <h1 className="text-xl font-bold text-white">{tx('Prijava napake', 'Report a bug')}</h1>
          <p className="text-sm text-[#5a5a80]">{tx('Napiši toliko, da lahko napako ponovimo in popravimo.', 'Write enough so we can reproduce and fix it.')}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
        <label className="mb-4 block">
          <span className="mb-2 block text-xs uppercase tracking-wider text-[#5a5a80]">{tx('Kratek naslov *', 'Short title *')}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tx('npr. Obvestilo se ne pošlje', 'e.g. Notification is not sent')}
            className="w-full rounded-xl border border-[#1e1e32] bg-[#13131f] px-4 py-3 text-white outline-none focus:border-[#6c63ff]" />
        </label>

        <label className="mb-4 block">
          <span className="mb-2 block text-xs uppercase tracking-wider text-[#5a5a80]">{tx('Kaj se je zgodilo? *', 'What happened? *')}</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder={tx('Opiši napako, zaslon in kdaj se pojavi.', 'Describe the bug, screen, and when it happens.')}
            className="min-h-28 w-full rounded-xl border border-[#1e1e32] bg-[#13131f] p-3 text-white outline-none focus:border-[#6c63ff]" />
        </label>

        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-[#5a5a80]">{tx('Kje je napaka?', 'Where is the bug?')}</p>
            <div className="grid grid-cols-2 gap-2">
              {areas.map((item) => (
                <button key={item.value} onClick={() => setArea(item.value)}
                  className={`rounded-xl border px-3 py-2 text-xs font-bold ${area === item.value ? 'border-[#6c63ff66] bg-[#6c63ff22] text-[#a09aff]' : 'border-[#1e1e32] bg-[#13131f] text-[#5a5a80]'}`}>
                  {language === 'en' ? item.en : item.sl}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-[#5a5a80]">{tx('Kako resno je?', 'How serious is it?')}</p>
            <div className="grid gap-2">
              {priorities.map((item) => (
                <button key={item.value} onClick={() => setPriority(item.value)}
                  className={`rounded-xl border px-3 py-3 text-left text-sm font-bold ${priority === item.value ? 'border-[#f59e0b66] bg-[#f59e0b22] text-[#f59e0b]' : 'border-[#1e1e32] bg-[#13131f] text-[#5a5a80]'}`}>
                  {language === 'en' ? item.en : item.sl}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="mb-4 block">
          <span className="mb-2 block text-xs uppercase tracking-wider text-[#5a5a80]">{tx('Koraki do napake', 'Steps to reproduce')}</span>
          <textarea value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={tx('1. Odpri ... 2. Klikni ... 3. Zgodi se ...', '1. Open ... 2. Click ... 3. It happens ...')}
            className="min-h-24 w-full rounded-xl border border-[#1e1e32] bg-[#13131f] p-3 text-white outline-none focus:border-[#6c63ff]" />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-wider text-[#5a5a80]">{tx('Kaj si pričakoval?', 'What did you expect?')}</span>
            <textarea value={expected} onChange={(e) => setExpected(e.target.value)}
              className="min-h-20 w-full rounded-xl border border-[#1e1e32] bg-[#13131f] p-3 text-white outline-none focus:border-[#6c63ff]" />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-wider text-[#5a5a80]">{tx('Kaj se je dejansko zgodilo?', 'What actually happened?')}</span>
            <textarea value={actual} onChange={(e) => setActual(e.target.value)}
              className="min-h-20 w-full rounded-xl border border-[#1e1e32] bg-[#13131f] p-3 text-white outline-none focus:border-[#6c63ff]" />
          </label>
        </div>
      </div>

      {message && (
        <div className={`mt-4 rounded-xl border p-3 text-sm ${message.includes('Hvala') || message.includes('Thank') ? 'border-[#16a34a44] bg-[#16a34a22] text-[#4ade80]' : 'border-[#ef444444] bg-[#ef444422] text-[#fca5a5]'}`}>
          {message}
        </div>
      )}

      <button onClick={submit} disabled={saving}
        className="mt-4 w-full rounded-xl bg-[#6c63ff] py-3 font-semibold text-white transition-colors hover:bg-[#5a52e0] disabled:opacity-60">
        {saving ? tx('Pošiljam...', 'Sending...') : tx('Pošlji prijavo napake', 'Send bug report')}
      </button>

      <BottomNav aktivna="nastavitve" />
    </div>
  )
}
