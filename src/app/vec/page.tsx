'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BottomNav } from '@/lib/nav'
import { useLanguage } from '@/lib/i18n'
import { checkCurrentUserAdmin } from '@/lib/admin-access'

type MenuItem = {
  title: string
  text: string
  href: string
  icon: 'settings' | 'garage' | 'import' | 'help' | 'bug' | 'feedback' | 'admin'
  adminOnly?: boolean
}

function Icon({ type, className = 'h-6 w-6' }: { type: MenuItem['icon'] | 'logout', className?: string }) {
  if (type === 'settings') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="2.2"/>
      <path d="M19 13.5v-3l-2-.5-.8-1.9 1-1.8-2.1-2.1-1.8 1-1.9-.8L10.5 2h-3l-.5 2.4-1.9.8-1.8-1-2.1 2.1 1 1.8-.8 1.9-2.4.5v3l2.4.5.8 1.9-1 1.8 2.1 2.1 1.8-1 1.9.8.5 2.4h3l.5-2.4 1.9-.8 1.8 1 2.1-2.1-1-1.8.8-1.9 2.4-.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  )
  if (type === 'garage') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20V9l8-4 8 4v11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 20v-7h10v7M7 16h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'admin') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-2.8 8.3-7 10-4.2-1.7-7-5.5-7-10V6l7-3Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
    </svg>
  )
  if (type === 'import') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (type === 'help') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 18h.01M9.5 9a2.8 2.8 0 1 1 4.6 2.1c-1.1.8-2.1 1.3-2.1 2.9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" stroke="currentColor" strokeWidth="2"/>
    </svg>
  )
  if (type === 'bug') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 8h8v8a4 4 0 0 1-8 0V8ZM9 4l1.5 2M15 4l-1.5 2M4 13h4M16 13h4M5 19l3-2M19 19l-3-2" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (type === 'feedback') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 5h14v10H8l-3 3V5Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
      <path d="M8 9h8M8 12h5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 17l5-5-5-5M20 12H8M11 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function VecPage() {
  const { language } = useLanguage()
  const tx = (sl: string, en: string) => language === 'en' ? en : sl
  const [isAdmin, setIsAdmin] = useState(false)
  const [email, setEmail] = useState('')

  useEffect(() => {
    const load = async () => {
      const admin = await checkCurrentUserAdmin()
      setIsAdmin(admin.isAdmin)
      setEmail(admin.user?.email || '')
    }
    load()
  }, [])

  const items: MenuItem[] = [
    { title: tx('Nastavitve', 'Settings'), text: tx('Tema, jezik, račun, obvestila in app lock.', 'Theme, language, account, notifications and app lock.'), href: '/nastavitve', icon: 'settings' },
    { title: tx('Garaža', 'Garage'), text: tx('Uredi vozila, arhiv in prikaz garaže.', 'Manage vehicles, archive and garage display.'), href: '/garaza', icon: 'garage' },
    { title: tx('Uvoz podatkov', 'Data import'), text: tx('Uvoz zgodovine iz CSV/Drivvo ali prenos iz QR.', 'Import history from CSV/Drivvo or transfer by QR.'), href: '/uvoz-podatkov', icon: 'import' },
    { title: tx('Pomoč', 'Help'), text: tx('Hitre razlage in pomoč pri uporabi.', 'Quick explanations and usage help.'), href: '/pomocnik', icon: 'help' },
    { title: tx('Prijava napake', 'Report a bug'), text: tx('Pošlji napako ali predlog izboljšave.', 'Send a bug report or improvement idea.'), href: '/prijava-napake', icon: 'bug' },
    { title: 'Feedback', text: tx('Splošni komentarji za razvoj aplikacije.', 'General comments for app development.'), href: '/feedback', icon: 'feedback' },
    { title: 'Admin Panel', text: tx('Uporabniki, statistika in napake.', 'Users, statistics and errors.'), href: '/admin', icon: 'admin', adminOnly: true },
  ]

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-[#080810] px-4 pt-5 pb-28 text-white md:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <p className="text-lg font-black text-white">Garage<span className="text-[#6c63ff]">Base</span></p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white">{tx('Več.', 'More.')}</h1>
          {email && <p className="mt-2 text-sm font-semibold text-[#8a8aa8]">{email}</p>}
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          {items.filter((item) => !item.adminOnly || isAdmin).map((item) => (
            <button
              key={item.href}
              onClick={() => window.location.href = item.href}
              className="flex items-center gap-4 rounded-[22px] border border-[#1e1e32] bg-[#0f0f1a] p-4 text-left shadow-xl shadow-black/10 transition-transform active:scale-[0.99]"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#6c63ff14] text-[#7c3aed]">
                <Icon type={item.icon} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-black text-white">{item.title}</p>
                <p className="mt-1 text-sm font-semibold text-[#8a8aa8]">{item.text}</p>
              </div>
              <span className="text-2xl font-black text-[#6c63ff]">›</span>
            </button>
          ))}
        </section>

        <button
          onClick={signOut}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-[22px] border border-[#ef444444] bg-[#ef444414] px-5 py-4 text-base font-black text-[#ef4444]"
        >
          <Icon type="logout" className="h-5 w-5" />
          {tx('Odjava', 'Sign out')}
        </button>
      </div>
      <BottomNav aktivna="nastavitve" />
    </div>
  )
}
