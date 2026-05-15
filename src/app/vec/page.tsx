'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BottomNav } from '@/lib/nav'
import { useLanguage } from '@/lib/i18n'
import { checkCurrentUserAdmin } from '@/lib/admin-access'

type MenuIcon = 'profile' | 'bell' | 'shield' | 'sync' | 'paint' | 'grid' | 'help' | 'info' | 'garage' | 'import' | 'admin' | 'logout'

type MenuItem = {
  title: string
  text: string
  href: string
  icon: MenuIcon
  tone: string
  adminOnly?: boolean
}

function Icon({ type, className = 'h-6 w-6' }: { type: MenuIcon, className?: string }) {
  if (type === 'profile') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="2.1" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  )
  if (type === 'bell') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 9a6 6 0 0 0-12 0v4l-2 4h16l-2-4V9Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" />
      <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  )
  if (type === 'shield') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-2.8 8.3-7 10-4.2-1.7-7-5.5-7-10V6l7-3Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" />
    </svg>
  )
  if (type === 'sync') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 7h-5a5 5 0 0 0-8.5-2.8L5 5.7M4 17h5a5 5 0 0 0 8.5 2.8L19 18.3" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 4v3h-3M6 20v-3h3" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  if (type === 'paint') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3a9 9 0 0 0 0 18h1.2a1.8 1.8 0 0 0 1.4-2.9 1.8 1.8 0 0 1 1.4-2.9h1A5 5 0 0 0 22 10c0-3.9-4.5-7-10-7Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" />
      <path d="M7.5 10h.01M10 6.8h.01M14.2 6.8h.01M17 10h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
  if (type === 'grid') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 4h6v6H4V4ZM14 4h6v6h-6V4ZM4 14h6v6H4v-6ZM14 14h6v6h-6v-6Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" />
    </svg>
  )
  if (type === 'garage') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20V9l8-4 8 4v11" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 20v-7h10v7M7 16h10" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  )
  if (type === 'import') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  if (type === 'admin') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-2.8 8.3-7 10-4.2-1.7-7-5.5-7-10V6l7-3Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  if (type === 'logout') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 17l5-5-5-5M20 12H8M11 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 18h.01M9.5 9a2.8 2.8 0 1 1 4.6 2.1c-1.1.8-2.1 1.3-2.1 2.9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export default function VecPage() {
  const { language } = useLanguage()
  const tx = (sl: string, en: string) => language === 'en' ? en : sl
  const [isAdmin, setIsAdmin] = useState(false)
  const [email, setEmail] = useState('')
  const [vehicleCount, setVehicleCount] = useState(0)

  useEffect(() => {
    const load = async () => {
      const admin = await checkCurrentUserAdmin()
      setIsAdmin(admin.isAdmin)
      setEmail(admin.user?.email || '')
      const userId = admin.user?.id
      if (!userId) return
      const { count, error } = await supabase
        .from('cars')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .or('arhivirano.is.null,arhivirano.eq.false')
      if (error) {
        console.warn('[GarageBase more] vehicle count query failed', error)
        setVehicleCount(0)
        return
      }
      setVehicleCount(count || 0)
    }
    load()
  }, [])

  const items: MenuItem[] = [
    { title: tx('Obvestila', 'Notifications'), text: tx('Push in e-poštna obvestila, opomniki in testiranje.', 'Push and email notifications, reminders and tests.'), href: '/nastavitve?section=obvestila', icon: 'bell', tone: 'text-[#6c63ff] bg-[#6c63ff14]' },
    { title: tx('Varnost', 'Security'), text: tx('Odklep aplikacije, geslo in zaščita računa.', 'App lock, password and account protection.'), href: '/nastavitve?section=varnost', icon: 'shield', tone: 'text-[#2563eb] bg-[#2563eb14]' },
    { title: tx('Sinhronizacija', 'Sync'), text: tx('Uvoz, QR prenos in povezave z drugimi aplikacijami.', 'Import, QR transfer and app connections.'), href: '/nastavitve?section=prenos', icon: 'sync', tone: 'text-[#14b8a6] bg-[#14b8a614]' },
    { title: tx('Videz', 'Appearance'), text: tx('Tema, pisava in prikaz garaže.', 'Theme, font and garage display.'), href: '/nastavitve?section=prikaz', icon: 'paint', tone: 'text-[#8b5cf6] bg-[#8b5cf614]' },
    { title: tx('Uporaba', 'Usage'), text: tx('Lite/Full način, enote in valuta.', 'Lite/Full mode, units and currency.'), href: '/nastavitve?section=uporaba', icon: 'grid', tone: 'text-[#f97316] bg-[#f9731614]' },
    { title: tx('Pomoč in podpora', 'Help and support'), text: tx('Pomočnik, prijava napake in predlogi.', 'Assistant, bug reports and ideas.'), href: '/nastavitve?section=pomoc', icon: 'help', tone: 'text-[#16a34a] bg-[#16a34a14]' },
    { title: tx('Moja vozila', 'My vehicles'), text: tx('Uredi vozila, arhiv in prikaz kartic.', 'Manage vehicles, archive and cards.'), href: '/garaza', icon: 'garage', tone: 'text-[#6c63ff] bg-[#6c63ff14]' },
    { title: tx('Uvoz podatkov', 'Data import'), text: tx('CSV, Drivvo in prenos zgodovine.', 'CSV, Drivvo and history transfer.'), href: '/uvoz-podatkov', icon: 'import', tone: 'text-[#0ea5e9] bg-[#0ea5e914]' },
    { title: 'Admin Panel', text: tx('Uporabniki, statistika in napake.', 'Users, statistics and errors.'), href: '/admin', icon: 'admin', tone: 'text-[#ef4444] bg-[#ef444414]', adminOnly: true },
  ]

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-[#080810] px-4 pt-5 pb-28 text-white md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-black text-white">Garage<span className="text-[#6c63ff]">Base</span></p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white">{tx('Nastavitve.', 'Settings.')}</h1>
            <p className="mt-2 text-sm font-semibold text-[#8a8aa8]">{tx('Upravljaj svoj račun in aplikacijo.', 'Manage your account and app.')}</p>
          </div>
          <button onClick={() => window.location.href = '/opomniki'} className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] text-[#8a8aa8]">
            <Icon type="bell" className="h-6 w-6" />
          </button>
        </header>

        <section className="mb-5 overflow-hidden rounded-[26px] border border-[#1e1e32] bg-[#0f0f1a]">
          <button onClick={() => window.location.href = '/nastavitve?section=profil'} className="flex w-full items-center gap-4 p-4 text-left">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-[#6c63ff22] text-[#6c63ff]">
              <Icon type="profile" className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black text-white">{email || tx('Uporabnik', 'User')}</p>
              <p className="mt-1 text-sm font-semibold text-[#8a8aa8]">{tx('Free paket', 'Free plan')}</p>
            </div>
            <span className="text-2xl font-black text-[#6c63ff]">›</span>
          </button>
          <div className="grid grid-cols-3 border-t border-[#1e1e32] text-center">
            <div className="p-3">
              <p className="text-xl font-black text-white">{vehicleCount}</p>
              <p className="text-xs font-semibold text-[#8a8aa8]">{tx('Vozil', 'Vehicles')}</p>
            </div>
            <div className="border-x border-[#1e1e32] p-3">
              <p className="text-xl font-black text-white">Free</p>
              <p className="text-xs font-semibold text-[#8a8aa8]">{tx('Paket', 'Plan')}</p>
            </div>
            <div className="p-3">
              <p className="text-xl font-black text-[#16a34a]">OK</p>
              <p className="text-xs font-semibold text-[#8a8aa8]">{tx('Račun', 'Account')}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="grid gap-3 sm:grid-cols-2">
            {items.filter((item) => !item.adminOnly || isAdmin).map((item) => (
              <button
                key={item.href}
                onClick={() => window.location.href = item.href}
                className="flex items-center gap-4 rounded-[22px] border border-[#1e1e32] bg-[#0f0f1a] p-4 text-left shadow-xl shadow-black/10 transition-transform active:scale-[0.99]"
              >
                <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${item.tone}`}>
                  <Icon type={item.icon} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-black text-white">{item.title}</p>
                  <p className="mt-1 text-sm font-semibold leading-snug text-[#8a8aa8]">{item.text}</p>
                </div>
                <span className="text-2xl font-black text-[#6c63ff]">›</span>
              </button>
            ))}
          </div>

          <aside className="space-y-3">
            <div className="rounded-[26px] border border-[#1e1e32] bg-[#0f0f1a] p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6c63ff]">{tx('Hitri pregled', 'Quick overview')}</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[#8a8aa8]">{tx('Shramba', 'Storage')}</span>
                  <span className="text-sm font-black text-white">1.2 GB / 5 GB</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#13131f]">
                  <div className="h-full w-[24%] rounded-full bg-[#6c63ff]" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[#8a8aa8]">{tx('Zadnja sinhronizacija', 'Last sync')}</span>
                  <span className="text-sm font-black text-[#16a34a]">{tx('Danes', 'Today')}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[#8a8aa8]">Drivvo</span>
                  <span className="rounded-full bg-[#16a34a18] px-3 py-1 text-xs font-black text-[#16a34a]">{tx('Pripravljeno', 'Ready')}</span>
                </div>
              </div>
            </div>

            <button onClick={() => window.location.href = '/nastavitve?section=aplikacija'} className="w-full rounded-[26px] border border-[#1e1e32] bg-[#0f0f1a] p-4 text-left">
              <p className="text-lg font-black text-white">GarageBase Premium</p>
              <p className="mt-1 text-sm font-semibold text-[#8a8aa8]">{tx('Odkleni več funkcij, ko bo paket pripravljen.', 'Unlock more features when the plan is ready.')}</p>
              <span className="mt-4 inline-flex rounded-2xl bg-[#6c63ff] px-4 py-2 text-sm font-black text-white">{tx('Poglej načrt', 'View plan')} →</span>
            </button>

            <button
              onClick={signOut}
              className="flex w-full items-center justify-center gap-2 rounded-[22px] border border-[#ef444444] bg-[#ef444414] px-5 py-4 text-base font-black text-[#ef4444]"
            >
              <Icon type="logout" className="h-5 w-5" />
              {tx('Odjava', 'Sign out')}
            </button>
          </aside>
        </section>
      </div>
      <BottomNav aktivna="nastavitve" />
    </div>
  )
}
