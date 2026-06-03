'use client'

export function TireSeasonIcon({ season = 'summer', className = 'h-10 w-10' }: { season?: string; className?: string }) {
  const src = season === 'winter' ? '/tire-winter-icon.webp' : '/tire-summer-icon.webp'

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={`${className} object-contain`}
      loading="lazy"
      decoding="async"
    />
  )
}
