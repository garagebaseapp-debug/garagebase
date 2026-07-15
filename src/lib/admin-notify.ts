import { supabase } from '@/lib/supabase'

type AdminNotificationKind = 'app_error' | 'bug_report' | 'feedback'

export async function notifyAdmins(kind: AdminNotificationKind, payload: Record<string, unknown> = {}) {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return

    await fetch('/api/admin/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ kind, payload }),
      keepalive: true,
    })
  } catch (error) {
    console.warn('GarageBase admin notification skipped:', error)
  }
}
