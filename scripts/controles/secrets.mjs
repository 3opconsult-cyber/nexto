// Recherche de secrets dans les fichiers SUIVIS par git (sans dépendance).
//   node scripts/controles/secrets.mjs
// Code de sortie 1 si un secret probable est trouvé. L'extrait affiché est masqué (6 premiers caractères seulement).
// Ce qui est accepté : la clé publique sb_publishable_, une clé JWT Supabase de rôle « anon » (publique par conception),
// les comptes de test déjà documentés dans CLAUDE.md (liste blanche ci-dessous).
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
// Sans argument : tous les fichiers suivis. Avec des chemins (relatifs à la racine) : seulement ceux-là (essai du script).
const args = process.argv.slice(2)
const files = args.length ? args : execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean)

// Mots de passe de comptes de test documentés (CLAUDE.md, section « Comptes de test ») : acceptés partout.
const MDP_OK = new Set(['AuditPing2026!', 'PingDemo2026!', 'QaPing2026!', 'LeaDemo2026!'])
// Fichiers qui ne contiennent pas de code exécutable à contrôler (verrous, médias, sorties générées).
const SKIP = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$|\.(png|jpe?g|gif|webp|ico|svg|mp4|webm|woff2?|ttf|otf|pdf|zip|gz|map|wasm)$|^public\/brand\/files\//i
// Ce script lui-même contient les motifs.
const SELF = 'scripts/controles/secrets.mjs'

const PATTERNS = [
  { nom: 'clé Stripe secrète (sk_live_)', re: /\bsk_live_[0-9A-Za-z]{10,}/g },
  { nom: 'secret de webhook Stripe (whsec_)', re: /\bwhsec_[0-9A-Za-z]{16,}/g },
  { nom: 'clé Supabase secrète (sb_secret_)', re: /\bsb_secret_[0-9A-Za-z_-]{10,}/g },
  { nom: 'clé Resend (re_...)', re: /\bre_[0-9A-Za-z]{20,}\b/g },
  { nom: 'jeton GitHub', re: /\b(ghp|gho|ghs|ghu|github_pat)_[0-9A-Za-z_]{30,}/g },
  { nom: 'clé AWS', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { nom: 'clé privée', re: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/g },
  { nom: 'clé de service en clair (SERVICE_ROLE_KEY = "...")', re: /SERVICE_ROLE_KEY['"]?\s*[:=]\s*['"`][A-Za-z0-9._-]{30,}['"`]/gi },
]
// JWT longues : acceptées seulement si le rôle décodé est « anon » (clé publique de Supabase).
const JWT = /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g
// Mot de passe en clair : « password: 'xxxx' », « mdp : xxxx », « mot de passe xxxx ».
const MDP = [
  /\b(?:password|passwd|pwd)['"]?\s*[:=]\s*['"`]([^'"`\s${}]{6,})['"`]/gi,
  /\b(?:mdp|mot de passe)\s*[:=]?\s*`?([A-Za-z][A-Za-z0-9!#$%&*?@_-]*\d[A-Za-z0-9!#$%&*?@_-]*)/gi,   // doit contenir un chiffre
]

const mask = s => s.slice(0, 6) + '…(' + s.length + ' car.)'
const trouves = []
let lus = 0

for (const f of files) {
  if (SKIP.test(f) || f === SELF) continue
  let txt
  try { if (statSync(root + '/' + f).size > 3 * 1024 * 1024) continue; txt = readFileSync(root + '/' + f, 'utf8') } catch { continue }
  if (txt.includes('\0')) continue
  lus++
  const lignes = txt.split('\n')
  lignes.forEach((l, i) => {
    if (l.length > 4000 && !/eyJ|sk_live|re_/.test(l)) return   // lignes générées (JSON, base64) : on ne les examine pas
    for (const { nom, re } of PATTERNS) {
      re.lastIndex = 0
      for (const m of l.matchAll(re)) trouves.push({ f, n: i + 1, nom, ex: mask(m[0]) })
    }
    JWT.lastIndex = 0
    for (const m of l.matchAll(JWT)) {
      let role = ''
      try { role = JSON.parse(Buffer.from(m[0].split('.')[1], 'base64url').toString('utf8')).role || '' } catch { role = 'illisible' }
      if (role === 'anon') continue
      trouves.push({ f, n: i + 1, nom: 'jeton JWT (rôle « ' + role + ' »)', ex: mask(m[0]) })
    }
    for (const re of MDP) {
      re.lastIndex = 0
      for (const m of l.matchAll(re)) {
        const v = m[1].replace(/[.!]+$/, m[1].endsWith('!') ? '!' : '')
        if (MDP_OK.has(v)) continue
        // Valeurs évidemment factices ou décrites (placeholders, noms de variables, champs d'écran).
        if (/^(•+|\*+|x{4,}|\.{3,}|<.*>|\$\{.*|.*\bvotre\b.*|.*placeholder.*|.*exemple.*)$/i.test(v)) continue
        if (/^[a-z]+(?:[A-Z][a-z]+)+$/.test(v)) continue                // identifiant camelCase (nom de variable)
        if (/^[a-z_]+$/.test(v)) continue                               // mot en minuscules (nom de champ)
        if (/^(process|import|req|body|data|form|pwd|pass|new|old|confirm|e\.|set|ref)\b/.test(v)) continue
        trouves.push({ f, n: i + 1, nom: 'mot de passe en clair (hors liste blanche)', ex: mask(v) })
      }
    }
  })
}

console.log(`${lus} fichiers suivis examinés (${files.length} au total).`)
if (!trouves.length) { console.log('OK   aucun secret trouvé'); process.exit(0) }
for (const t of trouves) console.log(`KO   ${t.f}:${t.n}  ${t.nom}  ${t.ex}`)
console.log(`\n${trouves.length} secret(s) probable(s). Si c'est un faux positif, ajouter la valeur à MDP_OK ou le fichier à SKIP dans ${SELF}.`)
process.exit(1)
