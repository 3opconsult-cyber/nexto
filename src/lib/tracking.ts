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
    // user_id n'etait jamais rempli (toujours null) alors que la policy RLS
    // "events admin read" s'appuie dessus pour la lecture self — sans ça,
    // impossible de relier le parcours anonyme (avant inscription) au compte
    // une fois connecte, au-dela du seul session_id local.
    supabase.auth.getUser().then(({ data: { user } }) => {
      supabase.from('events').insert({
        session_id: getSessionId(),
        user_id: user?.id ?? null,
        event_type: eventType,
        path: typeof window !== 'undefined' ? safePath() : null,
        qr_code: utm.qr || null,
        // Mode (particulier / pro) au moment de l'action : un même compte peut être les deux.
        metadata: { ...utm, mode: (() => { try { return localStorage.getItem('ping_mode') === 'pro' ? 'pro' : 'particulier' } catch { return null } })(), ...extra },
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      }).then(() => {})
    })
  } catch {
    // le suivi ne doit jamais bloquer l'usage réel
  }
}

// Chemin sans paramètres sensibles (21/11/2026, critique données) : jeton du QR de présence (?token=), code de connexion
// (?code=) et tout le reste sont retirés ; seules les clés de suivi marketing (utm_*, qr, ref) sont gardées.
function safePath(): string {
  const keep = ['qr', 'ref']
  const sp = new URLSearchParams(window.location.search)
  const out = new URLSearchParams()
  sp.forEach((v, k) => { if (k.startsWith('utm_') || keep.includes(k)) out.set(k, v) })
  const q = out.toString()
  return window.location.pathname + (q ? '?' + q : '')
}
