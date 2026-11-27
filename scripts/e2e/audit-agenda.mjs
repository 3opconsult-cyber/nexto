// Audit Design 27/11 : agenda -> date -> mission -> chat / QR, client et pro. Lecture seule.
import { chromium } from 'playwright'
import fs from 'fs'
const BASE = process.env.BASE || 'https://nexto-eta.vercel.app', OUT = process.env.OUT || 'shots-audit-agenda/'
const PWD = fs.readFileSync(new URL('./parcours.mjs', import.meta.url), 'utf8').match(/PWD = '([^']+)'/)[1]
fs.mkdirSync(OUT, { recursive: true })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const labels = p => p.evaluate(() => [...document.querySelectorAll('a[href],button,[role=button]')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && r.top < innerHeight && r.bottom > 0 }).map(e => (e.getAttribute('aria-label') || e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 50)).filter(Boolean).join(' | '))
const b = await chromium.launch()
for (const [who, email] of [['client', 'audit.client.claude@ping-demo.invalid'], ['pro', 'audit.pro.claude@ping-demo.invalid']]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true }); const p = await ctx.newPage()
  let n = 0; const shot = async s => p.screenshot({ path: `${OUT}${who}-${++n}-${s}.jpg`, type: 'jpeg', quality: 55 })
  await p.goto(BASE + '/auth/login', { waitUntil: 'networkidle' }); await p.fill('input[type=email]', email); await p.fill('input[type=password]', PWD)
  await p.click('button[type=submit]'); await p.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 20000 }).catch(() => {}); await sleep(1500)
  await p.goto(BASE + '/agenda', { waitUntil: 'networkidle' }); await sleep(3000); await shot('agenda')
  console.log(`\n### ${who} agenda (En cours) : ${await labels(p)}`)
  await p.getByRole('button', { name: 'Calendrier', exact: true }).first().click().catch(() => p.getByText('Calendrier', { exact: true }).first().click()); await sleep(1500); await shot('calendrier')
  // appui sur aujourd'hui
  const today = p.locator('button[aria-current="date"], button[data-today]').first()
  const day = (await today.count()) ? today : p.locator('[data-pending-day], button:has(span)').filter({ hasText: String(new Date().getDate()) }).first()
  await day.click().catch(() => {}); await sleep(1500); await shot('jour')
  console.log(`--- ${who} après appui sur la date : ${await labels(p)}`)
  await p.goto(BASE + '/agenda', { waitUntil: 'networkidle' }); await sleep(2500)
  const line = p.locator('[data-mission-line], a[href^="/mission/"], button:has-text("Ménage")').first()
  if (await line.count()) { await line.click(); await sleep(2500); await shot('mission'); console.log(`--- ${who} après appui sur une mission (${p.url().replace(BASE, '')}) : ${await labels(p)}`) }
  await ctx.close()
}
await b.close()
