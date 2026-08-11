import { createClient } from '@/lib/supabase/client'

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('ping_sid')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('ping_sid', id)
  }
  return id
}

function captureUTM(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const p = new URLSearchParams(window.location.search)
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'qr']
  const data: Record<string, string> = {}
  let has = false
  keys.forEach(k => { const v = p.get(k); if (v) { data[k] = v; has = true } })
  if (has) localStorage.setItem('ping_utm', JSON.stringify(data))
  return JSON.parse(localStorage.getItem('ping_utm') || '{}')
}

export function trackEvent(eventType: string, extra: Record<string, unknown> = {}) {
  try {
    const utm = captureUTM()
    const supabase = createClient()
    supabase.from('events').insert({
      session_id: getSessionId(),
      event_type: eventType,
      path: typeof window !== 'undefined' ? window.location.pathname + window.location.search : null,
      qr_code: utm.qr || null,
      metadata: { ...utm, ...extra },
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    }).then(() => {})
  } catch {
    // le suivi ne doit jamais bloquer l'usage réel
  }
}
