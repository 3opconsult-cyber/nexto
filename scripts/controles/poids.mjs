// Poids des pages après `next build` : lit la sortie du build (tableau « Route (app) ... First Load JS »).
//   npm run build 2>&1 | tee build.log ; node scripts/controles/poids.mjs build.log
// Seuils (orange, jamais bloquant) réglables par variables : POIDS_PAGE_KO (défaut 350 ko de « First Load JS » pour une page),
// POIDS_PARTAGE_KO (défaut 150 ko pour le socle partagé). Code de sortie 0 toujours ; les dépassements sont écrits
// « ATTENTION » et, dans GitHub Actions, en avertissement (::warning::).
import { readFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) { console.log('Usage : node scripts/controles/poids.mjs <sortie-du-build.log>'); process.exit(0) }
const SEUIL_PAGE = Number(process.env.POIDS_PAGE_KO || 350)
const SEUIL_PARTAGE = Number(process.env.POIDS_PARTAGE_KO || 150)
const gha = !!process.env.GITHUB_ACTIONS

const toKb = (n, u) => { const v = parseFloat(n); return u === 'MB' ? v * 1024 : u === 'B' ? v / 1024 : v }
const lignes = readFileSync(file, 'utf8').split('\n')

let partage = null
const pages = []
for (const l of lignes) {
  // « ├ ○ /aide                 2.1 kB         95.4 kB »   ou   « + First Load JS shared by all  87.5 kB »
  const sh = l.match(/First Load JS shared by all\s+([\d.]+)\s*(kB|MB|B)/i)
  if (sh) { partage = toKb(sh[1], sh[2].toUpperCase()); continue }
  const m = l.match(/^[├└┌│\s]*[○●ƒλ]\s+(\/\S*)\s+([\d.]+)\s*(kB|MB|B)\s+([\d.]+)\s*(kB|MB|B)\s*$/i)
  if (m) pages.push({ route: m[1], propre: toKb(m[2], m[3].toUpperCase()), total: toKb(m[4], m[5].toUpperCase()) })
}

if (!pages.length) { console.log('ATTENTION : aucune page lue dans la sortie du build (format changé ?)'); process.exit(0) }
pages.sort((a, b) => b.total - a.total)
console.log(`${pages.length} pages lues. Socle partagé : ${partage == null ? 'inconnu' : partage.toFixed(1) + ' ko'} (seuil ${SEUIL_PARTAGE} ko).`)
console.log('Les 8 pages les plus lourdes (First Load JS) :')
for (const p of pages.slice(0, 8)) console.log('  ' + p.total.toFixed(1).padStart(7) + ' ko  ' + p.route + '  (propre ' + p.propre.toFixed(1) + ' ko)')

const trop = pages.filter(p => p.total > SEUIL_PAGE)
const avert = m => console.log((gha ? '::warning::' : 'ATTENTION ') + m)
if (partage != null && partage > SEUIL_PARTAGE) avert(`le socle partagé pèse ${partage.toFixed(1)} ko (seuil ${SEUIL_PARTAGE} ko)`)
for (const p of trop) avert(`${p.route} pèse ${p.total.toFixed(1)} ko au premier chargement (seuil ${SEUIL_PAGE} ko)`)
if (!trop.length && (partage == null || partage <= SEUIL_PARTAGE)) console.log('OK   poids sous les seuils')
process.exit(0)
