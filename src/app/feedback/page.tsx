'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton, BottomNav } from '@/lib/nav'
import { useLanguage } from '@/lib/i18n'

const frequencyOptions = [
  { value: 'daily', sl: 'Vsak dan', en: 'Every day' },
  { value: 'weekly', sl: 'Vsak teden', en: 'Every week' },
  { value: 'monthly', sl: 'Obcasno', en: 'Sometimes' },
  { value: 'rarely', sl: 'Redko', en: 'Rarely' },
]

const userTypeOptions = [
  { value: 'personal', sl: 'Osebna uporaba', en: 'Personal use' },
  { value: 'company', sl: 'Podjetje', en: 'Company' },
  { value: 'both', sl: 'Oboje', en: 'Both' },
]

const priorityOptions = [
  { value: 'low', sl: 'Lepo bi bilo', en: 'Nice to have' },
  { value: 'normal', sl: 'Pomembno', en: 'Important' },
  { value: 'high', sl: 'Nujno', en: 'Urgent' },
]

const statusLabels: Record<string, { sl: string; en: string }> = {
  new: { sl: 'Prejeto', en: 'Received' },
  reviewing: { sl: 'V razmisleku', en: 'Under review' },
  planned: { sl: 'Planirano', en: 'Planned' },
  done: { sl: 'Urejeno', en: 'Done' },
  rejected: { sl: 'Trenutno ne gre naprej', en: 'Not moving forward now' },
}

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

export default function FeedbackPage() {
  const { language } = useLanguage()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [featureDescription, setFeatureDescription] = useState('')
  const [usefulnessReason, setUsefulnessReason] = useState('')
  const [usageFrequency, setUsageFrequency] = useState('weekly')
  const [userType, setUserType] = useState('personal')
  const [priority, setPriority] = useState('normal')
  const [message, setMessage] = useState('')
  const [myFeedback, setMyFeedback] = useState<any[]>([])

  const tx = (sl: string, en: string) => language === 'en' ? en : sl

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/'
        return
      }
      setUser(user)
      await loadMyFeedback(user.id)
      setLoading(false)
    }
    init()
  }, [])

  async function loadMyFeedback(userId: string) {
    const { data } = await supabase
      .from('feedback')
      .select('id, feature_description, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)
    setMyFeedback(data || [])
  }

  const submitFeedback = async () => {
    setMessage('')

    if (!featureDescription.trim() || !usefulnessReason.trim()) {
      setMessage(tx('Opisi funkcijo in zakaj bi bila uporabna.', 'Describe the feature and why it would be useful.'))
      return
    }

    setSaving(true)
    const { error } = await supabase.from('feedback').insert({
      user_id: user.id,
      feature_description: featureDescription.trim(),
      usefulness_reason: usefulnessReason.trim(),
      usage_frequency: usageFrequency,
      user_type: userType,
      priority,
      page_context: typeof window !== 'undefined' ? window.location.href : null,
      status: 'new',
    })

    if (error) {
      console.error('Feedback error:', error)
      setMessage(tx(
        'Predloga ni bilo mogoce shraniti. Preveri, da si zagnal SQL za feedback tabelo.',
        'Could not save the suggestion. Check that you ran the SQL for the feedback table.'
      ))
      setSaving(false)
      return
    }

    setFeatureDescription('')
    setUsefulnessReason('')
    setUsageFrequency('weekly')
    setUserType('personal')
    setPriority('normal')
    setMessage(tx('Hvala, predlog je shranjen.', 'Thank you, the suggestion has been saved.'))
    await loadMyFeedback(user.id)
    setSaving(false)
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
          <h1 className="text-xl font-bold text-white">💡 {tx('Predlagaj funkcijo', 'Suggest a feature')}</h1>
          <p className="text-[#5a5a80] text-sm">{tx('Pomagaj oblikovati GarageBase.', 'Help shape GarageBase.')}</p>
        </div>
      </div>

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
        <label className="block mb-4">
          <span className="text-[#5a5a80] text-xs uppercase tracking-wider">{tx('Kaj zelis, da dodamo ali izboljsamo?', 'What should we add or improve?')}</span>
          <textarea
            value={featureDescription}
            onChange={(e) => setFeatureDescription(e.target.value)}
            placeholder={tx('npr. Samodejno branje racuna za gorivo...', 'e.g. Automatic fuel receipt reading...')}
            className="mt-2 w-full min-h-28 bg-[#13131f] border border-[#1e1e32] rounded-xl p-3 text-white outline-none focus:border-[#6c63ff]"
          />
        </label>

        <label className="block mb-4">
          <span className="text-[#5a5a80] text-xs uppercase tracking-wider">{tx('Zakaj bi bilo to uporabno?', 'Why would this be useful?')}</span>
          <textarea
            value={usefulnessReason}
            onChange={(e) => setUsefulnessReason(e.target.value)}
            placeholder={tx('npr. Prihranilo bi cas pri vsakem tankanju...', 'e.g. It would save time after every fill-up...')}
            className="mt-2 w-full min-h-24 bg-[#13131f] border border-[#1e1e32] rounded-xl p-3 text-white outline-none focus:border-[#6c63ff]"
          />
        </label>

        <div className="mb-4">
          <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2">{tx('Kako pogosto bi to uporabljal?', 'How often would you use it?')}</p>
          <div className="grid grid-cols-2 gap-2">
            {frequencyOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setUsageFrequency(option.value)}
                className={`py-3 px-2 rounded-xl border text-sm font-semibold transition-all ${
                  usageFrequency === option.value
                    ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                    : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80]'
                }`}
              >
                {language === 'en' ? option.en : option.sl}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2">{tx('Za koga je funkcija?', 'Who is this feature for?')}</p>
          <div className="grid grid-cols-3 gap-2">
            {userTypeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setUserType(option.value)}
                className={`py-3 px-2 rounded-xl border text-xs font-semibold transition-all ${
                  userType === option.value
                    ? 'bg-[#3ecfcf22] border-[#3ecfcf66] text-[#3ecfcf]'
                    : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80]'
                }`}
              >
                {language === 'en' ? option.en : option.sl}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2">{tx('Kako pomembno je?', 'How important is it?')}</p>
          <div className="grid grid-cols-3 gap-2">
            {priorityOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPriority(option.value)}
                className={`py-3 px-2 rounded-xl border text-xs font-semibold transition-all ${
                  priority === option.value
                    ? 'bg-[#f59e0b22] border-[#f59e0b66] text-[#f59e0b]'
                    : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80]'
                }`}
              >
                {language === 'en' ? option.en : option.sl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-sm border mb-4 ${
          message.includes('Hvala') || message.includes('Thank')
            ? 'bg-[#16a34a22] border-[#16a34a44] text-[#4ade80]'
            : 'bg-[#ef444422] border-[#ef444444] text-[#fca5a5]'
        }`}>
          {message}
        </div>
      )}

      <button
        onClick={submitFeedback}
        disabled={saving}
        className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60"
      >
        {saving ? tx('Posiljam...', 'Sending...') : tx('Poslji predlog', 'Send suggestion')}
      </button>

      <div className="mt-5 rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-5">
        <h2 className="text-lg font-bold text-white">{tx('Moji predlogi', 'My suggestions')}</h2>
        <p className="mt-1 text-sm text-[#5a5a80]">{tx('Tukaj vidiš, kaj se dogaja s predlogi, ki si jih poslal.', 'Here you can see what is happening with the suggestions you sent.')}</p>
        <div className="mt-4 space-y-3">
          {myFeedback.length === 0 ? (
            <p className="rounded-xl bg-[#13131f] p-3 text-sm text-[#5a5a80]">{tx('Nimaš še poslanih predlogov.', 'You have not sent any suggestions yet.')}</p>
          ) : myFeedback.map((item, index) => {
            const status = item.status || 'new'
            return (
              <div key={item.id} className="rounded-xl border border-[#1e1e32] bg-[#13131f] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6c63ff]">{tx(`Predlog ${index + 1}`, `Suggestion ${index + 1}`)}</p>
                    <p className="mt-1 text-sm font-black text-white">{item.feature_description}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#6c63ff22] px-2 py-1 text-[10px] font-black text-[#a09aff]">
                    {statusLabels[status]?.[language] || status}
                  </span>
                </div>
                <p className="mt-3 rounded-xl bg-[#6c63ff14] p-3 text-xs font-semibold leading-relaxed text-[#a09aff]">
                  {statusReply[status]?.[language] || statusReply.new[language]}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <BottomNav aktivna="nastavitve" />
    </div>
  )
}
