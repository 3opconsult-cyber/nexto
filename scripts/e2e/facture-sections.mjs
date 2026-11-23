// Facture : un seul défilement à deux sections (maquette v11), mobile 390x844, comptes audit client puis prestataire.
// Vérifie : en-tête avec flèche retour, deux sections empilées, chaque partie ne voit QUE sa commission, bloc virement
// et PDF présents. Lecture seule. Écrit docs/maquette-ecarts-2026-11-23/facture-5-app-{client,pro}.jpg.
//   BASE=http://localhost:3000 node scripts/e2e/facture-sections.mjs
import { chromium } from 'playwright'
import fs from 'fs'

const BASE = process.env.BASE || 'http://localhost:3000'
const MISSION = '3ecb9d28-693b-4ed6-84f5-f0cdbbc882e6' // mission d'exemple des comptes audit (voir factures.mjs)
const PWD = process.env.AUDIT_PWD || fs.readFileSync(new URL('./parcours.mjs', import.meta.url), 'utf8').match(/PWD = '([^']+)'/)[1]
const OUT = new URL('../../docs/maquette-ecarts-2026-11-23/', import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })
const res = { base: BASE, checks: [] }
const check = (k, v, ok) => { res.checks.push({ k, v, ok: !!ok }); console.log(ok ? 'OK' : 'KO', k, typeof v === 'string' ? v : JSON.stringify(v)); return ok }
const browser = await chromium.launch()
try {
  for (const [who, email, mode] of [['client', 'audit.client.claude@ping-demo.invalid', 'particulier'], ['pro', 'audit.pro.claude@ping-demo.invalid', 'pro']]) {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR' })
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 120)))
    await p.goto(BASE + '/auth/login', { waitUntil: 'networkidle' })
    await p.locator('input[type=email]').fill(email); await p.locator('input[type=password]').fill(PWD)
    await p.locator('button[type=submit]').first().click(); await p.waitForTimeout(3500)
    await p.evaluate(m => localStorage.setItem('ping_mode', m), mode)
    await p.goto(`${BASE}/mission/${MISSION}/facture`, { waitUntil: 'networkidle' }); await p.waitForTimeout(3500)
    const t = (await p.locator('body').innerText()).replace(/\s+/g, ' ')
    const heads = await p.locator('section h2').allInnerTexts()
    const mine = who === 'client' ? ['Prestation', 'Frais de service PING'] : ['Votre facture', 'Commission PING']
    check(`${who} : deux sections empilées dans l'ordre`, heads, JSON.stringify(heads.map(h => h.toLowerCase())) === JSON.stringify(mine.map(h => h.toLowerCase())) || (heads.length === 2 && /prestation|facture|récapitulatif/i.test(heads[0])))
    check(`${who} : en-tête avec flèche retour`, await p.getByRole('button', { name: 'Retour' }).count(), (await p.getByRole('button', { name: 'Retour' }).count()) === 1 && (await p.getByRole('heading', { level: 1 }).count()) >= 1)
    check(`${who} : plus d'onglets`, await p.getByRole('tab').count(), (await p.getByRole('tab').count()) === 0)
    check(`${who} : ne voit que SA commission`, '', who === 'client' ? /PING-C-/.test(t) && !/PING-V-/.test(t) : /PING-V-/.test(t) && !/PING-C-/.test(t))
    check(`${who} : un PDF par section`, await p.getByRole('button', { name: /^Télécharger le PDF/ }).count(), (await p.getByRole('button', { name: /^Télécharger le PDF/ }).count()) === 2)
    const virement = await p.getByText(/IBAN|Virement|virement/).count()
    check(`${who} : bloc virement présent`, virement, virement > 0)
    const petits = await p.evaluate(() => [...document.querySelectorAll('button, a[href]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && Math.min(r.width, r.height) < 43.5 }).map(e => `${(e.getAttribute('aria-label') || e.innerText || '').trim().slice(0, 28)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`))
    check(`${who} : cibles < 44 px`, petits, petits.length === 0)
    check(`${who} : erreurs de page`, errs, errs.length === 0)
    await p.screenshot({ path: `${OUT}facture-5-app-${who}.jpg`, quality: 72, type: 'jpeg', fullPage: true })
    await c.close()
  }
} finally { await browser.close() }
fs.writeFileSync(`${OUT}facture-sections.json`, JSON.stringify(res, null, 1))
const ko = res.checks.filter(x => !x.ok)
console.log(ko.length ? `${ko.length} KO` : 'tout OK'); process.exit(ko.length ? 1 : 0)
