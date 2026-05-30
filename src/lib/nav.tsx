'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'
import { checkCurrentUserAdmin } from '@/lib/admin-access'

type NavIconKey = 'home' | 'garage' | 'fuel' | 'service' | 'costs' | 'reminders' | 'settings' | 'more' | 'admin'

const mobilnePovezave = [
  { key: 'domov', href: '/domov', icon: 'home', labelKey: 'home' },
  { key: 'garaza', href: '/garaza', icon: 'garage', labelKey: 'garage' },
  { key: 'gorivo', href: '/vnos-goriva', icon: 'fuel', labelKey: 'fuel' },
  { key: 'servis', href: '/vnos-servisa', icon: 'service', labelKey: 'service' },
  { key: 'stroski', href: '/vnos-stroska', icon: 'costs', labelKey: 'costs' },
  { key: 'nastavitve', href: '/vec', icon: 'more', labelKey: 'more' },
] as const

const namiznePovezave = [
  { key: 'domov', href: '/domov', icon: 'home', labelSl: 'Domov', labelEn: 'Home' },
  { key: 'garaza', href: '/garaza', icon: 'garage', labelSl: 'Garaža', labelEn: 'Garage' },
  { key: 'stroski', href: '/stroski-garaza', icon: 'costs', labelSl: 'Stroški', labelEn: 'Costs' },
  { key: 'gorivo', href: '/gorivo', icon: 'fuel', labelSl: 'Gorivo', labelEn: 'Fuel' },
  { key: 'opomniki', href: '/opomniki', icon: 'reminders', labelSl: 'Opomniki', labelEn: 'Reminders' },
  { key: 'nastavitve', href: '/vec', icon: 'settings', labelSl: 'Nastavitve', labelEn: 'Settings' },
  { key: 'admin', href: '/admin', icon: 'admin', labelSl: 'Admin', labelEn: 'Admin', adminOnly: true },
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
  if (path.includes('admin')) return 'admin'
  if (path.includes('gorivo') || path.includes('goriva') || path.includes('vnos-goriva') || path.includes('zgodovina-goriva')) return 'gorivo'
  if (path.includes('opomniki')) return 'opomniki'
  if (path.includes('servis') || path.includes('gume') || path.includes('report') || path.includes('scan')) return 'servis'
  if (path.includes('stroski') || path.includes('vnos-stroska')) return 'stroski'
  if (path.includes('vec') || path.includes('nastavitve') || path.includes('feedback') || path.includes('pomocnik') || path.includes('prijava-napake') || path.includes('uvoz-podatkov')) return 'nastavitve'
  if (path.includes('garaza') || path.includes('dashboard') || path.includes('dodaj-avto') || path.includes('prenos')) return 'garaza'
  return 'domov'
}

export function NavIcon({ type, className = 'h-6 w-6' }: { type: NavIconKey, className?: string }) {
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
  if (type === 'reminders') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6.5 10.8a5.5 5.5 0 0 1 11 0v3.9l1.6 2.6H4.9l1.6-2.6v-3.9Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round"/>
      <path d="M9.6 19a2.6 2.6 0 0 0 4.8 0" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"/>
      <path d="M12 4V3" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'settings') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" strokeWidth="2.1"/>
      <path d="M19.2 13.8a7.8 7.8 0 0 0 0-3.6l2-1.5-2-3.5-2.4 1a7.8 7.8 0 0 0-3.1-1.8L13.4 2H9.6l-.4 2.4a7.8 7.8 0 0 0-3.1 1.8l-2.3-1-2 3.5 2 1.5a7.8 7.8 0 0 0 0 3.6l-2 1.5 2 3.5 2.3-1a7.8 7.8 0 0 0 3.1 1.8l.4 2.4h3.8l.3-2.4a7.8 7.8 0 0 0 3.1-1.8l2.4 1 2-3.5-2-1.5Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round"/>
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
  const { language } = useLanguage()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let active = true
    checkCurrentUserAdmin()
      .then((result) => {
        if (active) setIsAdmin(result.isAdmin)
      })
      .catch(() => {
        if (active) setIsAdmin(false)
      })
    return () => {
      active = false
    }
  }, [])

  const desktopLinks = namiznePovezave.filter((item) => !('adminOnly' in item) || !item.adminOnly || isAdmin)
  return (
    <aside className="gb-desktop-nav fixed left-0 top-0 z-50 hidden h-screen w-[280px] flex-col border-r border-[#252a3d] bg-[#0f1320]/96 px-5 py-6 text-white shadow-2xl shadow-[#050814]/24 backdrop-blur-md">
      <button onClick={() => pojdiNa(router, '/domov')} className="gb-desktop-brand mb-8 px-3 text-left text-xl font-black tracking-tight text-white">
        Garage<span className="text-[#6c63ff]">Base</span>
      </button>
      <nav className="flex flex-col gap-2">
        {desktopLinks.map((item) => (
          <button
            key={item.key}
            onClick={() => pojdiNa(router, item.href)}
            className={`gb-desktop-link flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-black transition-all ${
              aktivna === item.key
                ? 'gb-desktop-link-active border-[#6c63ff66] bg-[#6c63ff] text-white shadow-lg shadow-[#6c63ff33]'
                : 'border-[#2a3044] bg-[#151928]/70 text-[#c8c8dc] shadow-[0_8px_20px_rgba(4,8,22,0.14)] hover:border-[#4d5574] hover:bg-[#1a2033] hover:text-white'
          }`}
          >
            <NavIcon type={item.icon} className="h-5 w-5 shrink-0" />
            <span>{language === 'en' ? item.labelEn : item.labelSl}</span>
          </button>
        ))}
      </nav>
      <button
        onClick={() => pojdiNa(router, '/domov')}
        className="gb-sidebar-app-icon group relative mt-6 flex h-64 w-full items-center justify-center overflow-visible border-0 bg-transparent p-0 text-left shadow-none"
        aria-label={language === 'en' ? 'GarageBase home' : 'GarageBase domov'}
      >
        <img src="/garagebase-app-icon.png" alt="" className="relative h-full w-[210%] max-w-none object-contain object-center drop-shadow-[0_22px_26px_rgba(0,0,0,0.34)] transition-transform duration-300 group-hover:scale-[1.02]" />
      </button>
      <button
        type="button"
        onClick={() => pojdiNa(router, '/')}
        className="mt-auto rounded-2xl border border-[#2d344a] bg-[#141827]/70 px-4 py-3 text-left text-sm font-black text-[#c8c8dc] transition-all hover:border-[#6c63ff66] hover:bg-[#171b2b] hover:text-white"
      >
        {language === 'en' ? 'Intro page' : 'Uvodna stran'}
      </button>
    </aside>
  )
}

export function BottomNav({ aktivna }: { aktivna?: string }) {
  const { t } = useLanguage()
  const router = useRouter()

  const mobileLinks = mobilnePovezave

  return (
    <>
      <DesktopNav aktivna={aktivna} />
      <div className="gb-mobile-nav fixed bottom-0 left-0 right-0 z-50 flex w-full max-w-none justify-between border-t border-[#27273a] bg-[#0a0a12]/96 px-2 pb-2 pt-3 shadow-[0_-16px_34px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        {mobileLinks.map((item: any) => {
          const isActive = aktivna === item.key
          return (
            <button
              key={item.key}
              onClick={() => pojdiNa(router, item.href)}
              className="flex min-w-0 flex-1 flex-col items-center gap-1 transition-transform active:scale-95"
            >
              <span className={`flex h-14 w-14 items-center justify-center rounded-[22px] transition-colors ${
                isActive
                  ? 'bg-[#6c63ff28] text-[#8f86ff] shadow-[0_10px_28px_rgba(108,99,255,0.28)]'
                  : 'text-[#aeb4c8] hover:bg-[#ffffff08] hover:text-white'
              }`}>
                <NavIcon type={item.icon} className="h-10 w-10" />
              </span>
              <span className={`text-[13.5px] font-black leading-none ${isActive ? 'text-[#8f86ff]' : 'text-[#b8bed0]'}`}>
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
