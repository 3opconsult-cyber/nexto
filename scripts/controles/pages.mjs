// Contrôle des pages principales du site en ligne (sans identifiants, sans écriture, lecture seule).
//   BASE=https://nexto-eta.vercel.app node scripts/controles/pages.mjs
// Derrière un proxy (bac à sable) : NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=<bundle> node scripts/controles/pages.mjs
// Sortie : une ligne par page. Code de sortie 1 si une page principale est en erreur, 0 sinon.
// Tolérance : une redirection (301/302/307/308) vers la même page ou vers /bienvenue est suivie une fois.
const BASE = (process.env.BASE || 'https://nexto-eta.vercel.app').replace(/\/$/, '')
const TIMEOUT = Number(process.env.PAGES_TIMEOUT_MS || 20000)

// Pages publiques : doivent répondre 200 (après au plus une redirection interne).
const PUBLIQUES = ['/', '/auth/login', '/auth/signup', '/bienvenue', '/plaquettes', '/aide', '/cgu', '/confidentialite']

async function get(p) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), TIMEOUT)
  try { return await fetch(BASE + p, { redirect: 'manual', signal: ctl.signal, headers: { 'user-agent': 'ping-controles/1.0' } }) }
  finally { clearTimeout(t) }
}
const isRedirect = s => s >= 300 && s < 400

let ko = 0
const line = (ok, p, msg) => { if (!ok) ko++; console.log((ok ? 'OK   ' : 'KO   ') + p.padEnd(18) + msg) }

for (const p of PUBLIQUES) {
  try {
    let r = await get(p), note = ''
    if (isRedirect(r.status)) {
      const loc = r.headers.get('location') || ''
      const next = new URL(loc, BASE + p)
      note = ` (redirige vers ${next.pathname})`
      r = await get(next.pathname + next.search)
    }
    line(r.status === 200, p, 'HTTP ' + r.status + note)
  } catch (e) { line(false, p, 'injoignable : ' + (e.cause?.message || e.message)) }
}

// /map sans session : redirection vers l'inscription (AuthGate). Selon le déploiement, le garde est côté serveur
// (redirection HTTP) ou côté navigateur (la page répond 200 puis redirige) : on accepte les deux, on dit lequel.
try {
  const r = await get('/map')
  if (isRedirect(r.status)) {
    const loc = r.headers.get('location') || ''
    line(/\/auth\/(signup|login)/.test(loc), '/map', `HTTP ${r.status} vers ${loc} (garde côté serveur)`)
  } else if (r.status === 200) {
    // Garde côté navigateur : la redirection se fait après le chargement, invisible sans navigateur (scripts/e2e/ le vérifie).
    line(true, '/map', 'HTTP 200 : garde côté navigateur (redirection non observable sans navigateur)')
  } else line(false, '/map', 'HTTP ' + r.status)
} catch (e) { line(false, '/map', 'injoignable : ' + (e.cause?.message || e.message)) }

// /admin : répond (200, ou redirection vers la connexion). Jamais 5xx.
try {
  const r = await get('/admin')
  line(r.status < 500, '/admin', 'HTTP ' + r.status + (isRedirect(r.status) ? ' vers ' + r.headers.get('location') : ''))
} catch (e) { line(false, '/admin', 'injoignable : ' + (e.cause?.message || e.message)) }

console.log(ko ? `\n${ko} page(s) en erreur sur ${BASE}` : `\nToutes les pages principales répondent sur ${BASE}`)
process.exit(ko ? 1 : 0)
