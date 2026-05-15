'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'

type NavIconKey = 'home' | 'garage' | 'fuel' | 'service' | 'costs' | 'more' | 'admin'

const mobilnePovezave = [
  { key: 'domov', href: '/domov', icon: 'home', labelKey: 'home' },
  { key: 'garaza', href: '/garaza', icon: 'garage', labelKey: 'garage' },
  { key: 'gorivo', href: '/vnos-goriva', icon: 'fuel', labelKey: 'fuel' },
  { key: 'servis', href: '/vnos-servisa', icon: 'service', labelKey: 'service' },
  { key: 'stroski', href: '/vnos-stroska', icon: 'costs', labelKey: 'costs' },
  { key: 'nastavitve', href: '/vec', icon: 'more', labelKey: 'more' },
] as const

const namiznePovezave = [
  { key: 'domov', href: '/domov', icon: 'home', labelKey: 'home' },
  { key: 'garaza', href: '/garaza', icon: 'garage', labelKey: 'garage' },
  { key: 'gorivo', href: '/gorivo', icon: 'fuel', labelKey: 'fuel' },
  { key: 'servis', href: '/servis', icon: 'service', labelKey: 'service' },
  { key: 'stroski', href: '/stroski-garaza', icon: 'costs', labelKey: 'costs' },
  { key: 'nastavitve', href: '/vec', icon: 'more', labelKey: 'more' },
] as const

type AppRouter = ReturnType<typeof useRouter>

function pojdiNa(router: AppRouter, href: string) {
  if (!href) return
  if (/^(https?:|mailto:|tel:)/i.test(href)) {
    window.location.href = href
    return
  }
  router.push(href)
}

function activeKeyFromPath(path: string) {
  if (path.includes('gorivo') || path.includes('goriva') || path.includes('vnos-goriva') || path.includes('zgodovina-goriva')) return 'gorivo'
  if (path.includes('servis') || path.includes('opomniki') || path.includes('report') || path.includes('scan')) return 'servis'
  if (path.includes('stroski') || path.includes('vnos-stroska')) return 'stroski'
  if (path.includes('vec') || path.includes('nastavitve') || path.includes('feedback') || path.includes('pomocnik') || path.includes('prijava-napake') || path.includes('uvoz-podatkov') || path.includes('admin')) return 'nastavitve'
  if (path.includes('garaza') || path.includes('dashboard') || path.includes('dodaj-avto') || path.includes('prenos')) return 'garaza'
  return 'domov'
}

function NavIcon({ type, className = 'h-6 w-6' }: { type: NavIconKey, className?: string }) {
  if (type === 'home') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-8.5Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
    </svg>
  )
  if (type === 'garage') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20V9l8-4 8 4v11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 20v-7h10v7M7 16h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'fuel') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3h7a1 1 0 0 1 1 1v17H6V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2.2"/>
      <path d="M8 7h5v4H8V7ZM15 7h2l2 3v7a2 2 0 0 0 2 2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'service') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16.8 3.6 14.2 6.2l2.9 2.9 2.7-2.6a5 5 0 0 1-6.4 6.5l-6.6 6.6a2.3 2.3 0 0 1-3.3-3.3l6.6-6.6a5 5 0 0 1 6.7-6.1Z" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6.3 17.7h.01" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'costs') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 19.5h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M6.5 16.5v-4M12 16.5v-8M17.5 16.5v-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="m5.8 9.8 3.1-2.6 3.2 2.1 4.6-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16.7 4.3h-3.1M16.7 4.3v3.1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'admin') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-2.8 8.3-7 10-4.2-1.7-7-5.5-7-10V6l7-3Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
    </svg>
  )
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 12h.01M12 12h.01M18 12h.01" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round"/>
    </svg>
  )
}

function DesktopNav({ aktivna }: { aktivna?: string }) {
  const { t } = useLanguage()
  const router = useRouter()

  return (
    <div className="gb-desktop-nav fixed top-0 left-0 right-0 z-50 hidden bg-[#080810]/95 backdrop-blur-md border-b border-[#1e1e32]">
      <div className="w-full max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
        <button onClick={() => pojdiNa(router, '/domov')} className="text-2xl font-bold text-white">
          Garage<span className="text-[#6c63ff]">Base</span>
        </button>
        <div className="flex items-center gap-2">
          {namiznePovezave.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <button
                onClick={() => pojdiNa(router, item.href)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  aktivna === item.key
                    ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                    : 'bg-[#0f0f1a] border-[#1e1e32] text-[#5a5a80] hover:text-white hover:border-[#2a2a40]'
              }`}
              >
                <NavIcon type={item.icon} className="h-4 w-4" />
                <span>{t(item.labelKey)}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function BottomNav({ aktivna }: { aktivna?: string }) {
  const { t } = useLanguage()
  const router = useRouter()

  const mobileLinks = mobilnePovezave

  return (
    <>
      <DesktopNav aktivna={aktivna} />
      <div className="gb-mobile-nav fixed bottom-0 left-0 right-0 z-50 flex justify-between border-t border-[#1a1a28] bg-[#0a0a12]/96 px-2 pb-[calc(0.72rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-xl">
        {mobileLinks.map((item: any) => {
          const isActive = aktivna === item.key
          return (
            <button
              key={item.key}
              onClick={() => pojdiNa(router, item.href)}
              className="flex min-w-0 flex-1 flex-col items-center gap-1 transition-transform active:scale-95"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-colors ${
                isActive
                  ? 'bg-[#6c63ff24] text-[#6c63ff] shadow-[0_10px_28px_rgba(108,99,255,0.22)]'
                  : 'text-[#343a46] hover:bg-[#ffffff08] hover:text-[#d8d8e8]'
              }`}>
                <NavIcon type={item.icon} className="h-7 w-7" />
              </span>
              <span className={`text-[12.5px] font-black leading-none ${isActive ? 'text-[#6c63ff]' : 'text-[#343a46]'}`}>
                {item.label || t(item.labelKey)}
              </span>
            </button>
          )
        })}
      </div>
    </>
  )
}

export function HomeButton({ aktivna }: { aktivna?: string } = {}) {
  const pathname = usePathname()
  const [resolvedActive, setResolvedActive] = useState(aktivna || 'domov')

  useEffect(() => {
    if (aktivna) {
      setResolvedActive(aktivna)
      return
    }
    setResolvedActive(activeKeyFromPath(pathname || '/domov'))
  }, [aktivna, pathname])

  return <BottomNav aktivna={resolvedActive} />
}

export function BackButton({ href, label }: { href?: string, label?: string }) {
  const { t } = useLanguage()
  const router = useRouter()

  return (
    <button
      aria-label={label || t('back')}
      onClick={() => {
        if (window.history.length > 1) router.back()
        else if (href) pojdiNa(router, href)
        else router.push('/domov')
      }}
      className="w-10 h-10 rounded-xl bg-[#13131f] border border-[#2a2a40] flex items-center justify-center text-[#8080a0] hover:text-white hover:border-[#6c63ff] hover:bg-[#1a1a30] transition-all active:scale-95">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}
