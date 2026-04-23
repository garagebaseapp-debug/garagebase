'use client'

// Spodnja navigacija — GLAVNA (garaza, stroski-garaza)
export function BottomNav({ aktivna }: { aktivna?: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a12] border-t border-[#1a1a28] flex justify-around py-3 px-4 z-50">
      <button onClick={() => window.location.href = '/garaza'}
        className="flex flex-col items-center gap-1">
        <span className="text-xl">🏠</span>
        <span className={`text-[9px] uppercase tracking-wider font-bold ${aktivna === 'garaza' ? 'text-[#6c63ff]' : 'text-[#3a3a5a]'}`}>Garaža</span>
      </button>
      <button onClick={() => window.location.href = '/vnos-goriva'}
        className="flex flex-col items-center gap-1">
        <span className="text-xl">⛽</span>
        <span className={`text-[9px] uppercase tracking-wider ${aktivna === 'gorivo' ? 'text-[#6c63ff] font-bold' : 'text-[#3a3a5a]'}`}>Gorivo</span>
      </button>
      <button onClick={() => window.location.href = '/vnos-servisa'}
        className="flex flex-col items-center gap-1">
        <span className="text-xl">🔧</span>
        <span className={`text-[9px] uppercase tracking-wider ${aktivna === 'servis' ? 'text-[#6c63ff] font-bold' : 'text-[#3a3a5a]'}`}>Servis</span>
      </button>
      <button onClick={() => window.location.href = '/stroski-garaza'}
        className="flex flex-col items-center gap-1">
        <span className="text-xl">📊</span>
        <span className={`text-[9px] uppercase tracking-wider ${aktivna === 'stroski' ? 'text-[#6c63ff] font-bold' : 'text-[#3a3a5a]'}`}>Stroški</span>
      </button>
      <button className="flex flex-col items-center gap-1">
        <span className="text-xl">⚙️</span>
        <span className="text-[9px] uppercase tracking-wider text-[#3a3a5a]">Več</span>
      </button>
    </div>
  )
}

// Samo garaža gumb — za podstrani
export function HomeButton() {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a12] border-t border-[#1a1a28] flex justify-center py-3 px-4 z-50">
      <button onClick={() => window.location.href = '/garaza'}
        className="flex flex-col items-center gap-1">
        <span className="text-xl">🏠</span>
        <span className="text-[9px] uppercase tracking-wider text-[#6c63ff] font-bold">Garaža</span>
      </button>
    </div>
  )
}

// Puščica nazaj
export function BackButton({ href, label }: { href?: string, label?: string }) {
  return (
    <button
      onClick={() => href ? window.location.href = href : window.history.back()}
      className="w-10 h-10 rounded-xl bg-[#13131f] border border-[#2a2a40] flex items-center justify-center text-[#8080a0] hover:text-white hover:border-[#6c63ff] hover:bg-[#1a1a30] transition-all active:scale-95">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}