// Audit Design 27/11 (sévère) : ce qui est touchable sur les écrans d'entrée, client et prestataire. Lecture seule.
import { chromium } from 'playwright'
import fs from 'fs'
const BASE = process.env.BASE || 'https://nexto-eta.vercel.app', OUT = process.env.OUT || 'shots-audit-taches/'
const PWD = fs.readFileSync(new URL('./parcours.mjs', import.meta.url), 'utf8').match(/PWD = '([^']+)'/)[1]
fs.mkdirSync(OUT, { recursive: true })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const labels = p => p.evaluate(() => [...document.querySelectorAll('a[href],button,[role=button],[role=tab]')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && r.top < innerHeight && r.bottom > 0 }).map(e => (e.getAttribute('aria-label') || e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 45)).filter(Boolean))
const b = await chromium.launch()
for (const [who, email, pages] of [['client', 'audit.client.claude@ping-demo.invalid', ['/map', '/client/profil', '/hub', '/messages', '/agenda', '/documents']], ['pro', 'audit.pro.claude@ping-demo.invalid', ['/pro/carte', '/pro/dashboard', '/hub', '/agenda', '/documents', '/pro/annonce', '/pro/tarifs']]]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true }); const p = await ctx.newPage()
  await p.goto(BASE + '/auth/login', { waitUntil: 'networkidle' }); await p.locator('input[type=email]').fill(email); await p.locator('input[type=password]').fill(PWD)
  await p.locator('button[type=submit]').first().click(); await p.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 20000 }).catch(() => {}); await sleep(2000)
  console.log(`\n##### ${who} : écran après connexion = ${p.url().replace(BASE, '')}`)
  for (const path of pages) {
    await p.goto(BASE + path, { waitUntil: 'networkidle' }); await sleep(path.includes('carte') || path === '/map' ? 4000 : 2000)
    console.log(`\n== ${who} ${path}\n` + (await labels(p)).join(' | '))
    await p.screenshot({ path: `${OUT}${who}${path.replace(/\W+/g, '_')}.jpg`, type: 'jpeg', quality: 55, fullPage: true })
    if (path === '/map' || path === '/pro/carte') {
      await p.locator('.app-burger, button[aria-label*="enu"]').first().click().catch(() => {}); await sleep(900)
      console.log(`-- menu ouvert : ` + (await labels(p)).join(' | '))
      await p.screenshot({ path: `${OUT}${who}-menu.jpg`, type: 'jpeg', quality: 55 })
    }
  }
  await ctx.close()
}
await b.close()
