// Mesure ergonomie des écrans client / pro (390x844) : mots et boutons du premier écran, hauteur, cibles < 44 px.
// Usage : BASE=http://localhost:3000 TAG=avant|apres node scripts/e2e/mesure-comptes.mjs  (depuis un dossier avec playwright)
// Lecture seule (aucune écriture en base). Sorties : docs/refonte-comptes-2026-11-23/<ecran>-<TAG>.png et mesures-<TAG>.json
// Mot de passe des comptes audit : lu dans scripts/e2e/parcours.mjs (variable PWD), jamais recopié.
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
const BASE = process.env.BASE || 'http://localhost:3000'
const TAG = process.env.TAG || 'avant'
const src = fs.readFileSync(new URL('./parcours.mjs', import.meta.url), 'utf8')
const PWD = /PWD = '([^']+)'/.exec(src)[1]
const SB = /const SB = \['([^']+)', '([^']+)'\]/.exec(src)
const CLIENT = 'audit.client.claude@ping-demo.invalid', PRO = 'audit.pro.claude@ping-demo.invalid'
const OUT = new URL('../../docs/refonte-comptes-2026-11-23/', import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })

const sb = createClient(SB[1], SB[2])
await sb.auth.signInWithPassword({ email: CLIENT, password: PWD })
const { data: tx } = await sb.from('transactions').select('id,status,scheduled_at').order('created_at', { ascending: false }).limit(20)
const mid = (tx || []).find(t => ['pending', 'arrived'].includes(t.status))?.id || tx?.[0]?.id
console.log('mission utilisée', mid, (tx || []).length)

const SCREENS = [
  ['client', 'client-profil', '/client/profil'],
  ['client', 'client-agenda', '/agenda'],
  ['client', 'client-messages', '/messages'],
  ['client', 'client-commande', `/mission/${mid}/commande`],
  ['client', 'client-jour', `/mission/${mid}/jour`],
  ['client', 'client-reservation', '/mission/new?pro=b9f8cd9a-16de-4a36-afd8-10a2135ab970'],
  ['pro', 'pro-entreprise', '/pro/dashboard'],
  ['pro', 'pro-agenda', '/agenda'],
  ['pro', 'pro-messages', '/messages'],
  ['pro', 'pro-documents', '/pro/documents'],
  ['pro', 'pro-revenus', '/pro/revenus'],
  ['pro', 'pro-tarifs', '/pro/tarifs'],
  ['pro', 'pro-annonce', '/pro/annonce'],
  ['pro', 'pro-disponibilites', '/pro/disponibilites'],
]
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
const browser = await chromium.launch()
const res = {}
for (const [who, email] of [['client', CLIENT], ['pro', PRO]]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
  const page = await ctx.newPage()
  const errs = []
  page.on("pageerror", e => { errs.push(e.message.slice(0, 300)); console.log("ERR", e.message.slice(0,300)) })
  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle' })
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(PWD)
  await page.locator('button[type=submit], button:has-text("connecter")').first().click()
  await page.waitForTimeout(3500)
  await page.evaluate(m => localStorage.setItem('ping_mode', m), who === 'pro' ? 'pro' : 'particulier')
  for (const [w, name, p] of SCREENS.filter(s => s[0] === who)) {
    errs.length = 0
    await page.goto(BASE + p, { waitUntil: 'networkidle' }).catch(() => { })
    await page.waitForTimeout(2500)
    const m = await page.evaluate(measure)
    m.url = page.url().replace(BASE, '').replace(mid || 'x', '[id]'); m.erreurs = errs.length
    res[name] = m
    await page.screenshot({ path: path.join(OUT, `${name}-${TAG}.png`), fullPage: true }).catch(() => { })
    console.log(name, JSON.stringify({ ...m, petitesListe: undefined }))
  }
  await ctx.close()
}
await browser.close()
fs.writeFileSync(path.join(OUT, `mesures-${TAG}.json`), JSON.stringify(res, null, 1))
