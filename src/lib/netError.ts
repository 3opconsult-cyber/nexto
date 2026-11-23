// Erreurs réseau : une seule phrase française claire, partout (audit GPS et hors connexion du 23/11/2026, correction 3).
// Le navigateur dit « Failed to fetch » (Chrome), « Load failed » (Safari) ou « NetworkError… » (Firefox) quand le
// réseau est coupé : ces textes bruts ne s'affichent plus jamais.

export const OFFLINE_TEXT = 'Pas de connexion. Vérifiez votre réseau, puis réessayez.'
export const SLOW_TEXT = 'La connexion est trop lente. Réessayez dans un instant.'
/** Durée d'affichage d'un message d'erreur (avant : 4 s, trop court pour lire sur un téléphone). */
export const ERR_MS = 9000

export const NET_EVENT = 'ping:net'
const NET_RE = /failed to fetch|networkerror|network request failed|load failed|fetch failed|network error|err_internet|err_network|err_connection/i

export const isNetworkMessage = (m?: string | null): boolean => !!m && (NET_RE.test(m) || m === OFFLINE_TEXT)

/** Phrase française pour une erreur quelconque (Error, texte, erreur Supabase). Jamais de texte anglais brut du navigateur. */
export function friendlyError(e: unknown, fallback = 'Une erreur est survenue. Réessayez dans un instant.'): string {
  const m = typeof e === 'string' ? e : (e as { message?: string } | null | undefined)?.message
  if (!m) return fallback
  if (isNetworkMessage(m)) return OFFLINE_TEXT
  if (/abort|timeout|timed out/i.test(m)) return SLOW_TEXT
  return m
}

function emit(kind: 'fail' | 'ok') {
  try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(NET_EVENT, { detail: kind })) } catch { /* sans objet */ }
}

/**
 * `fetch` du client Supabase : une coupure réseau ne lève plus « TypeError: Failed to fetch » mais devient une réponse
 * 503 portant la phrase française. Toutes les erreurs affichées par l'application (lectures, écritures, stockage)
 * sont ainsi lisibles sans toucher chaque écran. Annulation (abort) : relancée telle quelle. La bannière globale
 * écoute NET_EVENT.
 */
export const pingFetch: typeof fetch = async (input, init) => {
  try {
    const r = await fetch(input, init)
    emit('ok')
    return r
  } catch (e) {
    if ((e as { name?: string } | null)?.name === 'AbortError') throw e
    emit('fail')
    return new Response(
      JSON.stringify({ code: 'PING_OFFLINE', message: OFFLINE_TEXT, msg: OFFLINE_TEXT, error: OFFLINE_TEXT, error_description: OFFLINE_TEXT }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
