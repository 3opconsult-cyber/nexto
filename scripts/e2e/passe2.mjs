// Passe 2 (23/11/2026) : premier ecran des comptes (mobile 390x844) + carte du particulier sur bureau (1000x800, 1440x900).
// Usage : BASE=http://localhost:3000 TAG=avant|apres node scripts/e2e/passe2.mjs   (depuis la racine du depot ; lecture seule)
// Sorties : docs/refonte-comptes-2026-11-23/passe2/<nom>-<TAG>.png et passe2-<TAG>.json. Mot de passe lu dans parcours.mjs, jamais recopie.
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
const BASE = process.env.BASE || 'http://localhost:3000'
const TAG = process.env.TAG || 'avant'
const src = fs.readFileSync(new URL('./parcours.mjs', import.meta.url), 'utf8')
const PWD = /PWD = '([^']+)'/.exec(src)[1]
const CLIENT = 'audit.client.claude@ping-demo.invalid', PRO = 'audit.pro.claude@ping-demo.invalid'
const OUT = new URL('../../docs/refonte-comptes-2026-11-23/passe2/', import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })
const GRASSE = { latitude: 43.6584, longitude: 6.9225 }

// Meme mesure que mesure-comptes.mjs : mots et boutons visibles dans la fenetre (premier ecran), mots et boutons de toute la page.
const measure = () => {
  const vh = window.innerHeight
  const vis = el => { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  let mots = 0, motsPage = 0
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n
  while ((n = w.nextNode())) {
    const t = n.textContent.trim(); if (!t) continue
    const p = n.parentElement; if (!p || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(p.tagName) || !vis(p)) continue
    const k = t.split(/\s+/).length
    motsPage += k
    const rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect()
    if (r.top < vh && r.bottom > 0) mots += k
  }
  const sel = 'button, a[href], [role=button], input:not([type=hidden]):not([type=file]), select, textarea, label[for]'
  const els = [...document.querySelectorAll(sel)].filter(vis)
  const inView = els.filter(e => { const r = e.getBoundingClientRect(); return r.top < vh && r.bottom > 0 })
  const small = els.filter(e => { const r = e.getBoundingClientRect(); return r.height < 43.5 && !(e.tagName === 'INPUT' && ['checkbox', 'radio'].includes(e.type)) }).map(e => (e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30))
  return { mots, motsPage, boutons: inView.length, boutonsPage: els.length, hauteur: document.documentElement.scrollHeight, petitesCibles: small.length, petitesListe: small.slice(0, 8) }
}
// Zone d'en-tete / carte d'identite : mots, boutons et hauteur de la zone (haut de page jusqu'a l'ancre), independants de ce que l'ecran laisse voir en dessous.
const zoneMeasure = (name) => {
  const vis = el => { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  const rectOf = el => { const r = el.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY } }
  const idCard = () => [...document.querySelectorAll('div')].find(d => { const c = getComputedStyle(d); return c.backgroundColor === 'rgb(243, 246, 245)' && c.borderRadius === '16px' && c.overflow === 'hidden' && d.getBoundingClientRect().width > 300 })
  function countIn(root) {
    let mots = 0
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n
    while ((n = w.nextNode())) { const t = n.textContent.trim(); if (t && n.parentElement && vis(n.parentElement)) mots += t.split(/\s+/).length }
    const boutons = [...root.querySelectorAll('button, a[href], [role=button], label[for]')].filter(vis).length
    return { mots, boutons }
  }
  function count(from, to) {
    let mots = 0
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n
    while ((n = w.nextNode())) {
      const t = n.textContent.trim(); const p = n.parentElement
      if (!t || !p || !vis(p) || ['SCRIPT', 'STYLE'].includes(p.tagName)) continue
      const rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect()
      if (r.top + scrollY >= from && r.top + scrollY < to) mots += t.split(/\s+/).length
    }
    const boutons = [...document.querySelectorAll('button, a[href], [role=button], label[for]')].filter(vis).filter(e => { const t = e.getBoundingClientRect().top + scrollY; return t >= from && t < to }).length
    return { mots, boutons, hauteurPx: Math.round(to - from) }
  }
  if (name === 'client-profil') return count(0, rectOf(document.querySelector('.card')).bottom)
  if (name === 'pro-entreprise') {
    const c = idCard()
    const white = [...document.querySelectorAll('div')].find(d => getComputedStyle(d).borderRadius === '18px 18px 0px 0px')
    const ci = countIn(c)
    return { entetePx: white ? Math.round(rectOf(white).top) : null, carteIdentitePx: Math.round(rectOf(c).bottom - rectOf(c).top), carteIdentiteMots: ci.mots, carteIdentiteBoutons: ci.boutons }
  }
  return count(0, rectOf(document.querySelector('.ping-tabs')).top)
}
const browser = await chromium.launch()
const res = {}
async function login(ctx, email) {
  const page = await ctx.newPage()
  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle' })
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(PWD)
  await page.locator('button[type=submit], button:has-text("connecter")').first().click()
  await page.waitForTimeout(3500)
  return page
}
const SCREENS = [['client', 'client-profil', '/client/profil'], ['client', 'client-agenda', '/agenda'], ['pro', 'pro-entreprise', '/pro/dashboard'], ['pro', 'pro-agenda', '/agenda']]
for (const who of ['client', 'pro']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
  const page = await login(ctx, who === 'pro' ? PRO : CLIENT)
  await page.evaluate(m => localStorage.setItem('ping_mode', m), who === 'pro' ? 'pro' : 'particulier')
  for (const [, name, p] of SCREENS.filter(s => s[0] === who)) {
    await page.goto(BASE + p, { waitUntil: 'networkidle' }).catch(() => { })
    await page.waitForTimeout(2500)
    res[name] = await page.evaluate(measure)
    res[name].zone = await page.evaluate(zoneMeasure, name)
    await page.screenshot({ path: path.join(OUT, `${name}-${TAG}.png`) })
    console.log(name, JSON.stringify({ ...res[name], petitesListe: undefined }))
  }
  await ctx.close()
}
for (const [w, h] of [[1000, 800], [1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'fr-FR', timezoneId: 'Europe/Paris', geolocation: GRASSE, permissions: ['geolocation'] })
  const page = await login(ctx, CLIENT)
  await page.evaluate(() => localStorage.setItem('ping_mode', 'particulier'))
  await page.goto(BASE + '/map', { waitUntil: 'networkidle' }).catch(() => { })
  await page.waitForTimeout(4000)
  await page.screenshot({ path: path.join(OUT, `bureau-${w}-0-${TAG}.png`) })
  const btn = page.locator('[data-find-open]').first()
  if (await btn.count()) {
    await btn.click(); await page.waitForTimeout(800)
    await page.screenshot({ path: path.join(OUT, `bureau-${w}-1-besoin-${TAG}.png`) })
    const tile = page.locator('[data-find-sheet] [role=group][aria-label=Services] button').first()
    if (await tile.count()) {
      await tile.click(); await page.waitForTimeout(600)
      await page.screenshot({ path: path.join(OUT, `bureau-${w}-2-moment-${TAG}.png`) })
      await page.getByRole('button', { name: 'Voir les prestataires' }).click(); await page.waitForTimeout(800)
      await page.screenshot({ path: path.join(OUT, `bureau-${w}-3-choix-${TAG}.png`) })
      res['bureau-' + w] = { reserver: await page.locator('[data-find-reserve]').count() }
    }
  }
  await ctx.close()
}
await browser.close()
fs.writeFileSync(path.join(OUT, `passe2-${TAG}.json`), JSON.stringify(res, null, 1))
