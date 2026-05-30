'use client'

export function TireSeasonIcon({ season = 'all_season', className = 'h-10 w-10' }: { season?: string; className?: string }) {
  const showSun = season === 'summer' || season === 'all_season'
  const showSnow = season === 'winter' || season === 'all_season'
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="gbTireRubber" cx="34%" cy="30%" r="72%">
          <stop offset="0%" stopColor="#343844" />
          <stop offset="52%" stopColor="#151821" />
          <stop offset="100%" stopColor="#05060a" />
        </radialGradient>
        <filter id="gbTireSoftShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1.2" dy="2" stdDeviation="1.4" floodColor="#02030a" floodOpacity="0.35" />
        </filter>
      </defs>
      <ellipse cx="34" cy="35" rx="22" ry="20" fill="url(#gbTireRubber)" filter="url(#gbTireSoftShadow)" />
      <ellipse cx="31" cy="35" rx="10" ry="13" fill="#05060a" />
      <ellipse cx="31" cy="35" rx="14" ry="17" stroke="#2b303a" strokeWidth="4" opacity="0.9" />
      <g stroke="#05060a" strokeWidth="2.2" strokeLinecap="round" opacity="0.92">
        <path d="M44 17c4 5 6 11 6 18" />
        <path d="M48 22c-3 1-6 1-9 0" />
        <path d="M51 29c-4 1-7 1-11 0" />
        <path d="M52 36c-4 1-8 1-12 0" />
        <path d="M50 43c-4 1-7 1-11 0" />
        <path d="M46 49c-3 0-5-1-8-2" />
      </g>
      {showSun && (
        <g stroke="#ffd400" strokeWidth="3.4" strokeLinecap="round" filter="url(#gbTireSoftShadow)">
          <circle cx="16" cy="16" r="5.5" fill="#fff38a" stroke="#ffd400" />
          <path d="M16 4.5v4M16 23.5v4M4.5 16h4M23.5 16h4M7.8 7.8l2.9 2.9M24.2 24.2l-2.9-2.9M24.2 7.8l-2.9 2.9M7.8 24.2l2.9-2.9" />
        </g>
      )}
      {showSnow && (
        <g strokeLinecap="round" strokeLinejoin="round" filter="url(#gbTireSoftShadow)">
          <path d="M48 38v18M40.2 42.5l15.6 9M55.8 42.5l-15.6 9M48 38l-4 5M48 38l4 5M48 56l-4-5M48 56l4-5" stroke="#d8dde7" strokeWidth="5.8" />
          <path d="M48 38v18M40.2 42.5l15.6 9M55.8 42.5l-15.6 9M48 38l-4 5M48 38l4 5M48 56l-4-5M48 56l4-5" stroke="#ffffff" strokeWidth="3.8" />
        </g>
      )}
    </svg>
  )
}
