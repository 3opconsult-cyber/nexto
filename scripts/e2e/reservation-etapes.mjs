// Réservation en étapes numérotées (maquette v11) : mobile 390x844, compte audit client.
// Parcourt « Prestation, Quand, Fréquence, Adresse, Paiement » jusqu'à l'écran de confirmation et vérifie le calcul
// « 4 réservations de X € = total Y € ». NE CRÉE AUCUNE RÉSERVATION : les appels book_service et book_slot sont
// bloqués côté navigateur (le compteur doit rester à 0).
//   BASE=http://localhost:3000 node scripts/e2e/reservation-etapes.mjs        (depuis la racine du dépôt)
// Écrit docs/maquette-ecarts-2026-11-23/*-5.jpg et reservation-etapes.json. Mot de passe des comptes audit : lu dans
// parcours.mjs, jamais recopié.
import { chromium } from 'playwright'
import fs from 'fs'

const BASE = process.env.BASE || 'http://localhost:3000'
const CLIENT = 'audit.client.claude@ping-demo.invalid'
const PRO_ID = 'b9f8cd9a-16de-4a36-afd8-10a2135ab970'
const PWD = process.env.AUDIT_PWD || fs.readFileSync(new URL('./parcours.mjs', import.meta.url), 'utf8').match(/PWD = '([^']+)'/)[1]
const OUT = new URL('../../docs/maquette-ecarts-2026-11-23/', import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })
const res = { base: BASE, checks: [] }
const check = (k, v, ok) => { res.checks.push({ k, v, ok: !!ok }); console.log(ok ? 'OK' : 'KO', k, typeof v === 'string' ? v : JSON.stringify(v)); return ok }
const shot = (page, name) => page.screenshot({ path: `${OUT}${name}.jpg`, quality: 72, type: 'jpeg', fullPage: true })
const eur = c => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(c / 100)
const norm = s => s.replace(/[\s  ]+/g, ' ').trim()
const parseEur = s => { const m = norm(s).match(/(\d+(?:[ ]\d{3})*(?:,\d{1,2})?)\s*€/); return m ? Math.round(parseFloat(m[1].replace(/ /g, '').replace(',', '.')) * 100) : null }

const browser = await chromium.launch()
try {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
  const page = await c.newPage()
  const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 160)))
  let bookAttempts = 0
  await page.route(/\/rpc\/(book_service|book_slot)/, r => { bookAttempts++; r.abort() })
  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle' })
  await page.locator('input[type=email]').fill(CLIENT)
  await page.locator('input[type=password]').fill(PWD)
  await page.locator('button[type=submit], button:has-text("connecter")').first().click()
  await page.waitForTimeout(3500)

  // Date de départ : dans 3 jours à 10 h (heure locale du navigateur), comme un préremplissage venu de /map.
  const d = new Date(Date.now() + 3 * 86400000); d.setHours(10, 0, 0, 0)
  const when = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T10:00`

  async function open(url) {
    await page.goto(BASE + url, { waitUntil: 'networkidle' }).catch(() => { })
    await page.waitForFunction(() => /Confirmer la réservation|Confirmer les|Demander un devis/.test(document.body.innerText), null, { timeout: 25000 }).catch(() => { })
    await page.waitForTimeout(1200)
  }
  const body = async () => norm(await page.locator('body').innerText())

  // 1. Sans préremplissage : les 5 étapes numérotées, dans l'ordre de la maquette.
  await open(`/mission/new?pro=${PRO_ID}`)
  let b = await body()
  const titres = ['1. Prestation', '2. Quand ?', '3. Fréquence', '4. Adresse']
  const pos = titres.map(t => b.toUpperCase().indexOf(t.toUpperCase()))
  check('étapes 1 à 4 numérotées, dans l’ordre de la maquette', pos, pos.every((p, i) => p >= 0 && (i === 0 || p > pos[i - 1])))
  check('libellés « Une fois » et « Chaque semaine (4 semaines) »', '', /Une fois/.test(b) && /Chaque semaine \(4 semaines\)/.test(b))
  check('bouton « Confirmer la réservation · prix »', (b.match(/Confirmer la réservation[^A-Z]{0,20}/) || [''])[0], /Confirmer la réservation · [\d\s,]+€/.test(b))
  await shot(page, 'reservation-etapes-5-app-complet')

  // 2. Préremplissage depuis /map : prestation et adresse repliées (une ligne + Modifier).
  await open(`/mission/new?pro=${PRO_ID}&trade=menage&when=${encodeURIComponent(when)}&need=${encodeURIComponent('Ménage')}`)
  b = await body()
  const modifier = await page.getByRole('button', { name: /^Modifier/ }).count()
  check('étapes connues repliées avec « Modifier »', modifier, modifier >= 1)
  await shot(page, 'reservation-etapes-5-app-prerempli')

  // 3. Fréquence « Chaque semaine » : « 4 réservations de X € = total Y € ».
  const weekly = page.getByRole('button', { name: 'Chaque semaine (4 semaines)' })
  const hasWeekly = await weekly.count()
  if (check('bouton Chaque semaine présent (hors devis)', hasWeekly, hasWeekly === 1)) {
    const wb = await weekly.boundingBox()
    check('cible >= 44 px', `${Math.round(wb.width)}x${Math.round(wb.height)}`, wb.height >= 43.5)
    await weekly.tap()
    await page.waitForTimeout(500)
    const prixUn = parseEur(await page.locator('[data-testid="prix-un"]').innerText())
    const ligne = norm(await page.locator('[data-testid="rep-total"]').innerText().catch(() => ''))
    const m = ligne.match(/^(\d+) réservations de (.+?) = total (.+)$/)
    check('ligne « N réservations de X € = total Y € »', ligne, !!m)
    if (m) {
      const n = +m[1], x = parseEur(m[2]), y = parseEur(m[3])
      check('X = prix affiché pour une réservation', `${x} / ${prixUn}`, x === prixUn)
      check('total = N × X', `${n} x ${x} = ${y}`, y === n * x)
      check('4 réservations quand les 4 semaines existent', n, n === 4 || /Aucun créneau publié/.test(await body()))
    }
    await page.waitForTimeout(300)
    await shot(page, 'reservation-etapes-5-app-chaque-semaine')
    const bt = norm(await page.getByRole('button', { name: /^Confirmer/ }).innerText())
    check('bouton de confirmation affiche le total', bt, /Confirmer (la|les \d+) réservations? · /.test(bt))
    // Retour à « Une fois » : le calcul disparaît.
    await page.getByRole('button', { name: 'Une fois' }).tap()
    check('« Une fois » retire la ligne de total', await page.locator('[data-testid="rep-total"]').count(), (await page.locator('[data-testid="rep-total"]').count()) === 0)
  }
  // Cibles tactiles de la page.
  const petits = await page.evaluate(() => [...document.querySelectorAll('button, a[href], input[type=checkbox]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && Math.min(r.width, r.height) < 43.5 }).map(e => `${(e.getAttribute('aria-label') || e.innerText || '').trim().slice(0, 28)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`))
  check('cibles < 44 px sur l’écran', petits, petits.length === 0)
  check('aucune réservation créée (book_service / book_slot jamais envoyés)', bookAttempts, bookAttempts === 0)
  check('erreurs de page', errs, errs.length === 0)
  await c.close()
} finally { await browser.close() }
fs.writeFileSync(`${OUT}reservation-etapes.json`, JSON.stringify(res, null, 1))
const ko = res.checks.filter(x => !x.ok)
console.log(ko.length ? `${ko.length} KO` : 'tout OK')
process.exit(ko.length ? 1 : 0)
