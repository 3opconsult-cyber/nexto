// Réservation RÉELLE « Chaque semaine (4 semaines) » sur la production, compte audit client -> prestataire audit.
// Crée 4 réservations marquées « QA fréquence » (à nettoyer avec l'accord de Romain). À lancer après chaque mise en prod
// qui touche /mission/new. BASE=https://nexto-eta.vercel.app node reservation-reelle.mjs
import { chromium } from 'playwright'
import fs from 'fs'
const BASE = process.env.BASE || 'https://nexto-eta.vercel.app'
const CLIENT = 'audit.client.claude@ping-demo.invalid'
const PRO_ID = 'b9f8cd9a-16de-4a36-afd8-10a2135ab970'
const PWD = process.env.AUDIT_PWD || fs.readFileSync(new URL('./parcours.mjs', import.meta.url), 'utf8').match(/PWD = '([^']+)'/)[1]
const norm = s => s.replace(/[\s  ]+/g, ' ').trim()
let ko = 0
const check = (k, v, ok) => { if (!ok) ko++; console.log(ok ? 'OK' : 'KO', k, typeof v === 'string' ? v : JSON.stringify(v)) }
const browser = await chromium.launch()
const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
const page = await c.newPage()
const rpcs = []
page.on('response', r => { const m = r.url().match(/\/rpc\/(book_service|book_slot)/); if (m) rpcs.push(`${m[1]} ${r.status()}`) })
await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle' })
await page.locator('input[type=email]').fill(CLIENT)
await page.locator('input[type=password]').fill(PWD)
await page.locator('button[type=submit], button:has-text("connecter")').first().click()
await page.waitForTimeout(3500)
const d = new Date(Date.now() + 3 * 86400000); d.setHours(10, 0, 0, 0)
const when = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T10:00`
await page.goto(BASE + `/mission/new?pro=${PRO_ID}&trade=menage&when=${encodeURIComponent(when)}&need=${encodeURIComponent('Ménage')}`, { waitUntil: 'networkidle' })
await page.waitForFunction(() => /Confirmer/.test(document.body.innerText), null, { timeout: 25000 }).catch(() => { })
await page.waitForTimeout(3000)
await page.screenshot({ path: '/tmp/cartes/reelle-avant.png', fullPage: true })
const wk = page.getByRole('button', { name: 'Chaque semaine (4 semaines)' })
if (!(await wk.count())) { console.log('KO bouton absent ; texte :', norm(await page.locator('body').innerText()).slice(0, 500)); process.exit(1) }
await wk.tap()
await page.waitForTimeout(600)
const desc = page.locator('textarea').first()
if (await desc.count()) await desc.fill('QA fréquence 23-11 : réservation hebdomadaire de test')
await page.getByRole('button', { name: /^Confirmer les/ }).tap()
await page.waitForTimeout(15000)
const body = norm(await page.locator('body').innerText())
await page.screenshot({ path: '/tmp/cartes/reelle-apres.png', fullPage: true })
const created = rpcs.filter(x => /200|201|204/.test(x)).length
check('appels de réservation', rpcs, rpcs.length >= 1)
check('au moins 1 réservation créée sans erreur', created, created >= 1)
console.log('Texte de fin :', body.slice(0, 600))
await browser.close()
process.exit(ko ? 1 : 0)
