// Mesure « lecture aérée » des écrans du particulier : mobile 390x844, compte audit client, lecture seule.
//   BASE=http://localhost:3217 LABEL=avant node scripts/e2e/mesure-aere.mjs        (ONLY=profil,messages pour quelques écrans)
// Pour chaque écran : capture du premier écran (390x844) et de la page entière, puis mesures sur le PREMIER ÉCRAN :
//   blocs     : enfants directs du conteneur de contenu visibles (un wrapper unique est traversé)
//   bordures  : CADRES visibles (bordure sur 2 côtés ou plus, hors champs de saisie), barre du bas exclue ; separateursTraits : traits simples (1 côté)
//   (les séparateurs dessinés en ::before ne sont comptés nulle part : ce sont des filets, pas des cadres)
//   texteMin  : plus petite taille de texte visible (px) ; sous15 = nombre d'éléments de texte sous 15 px
//   espaceMin : plus petit espace vertical entre le CONTENU visible de deux blocs voisins (px) ; 
//   interlMin : plus petit rapport interligne / taille sur les textes de plus d'une ligne
//   cibles44  : boutons, liens, champs visibles de moins de 44 px (liste)
// Écrit docs/refonte-aeree-2026-11-24/<LABEL>/*.jpg et mesures-<LABEL>.json. Mot de passe lu dans parcours.mjs, jamais recopié.
import { chromium } from 'playwright'
import fs from 'fs'

const BASE = process.env.BASE || 'http://localhost:3217'
const LABEL = process.env.LABEL || 'apres'
const CLIENT = 'audit.client.claude@ping-demo.invalid'
const PWD = process.env.AUDIT_PWD || fs.readFileSync(new URL('./parcours.mjs', import.meta.url), 'utf8').match(/PWD = '([^']+)'/)[1]
const OUT = new URL(`../../docs/refonte-aeree-2026-11-24/${LABEL}/`, import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })
// Données de test du compte audit (missions « QA », reconnaissables) ; surchargeables.
const TX_LIVE = process.env.TX_LIVE || 'a0d834bc-2842-4b62-a989-b964a1f85429'
const TX_DONE = process.env.TX_DONE || 'ef36ae11-a288-44bf-8227-7ed21eeb380a'
const DISPUTE = process.env.DISPUTE || '2d34559a-506d-4803-9534-d8db0fa53be0'
const PRO_ID = 'b9f8cd9a-16de-4a36-afd8-10a2135ab970'
const SCREENS = [
  ['profil', '/client/profil'],
  ['messages', '/messages'],
  ['commande', `/mission/${TX_LIVE}/commande`],
  ['jour', `/mission/${TX_LIVE}/jour`],
  ['reservation', `/mission/new?pro=${PRO_ID}`],
  ['paiements', '/client/paiements'],
  ['pieces', '/client/documents'],
  ['facture', `/mission/${TX_DONE}/facture`],
  ['litige', `/litiges/${DISPUTE}`],
  ['connexion', '/auth/login', 'anon'],
  ['accueil', '/auth/signup', 'anon'],
]

function measure(rootSel) {
  const VH = innerHeight, VW = innerWidth
  const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 && r.bottom > 0 && r.top < VH }
  const inTabbar = e => !!e.closest('.app-bottom-bar, .tabbar, [data-tabbar], nav[aria-label], .bubble, [data-feedback]')
  const root = (() => {
    let r = (rootSel && document.querySelector(rootSel)) || document.querySelector('[data-aere-root]') || document.querySelector('.body') || document.querySelector('main') || document.body
    for (let i = 0; i < 8; i++) { const k = [...r.children].filter(e => vis(e) && !inTabbar(e) && e.getBoundingClientRect().height > 8 && !['fixed', 'sticky'].includes(getComputedStyle(e).position)); if (k.length === 1 && k[0].children.length) r = k[0]; else break }
    return r
  })()
  const blocks = [...root.children].filter(e => vis(e) && !inTabbar(e) && e.getBoundingClientRect().height > 8 && !['fixed', 'sticky'].includes(getComputedStyle(e).position))
  // Rectangle du CONTENU visible d'un bloc (texte, champs, pictogrammes, cadres) : le remplissage interne ne compte pas comme de l'air.
  const content = b => {
    let t = 1e9, bt = -1e9, n = 0
    const els = [b, ...b.querySelectorAll('*')]
    for (const e of els) {
      if (!vis(e)) continue
      const s = getComputedStyle(e), r = e.getBoundingClientRect()
      const own = [...e.childNodes].some(x => x.nodeType === 3 && x.textContent.trim().length > 0)
      const frame = ['Top', 'Right', 'Bottom', 'Left'].filter(k => parseFloat(s['border' + k + 'Width']) > 0 && s['border' + k + 'Style'] !== 'none').length >= 2 || (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && e !== document.body)
      if (own || frame || ['INPUT', 'SELECT', 'TEXTAREA', 'svg', 'IMG', 'BUTTON'].includes(e.tagName)) { t = Math.min(t, r.top); bt = Math.max(bt, r.bottom); n++ }
    }
    return n ? { top: t, bottom: bt, txt: (b.innerText || '').trim().slice(0, 18).replace(/\n/g, ' ') } : null
  }
  const rects = blocks.map(content).filter(Boolean).sort((a, b) => a.top - b.top)
  let gapMin = null, gapOu = ''
  for (let i = 1; i < rects.length; i++) { const g = rects[i].top - rects[i - 1].bottom; if (gapMin === null || g < gapMin) { gapMin = g; gapOu = `${rects[i - 1].txt} / ${rects[i].txt}` } }
  const isFixed = e => { for (let x = e; x && x !== root && x !== document.body; x = x.parentElement) if (getComputedStyle(x).position === 'fixed') return true; return false }
  // Éléments fixes (bulle de retour, barre du bas, bandeau collant du bas) : hors du contenu de l'écran mesuré.
  const all = [...document.querySelectorAll('body *')].filter(e => vis(e) && !inTabbar(e) && !isFixed(e) && (!rootSel || root.contains(e)))
  let borders = 0, seps = 0
  for (const e of all) {
    if (['INPUT', 'SELECT', 'TEXTAREA', 'svg', 'path', 'circle', 'rect', 'IMG'].includes(e.tagName)) continue
    { const r0 = e.getBoundingClientRect(); if (r0.width <= 26 && r0.height <= 26) continue } // pastilles, cases, points : pas des cadres
    const s = getComputedStyle(e)
    const sides = ['Top', 'Right', 'Bottom', 'Left'].filter(k => parseFloat(s['border' + k + 'Width']) > 0 && s['border' + k + 'Style'] !== 'none' && !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(s['border' + k + 'Color']))
    if (sides.length >= 2) borders++; else if (sides.length === 1) seps++
  }
  let textMin = 99, under15 = 0, interlMin = 9, interlOu = ''
  const smalls = []
  for (const e of all) {
    const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)
    if (!own) continue
    const s = getComputedStyle(e), fs = parseFloat(s.fontSize)
    if (fs < textMin) textMin = fs
    if (fs < 15 && !e.closest('.a-mini, .a-pill')) { under15++; if (smalls.length < 6) smalls.push(`${fs}px ${e.textContent.trim().slice(0, 28)}`) }
    const lh = s.lineHeight === 'normal' ? 1.2 : parseFloat(s.lineHeight) / fs
    const r = e.getBoundingClientRect()
    if (r.height > fs * lh * 1.6 && lh < interlMin) { interlMin = lh; interlOu = e.textContent.trim().slice(0, 24) }
  }
  const small = [...document.querySelectorAll('button, a[href], [role=button], input:not([type=hidden]), select, textarea, [role=tab]')]
    .filter(e => vis(e) && !inTabbar(e) && (!rootSel || root.contains(e))).map(e => ({ e, r: e.getBoundingClientRect() }))
    .filter(x => Math.min(x.r.width, x.r.height) < 43.5 && x.r.width > 0)
    .map(x => `${(x.e.getAttribute('aria-label') || x.e.innerText || x.e.placeholder || x.e.tagName).trim().slice(0, 24)} ${Math.round(x.r.width)}x${Math.round(x.r.height)}`)
  let marge = 999, margeOu = ''
  for (const e of all) {
    const r = e.getBoundingClientRect()
    if (!root.contains(e) || r.width >= VW - 2 || r.width < 2 || r.left < 0 || r.right > VW || e.closest('.appbar')) continue
    const s = getComputedStyle(e)
    const own = [...e.childNodes].some(x => x.nodeType === 3 && x.textContent.trim().length > 1)
    const frame = ['Top', 'Right', 'Bottom', 'Left'].filter(k => parseFloat(s['border' + k + 'Width']) > 0 && s['border' + k + 'Style'] !== 'none').length >= 2
    if (own || frame || ['INPUT', 'BUTTON'].includes(e.tagName)) { const m0 = Math.min(r.left, VW - r.right); if (m0 < marge) { marge = m0; margeOu = (e.textContent || e.tagName).trim().slice(0, 20) } }
  }
  return { racine: root.tagName.toLowerCase() + (root.className && typeof root.className === 'string' ? '.' + root.className.split(' ')[0] : ''), blocs: blocks.length, bordures: borders, separateursTraits: seps, texteMin: textMin === 99 ? null : textMin, sous15: under15, exemplesSous15: smalls, espaceMin: gapMin === null ? null : Math.round(gapMin), espaceOu: gapOu, margeOu, margeMin: marge === 999 ? null : Math.round(marge), interlOu, interlMin: interlMin === 9 ? null : +interlMin.toFixed(2), cibles44: small.length, listeCibles: small.slice(0, 8), hauteurPage: Math.round((document.querySelector('.body') || document.documentElement).scrollHeight) }
}

async function findSheetSteps(browser) {
  // Feuille « Trouver un prestataire » sur /map : trois étapes, mesurées dans la feuille seule ([data-find-sheet]).
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris', geolocation: { latitude: 43.6584, longitude: 6.9225 }, permissions: ['geolocation'] })
  const page = await c.newPage()
  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle' })
  await page.locator('input[type=email]').fill(CLIENT)
  await page.locator('input[type=password]').fill(PWD)
  await page.locator('button[type=submit], button:has-text("connecter")').first().click()
  await page.waitForTimeout(3500)
  await page.evaluate(() => { localStorage.setItem('ping_mode', 'particulier'); localStorage.removeItem('ping_sheet_map') })
  await page.goto(BASE + '/map', { waitUntil: 'networkidle' }).catch(() => { })
  await page.waitForTimeout(5000)
  const out = {}
  const grab = async name => {
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => { })
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}${name}.jpg`, quality: 70, type: 'jpeg' })
    out[name] = await page.evaluate(measure, '[data-find-sheet] > div')
    console.log(name.padEnd(18), JSON.stringify({ ...out[name], exemplesSous15: undefined, listeCibles: out[name].listeCibles.slice(0, 3) }))
  }
  await page.locator('[data-find-open]').tap()
  await page.getByRole('heading', { name: /De quoi avez-vous besoin/ }).waitFor({ timeout: 10000 })
  await grab('findsheet-besoin')
  await page.getByRole('button', { name: /^Ménage$/ }).tap()
  await page.getByRole('heading', { name: /^Quand/ }).waitFor({ timeout: 10000 })
  await grab('findsheet-moment')
  await page.getByRole('button', { name: 'Voir les prestataires' }).tap()
  await page.getByRole('heading', { name: /meilleur choix/ }).waitFor({ timeout: 10000 })
  await grab('findsheet-choix')
  await c.close()
  return out
}

const browser = await chromium.launch()
const res = { base: BASE, label: LABEL, ecrans: {} }
try {
  const mk = async () => (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' })).newPage()
  const anon = await mk()
  const page = await mk()
  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle' })
  await page.locator('input[type=email]').fill(CLIENT)
  await page.locator('input[type=password]').fill(PWD)
  await page.locator('button[type=submit], button:has-text("connecter")').first().click()
  await page.waitForTimeout(4000)
  await page.evaluate(() => localStorage.setItem('ping_mode', 'particulier'))
  for (const [name, url, who] of SCREENS) {
    if (process.env.ONLY && !process.env.ONLY.split(',').includes(name)) continue
    const p = who === 'anon' ? anon : page
    await p.goto(BASE + url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => { })
    await p.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => { })
    await p.waitForTimeout(2500)
    await p.screenshot({ path: `${OUT}${name}.jpg`, quality: 70, type: 'jpeg' })
    const m = await p.evaluate(measure)
    res.ecrans[name] = m
    console.log(name.padEnd(12), JSON.stringify({ ...m, exemplesSous15: undefined, listeCibles: m.listeCibles.slice(0, 3) }))
  }
  if (!process.env.ONLY || process.env.ONLY.split(',').includes('findsheet')) Object.assign(res.ecrans, await findSheetSteps(browser))
} finally { await browser.close() }
fs.writeFileSync(`${OUT}../mesures-${LABEL}.json`, JSON.stringify(res, null, 1))
