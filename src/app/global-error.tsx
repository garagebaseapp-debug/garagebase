'use client'

import { useEffect } from 'react'
import { trackError } from '@/lib/analytics'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => {
    trackError('react_global_error', {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
    })
  }, [error])

  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          background: '#080810',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{
            width: '100%',
            maxWidth: 440,
            border: '1px solid #ef444455',
            background: '#0f0f1a',
            borderRadius: 24,
            padding: 24,
            textAlign: 'center',
          }}>
            <h1 style={{ fontSize: 24, margin: 0 }}>GarageBase</h1>
            <p style={{ color: '#fca5a5', marginTop: 12, lineHeight: 1.5 }}>
              Prišlo je do napake. Napaka je bila samodejno poslana v admin panel.
            </p>
            <button onClick={reset} style={{
              marginTop: 20,
              width: '100%',
              border: 0,
              borderRadius: 14,
              background: '#6c63ff',
              color: '#ffffff',
              fontWeight: 700,
              padding: '12px 16px',
            }}>
              Poskusi ponovno
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
