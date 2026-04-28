'use client'

import { useLanguage } from '@/lib/i18n'

const glavnePovezave = [
  { key: 'garaza', href: '/garaza', icon: '🏠', labelKey: 'garage' },
  { key: 'gorivo', href: '/vnos-goriva', icon: '⛽', labelKey: 'fuel' },
  { key: 'servis', href: '/vnos-servisa', icon: '🔧', labelKey: 'service' },
  { key: 'stroski', href: '/stroski-garaza', icon: '📊', labelKey: 'costs' },
  { key: 'nastavitve', href: '/nastavitve', icon: '⚙️', labelKey: 'more' },
] as const

function pojdiNa(href: string) {
  window.location.href = href
}

function DesktopNav({ aktivna }: { aktivna?: string }) {
  const { t } = useLanguage()

  return (
    <div className="gb-desktop-nav fixed top-0 left-0 right-0 z-50 hidden bg-[#080810]/95 backdrop-blur-md border-b border-[#1e1e32]">
      <div className="w-full max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
        <button onClick={() => pojdiNa('/garaza')} className="text-2xl font-bold text-white">
          Garage<span className="text-[#6c63ff]">Base</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => pojdiNa('/')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border bg-[#0f0f1a] border-[#1e1e32] text-[#5a5a80] hover:text-white hover:border-[#2a2a40] transition-all"
          >
            <span>↩</span>
            <span>{t('home')}</span>
          </button>
          {glavnePovezave.map((item) => (
            <button
              key={item.key}
              onClick={() => pojdiNa(item.href)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                aktivna === item.key
                  ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                  : 'bg-[#0f0f1a] border-[#1e1e32] text-[#5a5a80] hover:text-white hover:border-[#2a2a40]'
              }`}
            >
              <span>{item.icon}</span>
              <span>{t(item.labelKey)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function BottomNav({ aktivna }: { aktivna?: string }) {
  const { t } = useLanguage()

  return (
    <>
      <DesktopNav aktivna={aktivna} />
      <div className="gb-mobile-nav fixed bottom-0 left-0 right-0 bg-[#0a0a12] border-t border-[#1a1a28] flex justify-around py-3 px-4 z-50">
        {glavnePovezave.map((item) => (
          <button key={item.key} onClick={() => pojdiNa(item.href)} className="flex flex-col items-center gap-1">
            <span className="text-2xl leading-none">{item.icon}</span>
            <span className={`text-[10px] uppercase tracking-wider ${aktivna === item.key ? 'text-[#6c63ff] font-bold' : 'text-[#3a3a5a]'}`}>
              {t(item.labelKey)}
            </span>
          </button>
        ))}
      </div>
    </>
  )
}

export function HomeButton() {
  const { t } = useLanguage()

  return (
    <>
      <DesktopNav />
      <div className="gb-mobile-nav fixed bottom-0 left-0 right-0 bg-[#0a0a12] border-t border-[#1a1a28] flex justify-center py-3 px-4 z-50">
        <button onClick={() => pojdiNa('/garaza')} className="flex flex-col items-center gap-1">
          <span className="text-2xl leading-none">🏠</span>
          <span className="text-[10px] uppercase tracking-wider text-[#6c63ff] font-bold">{t('garage')}</span>
        </button>
      </div>
    </>
  )
}

export function BackButton({ href, label }: { href?: string, label?: string }) {
  const { t } = useLanguage()

  return (
    <button
      aria-label={label || t('back')}
      onClick={() => href ? pojdiNa(href) : window.history.back()}
      className="w-10 h-10 rounded-xl bg-[#13131f] border border-[#2a2a40] flex items-center justify-center text-[#8080a0] hover:text-white hover:border-[#6c63ff] hover:bg-[#1a1a30] transition-all active:scale-95">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}
