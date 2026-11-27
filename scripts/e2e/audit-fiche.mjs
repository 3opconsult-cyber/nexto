// Audit Design 27/11 : carte -> épingle -> aperçu -> fiche -> Réserver (s'arrête avant de valider). Lecture seule.
import { chromium } from 'playwright'
import fs from 'fs'
const BASE = process.env.BASE || 'https://nexto-eta.vercel.app', OUT = process.env.OUT || 'shots-audit-fiche/'
const PWD = fs.readFileSync(new URL('./parcours.mjs', import.meta.url), 'utf8').match(/PWD = '([^']+)'/)[1]
fs.mkdirSync(OUT, { recursive: true })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, geolocation: { latitude: 43.70, longitude: 7.26 }, permissions: ['geolocation'] })
const p = await ctx.newPage()
let n = 0; const shot = async name => { await p.screenshot({ path: `${OUT}${String(++n).padStart(2, '0')}-${name}.jpg`, type: 'jpeg', quality: 60 }); console.log('capture', n, name) }
await p.goto(BASE + '/auth/login', { waitUntil: 'networkidle' })
await p.locator('input[type=email]').fill('audit.client.claude@ping-demo.invalid'); await p.locator('input[type=password]').fill(PWD)
await p.locator('button[type=submit]').first().click(); await p.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 20000 }).catch(() => {}); await sleep(1500)
await p.goto(BASE + '/map', { waitUntil: 'networkidle' }); await sleep(6000); await shot('carte')
console.log('épingles', await p.locator('.ping-pin').count(), 'statut', await p.locator('[data-map-status]').innerText().catch(() => ''))
await p.locator('[data-map-status]').click().catch(() => {}); await sleep(800); await shot('detail-statut'); await p.keyboard.press('Escape'); await p.locator('[data-map-status]').click().catch(() => {}); await sleep(500)
// liste des prestataires
await p.getByText('Afficher', { exact: true }).first().click().catch(() => {}); await sleep(1200); await shot('liste')
await p.goto(BASE + '/map', { waitUntil: 'networkidle' }); await sleep(6000)
const pin = p.locator('.ping-pin').first()
if (await pin.count()) { await pin.click({ force: true }); await sleep(1500); await shot('apercu-epingle')
  console.log('aperçu', (await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(-600)) }
const fiche = p.locator('a[href^="/pro/"], button:has-text("Voir la fiche"), button:has-text("fiche")').first()
if (await fiche.count()) { await fiche.click(); await sleep(3000) } else { await p.goto(BASE + '/pro/b9f8cd9a-16de-4a36-afd8-10a2135ab970', { waitUntil: 'networkidle' }); await sleep(2500) }
console.log('url fiche', p.url().replace(BASE, ''))
await shot('fiche-haut'); await p.mouse.wheel(0, 700); await sleep(600); await shot('fiche-milieu'); await p.mouse.wheel(0, 3000); await sleep(600); await shot('fiche-bas')
console.log('fiche', (await p.locator('main, body').first().innerText()).replace(/\s+/g, ' ').slice(0, 1500))
const res = p.getByRole('button', { name: /^Réserver/ }).first()
if (await res.count()) { await res.click(); await sleep(3000); await shot('reserver-1'); console.log('réserver url', p.url().replace(BASE, ''))
  console.log('réserver', (await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 900)) }
await b.close()
