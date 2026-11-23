// Mesure de l'ergonomie des cartes /map (particulier) et /pro/carte (prestataire), mobile 390x844 et bureau 1000x800.
// Comptes audit .invalid (mêmes que parcours.mjs). Ne modifie rien en base (lecture seule, sauf la connexion).
//   BASE=http://localhost:3000 PHASE=avant|apres node scripts/e2e/carte-ergonomie.mjs   (depuis la racine du dépôt)
// Écrit docs/refonte-carte-2026-11-23/<PHASE>-*.jpg et <PHASE>-mesures.json.
// « sans mission » : les lectures de la table transactions sont vidées côté navigateur (route Playwright), rien n'est écrit.
import { chromium } from 'playwright'
import fs from 'fs'

const BASE = process.env.BASE || 'http://localhost:3000'
const PHASE = process.env.PHASE || 'apres'
const CLIENT = 'audit.client.claude@ping-demo.invalid', PRO = 'audit.pro.claude@ping-demo.invalid'
// Mot de passe des comptes audit : lu dans parcours.mjs (jamais recopié ailleurs).
const PWD = process.env.AUDIT_PWD || fs.readFileSync(new URL('./parcours.mjs', import.meta.url), 'utf8').match(/PWD = '([^']+)'/)[1]
const OUT = new URL('../../docs/refonte-carte-2026-11-23/', import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })
const res = {}

async function ctx(browser, w, h, mobile) {
  return browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, locale: 'fr-FR', timezoneId: 'Europe/Paris', geolocation: { latitude: 43.6589, longitude: 6.9237 }, permissions: ['geolocation'] })
}
async function login(page, email) {
  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle' })
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(PWD)
  await page.locator('button[type=submit], button:has-text("connecter")').first().click()
  await page.waitForTimeout(3500)
}
// Contrôles visibles dans la fenêtre, hors carte (Leaflet) et hors barre d'onglets ; la feuille est comptée à part.
const COUNT = () => {
  // Visible = dans la fenêtre, non masqué, et réellement au-dessus des autres au centre de sa zone (un élément
  // coupé par la feuille ou caché sous un bandeau n'est pas compté).
  const vis = e => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e)
    if (!(r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0')) return false
    const cx = Math.min(innerWidth - 1, Math.max(0, r.x + r.width / 2)), cy = Math.min(innerHeight - 1, Math.max(0, r.y + r.height / 2))
    const t = document.elementFromPoint(cx, cy)
    return !!t && (t === e || e.contains(t) || t.contains(e))
  }
  const all = [...document.querySelectorAll('button,[role=button],[role=switch],a[href],input,select,textarea')].filter(vis)
  const lab = e => (e.getAttribute('aria-label') || e.title || e.innerText || e.placeholder || e.tagName).replace(/\s+/g, ' ').trim().slice(0, 40)
  const chrome = [], sheet = [], tab = [], small = []
  for (const e of all) {
    // Carte : épingles et mentions légales exclues, mais le zoom + / - est un contrôle comme un autre.
    if (e.closest('.leaflet-container') && !e.closest('.leaflet-control-zoom')) continue
    if (e.closest('.app-bottom-bar')) { tab.push(lab(e)); continue }
    if (e.closest('.desk-nav')) continue
    const r = e.getBoundingClientRect()
    if (Math.min(r.width, r.height) < 43.5 && !e.closest('.map-sheet')) small.push(`${lab(e)} ${Math.round(r.width)}x${Math.round(r.height)}`)
    if (e.closest('.map-sheet')) sheet.push(lab(e)); else chrome.push(lab(e))
  }
  const sh = document.querySelector('.map-sheet')?.getBoundingClientRect()
  const bar = document.querySelector('.app-bottom-bar')
  const pins = [...document.querySelectorAll('.ping-pin .pin-tag, .you-tip')].filter(e => getComputedStyle(e).visibility !== 'hidden').map(e => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 24), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } })
  const inter = []
  for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) { const a = pins[i], b = pins[j]; if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) inter.push(`${a.t} / ${b.t}`) }
  const barTop = bar ? Math.min(...[...bar.children].map(c => c.getBoundingClientRect().top)) : null
  return { chrome, nChrome: chrome.length, sheet: sheet.length, sheetItems: sheet.slice(0, 4), tabbar: tab.length, small, sheetRect: sh && { top: Math.round(sh.top), bottom: Math.round(sh.bottom), h: Math.round(sh.height) }, barTop: barTop && Math.round(barTop), pinOverlaps: inter }
}
async function measure(page, key, shotName) {
  await page.waitForTimeout(600)
  const m = await page.evaluate(COUNT)
  res[key] = m
  console.log(key, JSON.stringify(m))
  if (shotName) await page.screenshot({ path: `${OUT}${PHASE}-${shotName}.jpg`, quality: 70, type: 'jpeg' })
  return m
}
const sheetSel = '.map-sheet'
const snapOf = page => page.locator(sheetSel).first().getAttribute('data-snap').catch(() => null)

async function scenario(browser, who, email, mode, path, label, noMission) {
  const c = await ctx(browser, 390, 844, true)
  const page = await c.newPage()
  const errs = []
  page.on('pageerror', e => errs.push(e.message.slice(0, 160)))
  await login(page, email)
  await page.evaluate(m => localStorage.setItem('ping_mode', m), mode)
  if (noMission) await page.route(/\/rest\/v1\/transactions/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => { })
  await page.waitForTimeout(4500)
  const k = `${who}-${label}`
  // Cas « mission en cours » : le bandeau d'action de la barre du bas dépend de l'état réel de la mission du compte audit
  // (volatil). S'il est absent, il est simulé en répondant au RPC presence_state côté navigateur (rien n'est écrit en base).
  if (!noMission) {
    const real = await page.locator('.app-bottom-bar [role=status]').count()
    res[`${k}-bandeau-reel`] = real > 0
    if (!real) {
      const body = mode === 'pro' ? { remote: { arrivee: { etat: 'en_attente', code_sent_at: '2026-11-23T08:00:00Z' } } } : { remote: { arrivee: { etat: 'en_attente' } } }
      await page.route(/\/rpc\/presence_state/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }))
      await page.reload({ waitUntil: 'networkidle' }).catch(() => { }); await page.waitForTimeout(4500)
      res[`${k}-bandeau-simule`] = (await page.locator('.app-bottom-bar [role=status]').count()) > 0
    }
  }
  await measure(page, `${k}-ouverture`, `${k}-01-ouverture`)
  res[`${k}-ouverture`].snap = await snapOf(page)
  const handle = page.locator(`${sheetSel} button`).first()
  const hb = await handle.boundingBox().catch(() => null)
  res[`${k}-poignee`] = hb && { w: Math.round(hb.width), h: Math.round(hb.height) }
  if (hb) {
    // 1) appui sur la poignée : enchaîne les états
    const seq = [await snapOf(page)]
    for (let i = 0; i < 3; i++) {
      await handle.click(); await page.waitForTimeout(450); seq.push(await snapOf(page))
      if (i < 2) await measure(page, `${k}-appui${i + 1}`, `${k}-02-appui${i + 1}-${seq[seq.length - 1]}`)
    }
    res[`${k}-appui-sequence`] = seq
    // 2) glissement au doigt (événements tactiles réels via CDP)
    const fingerDrag = async to => {
      const b = await handle.boundingBox(); const x = b.x + b.width / 2, y = b.y + Math.min(20, b.height / 2)
      const cdp = await c.newCDPSession(page)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (to - y) * i / 12 }] }); await page.waitForTimeout(16) }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await page.waitForTimeout(500)
      await cdp.detach()
    }
    for (let i = 0; i < 3 && (await snapOf(page)) !== 'peek'; i++) { await handle.click(); await page.waitForTimeout(400) }
    const drag = [{ de: await snapOf(page) }]
    await fingerDrag(520); drag.push({ apresGlisserHautModere: await snapOf(page) })
    await measure(page, `${k}-doigt-haut`, `${k}-03-doigt-haut-${await snapOf(page)}`)
    let b2 = await handle.boundingBox()
    await fingerDrag(b2.y + 400); drag.push({ apresGlisserBas: await snapOf(page) })
    await fingerDrag(30); drag.push({ apresGlisserHautGrand: await snapOf(page) })
    await measure(page, `${k}-doigt-plein`, `${k}-04-doigt-plein`)
    // 3) souris : glisser vers le bas
    const b3 = await handle.boundingBox()
    await page.mouse.move(b3.x + b3.width / 2, b3.y + 20); await page.mouse.down()
    for (let i = 1; i <= 10; i++) { await page.mouse.move(b3.x + b3.width / 2, b3.y + 20 + 60 * i); await page.waitForTimeout(16) }
    await page.mouse.up(); await page.waitForTimeout(500)
    drag.push({ apresSourisBas: await snapOf(page) })
    res[`${k}-glissements`] = drag
    // 4) mémoire : état laissé = celui d'avant le rechargement
    res[`${k}-avant-rechargement`] = { snap: await snapOf(page) }
  }
  await page.reload({ waitUntil: 'networkidle' }).catch(() => { }); await page.waitForTimeout(3500)
  res[`${k}-apres-rechargement`] = { snap: await snapOf(page) }
  // Mémoire de l'état : laissée à mi-hauteur, la feuille se rouvre à mi-hauteur ; laissée pleine, elle se rouvre à mi-hauteur (la carte ne disparaît pas).
  if (hb) {
    const h2 = page.locator(`${sheetSel} button`).first()
    await h2.click(); await page.waitForTimeout(500)
    const laisse = await snapOf(page)
    await page.reload({ waitUntil: 'networkidle' }).catch(() => { }); await page.waitForTimeout(3500)
    const r1 = await snapOf(page)
    await page.locator(`${sheetSel} button`).first().click(); await page.waitForTimeout(500)
    const laisse2 = await snapOf(page)
    await page.reload({ waitUntil: 'networkidle' }).catch(() => { }); await page.waitForTimeout(3500)
    res[`${k}-memoire`] = { laisse, rouvert: r1, laisse2, rouvert2: await snapOf(page) }
    await measure(page, `${k}-memoire-rouverte`, `${k}-05-memoire-rouverte-${await snapOf(page)}`)
  }
  res[`${k}-erreurs`] = errs.slice(0, 5)
  await c.close()
}

const browser = await chromium.launch()
try {
  for (const noM of [false, true]) {
    const label = noM ? 'sans-mission' : 'mission'
    await scenario(browser, 'client', CLIENT, 'particulier', '/map', label, noM)
    await scenario(browser, 'pro', PRO, 'pro', '/pro/carte', label, noM)
  }
  for (const [who, email, mode, path] of [['client', CLIENT, 'particulier', '/map'], ['pro', PRO, 'pro', '/pro/carte']]) {
    const c = await ctx(browser, 1000, 800, false); const page = await c.newPage()
    await login(page, email); await page.evaluate(m => localStorage.setItem('ping_mode', m), mode)
    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => { }); await page.waitForTimeout(4500)
    await measure(page, `${who}-bureau-1000x800`, `${who}-bureau-1000x800`)
    await c.close()
  }
} finally {
  fs.writeFileSync(`${OUT}${PHASE}-mesures.json`, JSON.stringify(res, null, 1))
  await browser.close()
}
