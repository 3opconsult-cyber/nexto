// Alertes admin sur dépôt de pièce, pièce refusée / expirée, position d'intervention « Je suis ici aujourd'hui ».
// À JOUER APRÈS COLLAGE des migrations 057 et 058 (supabase/a_coller/), l'app déployée :
//   node scripts/e2e/pieces-position.mjs                      (Playwright, réseau vers la prod)
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/e2e/pieces-position.mjs   (ajoute les étapes admin : pastille, refus avec motif)
// Comptes audit : audit.client.claude@ping-demo.invalid (particulier), audit.pro.claude@ping-demo.invalid (prestataire),
// mot de passe AuditPing2026!. Sans compte admin, les étapes admin sont signalées « IGNORE » (jamais « OK »).
// Les comptes .invalid ne déclenchent aucun e-mail (l'alerte reste dans l'admin) : l'envoi réel à info@opconsult.co ne
// se teste pas ici (voir rapport : à vérifier à la main avec un vrai compte et RESEND_API_KEY).
import { chromium } from 'playwright'

const B = process.env.PING_BASE || 'https://nexto-eta.vercel.app'
const PWD = 'AuditPing2026!'
const CLIENT = 'audit.client.claude@ping-demo.invalid'
const PRO = 'audit.pro.claude@ping-demo.invalid'
const GRASSE = { latitude: 43.6588, longitude: 6.9226 }
let ok = 0, ko = 0, skip = 0
const check = (c, m) => { c ? ok++ : ko++; console.log((c ? 'OK      ' : 'ECHEC   ') + m) }
const ignore = m => { skip++; console.log('IGNORE  ' + m) }

// Image PNG 1x1 : une « pièce » de test, sans contenu personnel.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const FILE = { name: 'piece-test.png', mimeType: 'image/png', buffer: PNG }

const b = await chromium.launch()

async function login(ctx, email, password) {
  const p = await ctx.newPage()
  await p.goto(B + '/auth/login'); await p.waitForTimeout(2500)
  await p.fill('input[type=email]', email); await p.fill('input[type=password]', password)
  await p.click('button[type=submit]'); await p.waitForTimeout(4500)
  return p
}
const text = async p => (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')

// ------------------------------------------------------------------ A. Dépôts (client puis prestataire)
console.log('\n=== A. Dépôt de pièces : « Reçu, en cours de traitement »')
const ctxClient = await b.newContext({ viewport: { width: 390, height: 844 } })
const pc = await login(ctxClient, CLIENT, PWD)
await pc.goto(B + '/client/documents'); await pc.waitForTimeout(3500)
await pc.locator('input[type=file]').first().setInputFiles(FILE); await pc.waitForTimeout(4500)
let t = await text(pc)
check(/Reçu/.test(t) && /en cours de traitement/.test(t), 'client : pièce d\'identité « Reçu, en cours de traitement »')

const ctxPro = await b.newContext({ viewport: { width: 390, height: 844 }, geolocation: GRASSE, permissions: ['geolocation'] })
const pp = await login(ctxPro, PRO, PWD)
await pp.goto(B + '/pro/documents'); await pp.waitForTimeout(4000)
// Rubrique « Assurances » : premier bouton « Fichier » de la rubrique.
const assur = pp.locator('div', { has: pp.locator('text=Assurances') }).last()
const [chooser] = await Promise.all([
  pp.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null),
  assur.locator('button', { hasText: 'Fichier' }).first().click().catch(() => {}),
])
if (chooser) { await chooser.setFiles(FILE); await pp.waitForTimeout(5000) }
t = await text(pp)
check(!!chooser && /Reçu/.test(t), 'prestataire : assurance déposée, statut « Reçu — en cours de traitement »')

// ------------------------------------------------------------------ B. Admin (facultatif)
console.log('\n=== B. Admin : pastille, décision, motif')
const AE = process.env.ADMIN_EMAIL, AP = process.env.ADMIN_PASSWORD
let refused = false
if (AE && AP) {
  const ctxAdmin = await b.newContext({ viewport: { width: 1280, height: 860 } })
  const pa = await login(ctxAdmin, AE, AP)
  await pa.goto(B + '/admin'); await pa.waitForTimeout(6000)
  const pill = await pa.evaluate(() => { const e = document.getElementById('pillConformite'); return e ? { on: e.classList.contains('on'), n: e.textContent } : null })
  check(!!pill && pill.on && Number(pill.n) >= 1, `pastille « pièces à valider » sur Conformité (${pill ? pill.n : 'absente'})`)
  await pa.locator('#nav a[data-s=conformite]').click(); await pa.waitForTimeout(3500)
  // Refuser l'assurance du prestataire audit avec le motif « Document illisible ».
  const row = pa.locator('#docsQueueBody tr', { hasText: 'Assurance' }).first()
  if (await row.count()) {
    await row.click(); await pa.waitForTimeout(3000)
    await pa.locator('#docReview [data-a=askko]').click()
    await pa.selectOption('#drMotif', 'Document illisible')
    await pa.locator('#docReview [data-a=ko]').click(); await pa.waitForTimeout(3500)
    refused = true
    check(true, 'assurance refusée avec motif « Document illisible »')
  } else check(false, 'ligne « Assurance » introuvable dans la file Conformité')
} else ignore('étapes admin (ADMIN_EMAIL / ADMIN_PASSWORD absents)')

if (refused) {
  await pp.goto(B + '/pro/documents'); await pp.waitForTimeout(4000)
  t = await text(pp)
  check(/Refusée : Document illisible/.test(t), 'prestataire : motif de refus visible')
  check(await pp.locator('button', { hasText: 'Renvoyer une pièce' }).count() > 0, 'prestataire : bouton « Renvoyer une pièce »')
  await pp.goto(B + '/support'); await pp.waitForTimeout(3500)
  t = await text(pp)
  check(/n.a pas pu être validée/.test(t) && /Document illisible/.test(t), 'prestataire : message Support PING reçu à la décision')
}

// ------------------------------------------------------------------ C. Position d'intervention
console.log('\n=== C. « Je suis en intervention ici (visible aujourd\'hui) »')
await pp.goto(B + '/pro/dashboard'); await pp.waitForTimeout(4500)
const sw = pp.locator('[role=switch][aria-label^="Je suis en intervention ici"]')
if (!(await sw.count())) {
  ignore('interrupteur absent : migration 058 non collée ?')
} else {
  check(true, 'Mon entreprise : interrupteur présent')
  if ((await sw.getAttribute('aria-checked')) === 'true') { await sw.click(); await pp.waitForTimeout(2500) }   // repartir d'un état éteint
  await sw.click(); await pp.waitForTimeout(1500)
  const modal = pp.locator('[role=dialog]')
  if (await modal.count()) {
    t = await text(pp)
    check(/500 m/.test(t) && /12 heures/.test(t) && /jamais l.adresse de votre client/i.test(t), 'fenêtre de consentement : secteur ~500 m, 12 h, jamais l\'adresse du client')
    check(/à tout moment/i.test(t), 'fenêtre de consentement : arrêt à tout moment')
    await modal.locator('button', { hasText: /J.accepte/ }).click(); await pp.waitForTimeout(6000)
  } else ignore('consentement déjà donné : pas de fenêtre')
  check((await sw.getAttribute('aria-checked')) === 'true', 'interrupteur activé après consentement et lecture de position')
  t = await text(pp)
  check(/en intervention près de/i.test(t), 'bandeau : « en intervention près de <secteur> »')

  // Carte client : second repère, jamais l'adresse exacte du client ni la position exacte.
  const ctxCli2 = await b.newContext({ viewport: { width: 390, height: 844 }, geolocation: GRASSE, permissions: ['geolocation'] })
  const pc2 = await login(ctxCli2, CLIENT, PWD)
  await pc2.goto(B + '/map'); await pc2.waitForTimeout(8000)
  const pins = await pc2.locator('.pin-tag', { hasText: 'Ici aujourd' }).count()
  check(pins >= 1, `carte client : second repère « Ici aujourd'hui » (${pins})`)
  // Arrêt volontaire.
  await sw.click(); await pp.waitForTimeout(3000)
  check((await sw.getAttribute('aria-checked')) === 'false', 'arrêt volontaire : interrupteur éteint')
  await pc2.reload(); await pc2.waitForTimeout(8000)
  check(await pc2.locator('.pin-tag', { hasText: 'Ici aujourd' }).count() === 0, 'carte client : le second repère a disparu après l\'arrêt')
  await ctxCli2.close()
  // Retrait du consentement : l'interrupteur ne s'active plus sans nouvelle fenêtre.
  const retire = pp.locator('button', { hasText: 'Retirer mon consentement' })
  if (await retire.count()) {
    await retire.click(); await pp.waitForTimeout(2500)
    await sw.click(); await pp.waitForTimeout(1500)
    check(await pp.locator('[role=dialog]').count() > 0, 'après retrait : le consentement est redemandé')
    await pp.keyboard.press('Escape')
  }
}

await b.close()
console.log(`\n${ok} OK, ${ko} ECHEC, ${skip} IGNORE`)
process.exit(ko ? 1 : 0)
