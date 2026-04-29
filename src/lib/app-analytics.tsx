'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { trackError, trackEvent } from '@/lib/analytics'

export function AppAnalytics() {
  const pathname = usePathname()

  useEffect(() => {
    trackEvent('page_view', {
      path: pathname,
      search: window.location.search,
      standalone: window.matchMedia('(display-mode: standalone)').matches,
      width: window.innerWidth,
    })
  }, [pathname])

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      trackError('browser_error', {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack,
      })
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      trackError('unhandled_rejection', {
        message: reason?.message || String(reason),
        stack: reason?.stack,
      })
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  return null
}
