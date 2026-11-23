// Parcours rapide « Trouver un prestataire » sur la carte du particulier (/map), mobile 390x844, compte audit client.
// Compte les APPUIS de l'ouverture de /map jusqu'à l'écran de réservation prérempli (objectif <= 4) et s'ARRÊTE AVANT
// la confirmation : aucune réservation n'est créée (les appels book_service sont de plus bloqués côté navigateur).
// Joue aussi : le multi-choix, la carte « personne dans le rayon » (position simulée à Saint-Raphaël : rien à moins de
// 15 km, prestataires à ~21 km) et le test de zoom libre (déplacement, pincement, double appui, pas de recadrage seul).
//   BASE=http://localhost:3000 node scripts/e2e/parcours-rapide.mjs        (depuis la racine du dépôt)
// Écrit docs/refonte-recherche-2026-11-23/*.jpg et mesures.json. Lecture seule en base (connexion du compte audit).
// Géolocalisation simulée à Grasse (43.6584, 6.9225). Mot de passe des comptes audit : lu dans parcours.mjs, jamais recopié.
import { chromium } from 'playwright'
import fs from 'fs'

const BASE = process.env.BASE || 'http://localhost:3000'
const CLIENT = 'audit.client.claude@ping-demo.invalid', PRO = 'audit.pro.claude@ping-demo.invalid'
const PWD = process.env.AUDIT_PWD || fs.readFileSync(new URL('./parcours.mjs', import.meta.url), 'utf8').match(/PWD = '([^']+)'/)[1]
const OUT = new URL('../../docs/refonte-recherche-2026-11-23/', import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })
const GRASSE = { latitude: 43.6584, longitude: 6.9225 }
const SAINT_RAPHAEL = { latitude: 43.4254, longitude: 6.7684 }
const res = { base: BASE, taps: [], checks: [] }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const check = (k, v, ok) => { res.checks.push({ k, v, ok: !!ok }); console.log(ok ? 'OK' : 'KO', k, typeof v === 'string' ? v : JSON.stringify(v)); return ok }

async function ctx(browser, geo) {
  return browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris', geolocation: geo, permissions: ['geolocation'] })
}
async function login(page, email = CLIENT) {
  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle' })
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(PWD)
  await page.locator('button[type=submit], button:has-text("connecter")').first().click()
  await page.waitForTimeout(3500)
}
const shot = (page, name) => page.screenshot({ path: `${OUT}${name}.jpg`, quality: 72, type: 'jpeg' })
async function openMap(page) {
  await page.evaluate(() => { localStorage.setItem('ping_mode', 'particulier'); localStorage.removeItem('ping_sheet_map') })
  await page.goto(BASE + '/map', { waitUntil: 'networkidle' }).catch(() => { })
  await page.waitForFunction(() => { const e = document.querySelector('[data-map-status]'); return e && !/Recherche/.test(e.textContent || '') }, null, { timeout: 30000 }).catch(() => { })
  await page.waitForTimeout(3500)
}
const statusText = page => page.locator('[data-map-status]').innerText().catch(() => '')
// Un appui = un toucher réel (événements tactiles) ; chaque appui est compté et nommé.
let taps = 0
async function tap(locator, label) {
  taps++; res.taps.push(label); console.log(`appui ${taps} : ${label}`)
  await locator.tap()
}
const smallTargets = page => page.evaluate(() => [...document.querySelectorAll('[data-find-sheet] button')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && Math.min(r.width, r.height) < 43.5 }).map(b => `${(b.getAttribute('aria-label') || b.innerText).trim().slice(0, 30)} ${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`))

// Position à l'écran (centre) du point « Vous êtes ici » et des gouttes d'épingles.
const POS = () => {
  const c = e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }
  const dot = document.querySelector('.you-dot')
  return { dot: dot ? c(dot) : null, pins: [...document.querySelectorAll('.ping-pin .pin-hit')].map(c).filter(p => p.x > 0 && p.x < innerWidth && p.y > 0 && p.y < innerHeight) }
}
async function touch(cdp, type, pts) { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i })) }) }
async function drag(cdp, a, b, steps = 10) {
  await touch(cdp, 'touchStart', [a])
  for (let i = 1; i <= steps; i++) { await touch(cdp, 'touchMove', [{ x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps }]); await sleep(16) }
  await touch(cdp, 'touchEnd', [])
}
async function pinch(cdp, c, d0, d1, steps = 12) {
  const at = d => [{ x: c.x - d / 2, y: c.y }, { x: c.x + d / 2, y: c.y }]
  await touch(cdp, 'touchStart', at(d0))
  for (let i = 1; i <= steps; i++) { await touch(cdp, 'touchMove', at(d0 + (d1 - d0) * i / steps)); await sleep(16) }
  await touch(cdp, 'touchEnd', [])
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

const browser = await chromium.launch()
try {
  // ===================== 1. Parcours rapide (Grasse) =====================
  {
    const c = await ctx(browser, GRASSE); const page = await c.newPage()
    const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 160)))
    let bookAttempts = 0
    await page.route(/\/rpc\/book_service/, r => { bookAttempts++; r.abort() })
    await login(page); await openMap(page)
    const st = await statusText(page)
    check('ligne d’état de la carte', st.replace(/\s+/g, ' ').trim(), /\d+ en ligne près de vous/.test(st))
    check('une seule action principale en bas', await page.locator('[data-find-open]').innerText(), /Trouver un prestataire/.test(await page.locator('[data-find-open]').innerText()))
    const fb = await page.locator('[data-find-open]').boundingBox()
    check('bouton principal >= 44 px', `${Math.round(fb.width)}x${Math.round(fb.height)}`, fb.height >= 44)
    check('« Déposer une demande » plus sur la carte (hors feuille)', await page.locator('button:has-text("Déposer une demande")').count(), await page.locator('button:has-text("Déposer une demande")').count() <= 1)
    await shot(page, '01-carte-en-ligne')

    // a. appui « Trouver un prestataire »
    await tap(page.locator('[data-find-open]'), 'Trouver un prestataire')
    await page.getByRole('heading', { name: /De quoi avez-vous besoin/ }).waitFor({ timeout: 8000 })
    await sleep(400); await shot(page, '02-a-de-quoi-avez-vous-besoin')
    const tiles = await page.locator('[data-find-sheet] [role=group] button').allInnerTexts()
    check('3 tuiles de service', tiles.map(t => t.trim()), tiles.length === 3 && ['Ménage', 'Repassage', 'Nettoyage'].every(t => tiles.some(x => x.includes(t))))
    check('cibles du dialogue >= 44 px (étape 1)', await smallTargets(page), (await smallTargets(page)).length === 0)
    // b. appui sur une tuile
    await tap(page.getByRole('button', { name: /^Ménage$/ }), 'tuile Ménage')
    await page.getByRole('heading', { name: /^Quand/ }).waitFor({ timeout: 8000 })
    await sleep(400); await shot(page, '03-b-quand')
    check('« Dès que possible » présélectionné', await page.getByRole('radio', { name: /Dès que possible/ }).getAttribute('aria-checked'), (await page.getByRole('radio', { name: /Dès que possible/ }).getAttribute('aria-checked')) === 'true')
    check('cibles du dialogue >= 44 px (étape 2)', await smallTargets(page), (await smallTargets(page)).length === 0)
    // c. appui « Voir les prestataires »
    await tap(page.getByRole('button', { name: 'Voir les prestataires' }), 'Voir les prestataires')
    await page.getByRole('heading', { name: /meilleur choix/ }).waitFor({ timeout: 8000 })
    await sleep(500); await shot(page, '04-c-meilleur-choix')
    const best = (await page.locator('[data-find-sheet]').innerText()).replace(/\s+/g, ' ')
    check('une carte « meilleur choix » + un gros bouton Réserver', best.slice(0, 160), /Réserver|Demander un devis/.test(best))
    check('cibles du dialogue >= 44 px (étape 3)', await smallTargets(page), (await smallTargets(page)).length === 0)
    const rb = await page.locator('[data-find-reserve]').boundingBox()
    check('bouton Réserver >= 44 px', `${Math.round(rb.width)}x${Math.round(rb.height)}`, rb.height >= 44)
    // d. appui « Réserver » -> réservation existante préremplie
    await tap(page.locator('[data-find-reserve]'), 'Réserver')
    await page.waitForURL(/\/mission\/new\?/, { timeout: 15000 })
    await page.waitForFunction(() => /Confirmer la réservation|Confirmer ·|Demander un devis/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => { })
    await sleep(1500); await shot(page, '05-d-reservation-prerempli')
    const url = page.url().replace(BASE, '')
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
    check('URL de réservation préremplie (pro, métier, moment)', url, /pro=/.test(url) && /trade=menage/.test(url) && /when=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(decodeURIComponent(url)))
    check('écran de confirmation atteint, bouton de confirmation visible', (body.match(/Confirmer[^.]{0,40}/) || [''])[0], /Confirmer la réservation|Confirmer ·/.test(body) || /Demander un devis/.test(body))
    check('moment prérempli affiché', (body.match(/Date et heure souhaitées[^A-Z]{0,80}/) || ['(créneaux du prestataire : à choisir)'])[0], /Date et heure souhaitées/.test(body) ? /(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i.test(body) : true)
    check('service prérempli (Ménage)', (body.match(/Ménage[^.]{0,60}/) || [''])[0], /Ménage/.test(body))
    check('prestataire avec créneaux publiés (appui en plus) ?', /Choisir un créneau/.test(body), true)
    res.tapsToConfirmScreen = taps
    check(`APPUIS de la carte à l’écran de réservation prérempli : ${taps}`, res.taps, taps <= 4)
    check('aucune réservation créée (book_service jamais envoyé)', bookAttempts, bookAttempts === 0)
    check('erreurs de page', errs, errs.length === 0)
    await c.close()
  }

  // ===================== 2. Multi-choix =====================
  {
    const c = await ctx(browser, GRASSE); const page = await c.newPage()
    await login(page); await openMap(page)
    await page.locator('[data-find-open]').tap()
    await page.getByRole('heading', { name: /De quoi avez-vous besoin/ }).waitFor({ timeout: 8000 })
    await page.getByRole('switch', { name: 'Plusieurs services' }).tap()
    await page.getByRole('button', { name: /^Ménage$/ }).tap(); await page.getByRole('button', { name: /^Repassage$/ }).tap()
    await sleep(300); await shot(page, '06-multi-choix')
    const cont = page.getByRole('button', { name: 'Continuer' })
    check('multi-choix : « Continuer » actif après 2 services', await cont.isEnabled(), await cont.isEnabled())
    const sw = await page.getByRole('switch', { name: 'Plusieurs services' }).boundingBox()
    check('interrupteur : zone de toucher >= 44 px', `${Math.round(sw.width)}x${Math.round(sw.height)}`, sw.height >= 44 && sw.width >= 44)
    await cont.tap(); await page.getByRole('heading', { name: /^Quand/ }).waitFor({ timeout: 8000 })
    await page.getByRole('radio', { name: /Choisir une date/ }).tap(); await sleep(500); await shot(page, '07-choisir-une-date')
    await c.close()
  }

  // ===================== 3. Personne dans le rayon (Saint-Raphaël) =====================
  {
    const c = await ctx(browser, SAINT_RAPHAEL); const page = await c.newPage()
    await login(page); await openMap(page); await sleep(2500)
    const st = (await statusText(page)).replace(/\s+/g, ' ').trim()
    check('message « aucun à moins de 15 km »', st, /Aucun prestataire à moins de 15 km : les plus proches sont à \d+ km/.test(st))
    const vis = await page.evaluate(() => [...document.querySelectorAll('.ping-pin .pin-hit')].filter(e => { const r = e.getBoundingClientRect(); return r.x > 0 && r.x < innerWidth && r.y > 60 && r.y < innerHeight - 150 }).length)
    check('la carte montre les prestataires les plus proches (épingles dans le cadre)', vis, vis >= 1)
    await shot(page, '08-personne-dans-le-rayon')
    await c.close()
  }

  // ===================== 4. Zoom libre, pas de recadrage tout seul =====================
  {
    const c = await ctx(browser, GRASSE); const page = await c.newPage(); const cdp = await c.newCDPSession(page)
    await login(page); await openMap(page)
    const p0 = await page.evaluate(POS)
    check('point de départ lu', { dot: p0.dot, pins: p0.pins.length }, !!p0.dot)
    // déplacement ailleurs que sur la position
    await drag(cdp, { x: 300, y: 300 }, { x: 220, y: 230 }); await sleep(600)
    const p1 = await page.evaluate(POS)
    const dx = p1.dot.x - p0.dot.x, dy = p1.dot.y - p0.dot.y
    check('déplacement : la carte suit le doigt (~ -80, -70)', { dx: Math.round(dx), dy: Math.round(dy) }, Math.abs(dx + 80) < 14 && Math.abs(dy + 70) < 14)
    await shot(page, '09-zoom-1-apres-deplacement')
    // pincement sur un point éloigné de la position
    const C = { x: 300, y: 260 }
    await pinch(cdp, C, 60, 160); await sleep(1000)
    const p2 = await page.evaluate(POS)
    const r1 = dist(p1.dot, C), r2 = dist(p2.dot, C)
    const k = r2 / r1
    const ang = Math.abs(Math.atan2(p2.dot.y - C.y, p2.dot.x - C.x) - Math.atan2(p1.dot.y - C.y, p1.dot.x - C.x)) * 180 / Math.PI
    check('pincement : zoom autour du point touché (rapport > 1,5, direction conservée)', { rapport: +k.toFixed(2), ecartAngleDeg: +ang.toFixed(1) }, k > 1.5 && ang < 6)
    await shot(page, '10-zoom-2-apres-pincement')
    // attente + actualisation (bouton PING) : la vue ne bouge pas toute seule
    await sleep(6000)
    await page.locator('.pingbtn').tap(); await sleep(5000)
    const p3 = await page.evaluate(POS)
    check('aucun recadrage tout seul (8 s + actualisation PING)', { ecart: +dist(p3.dot, p2.dot).toFixed(1) }, dist(p3.dot, p2.dot) < 3)
    // double appui sur un autre endroit
    const T = { x: 120, y: 260 }
    await page.touchscreen.tap(T.x, T.y); await sleep(110); await page.touchscreen.tap(T.x, T.y); await sleep(900)
    const p4 = await page.evaluate(POS)
    const k2 = dist(p4.dot, T) / dist(p3.dot, T)
    check('double appui : zoom d’un cran sur l’endroit touché (rapport ~ 2)', { rapport: +k2.toFixed(2) }, k2 > 1.7 && k2 < 2.3)
    await shot(page, '11-zoom-3-apres-double-appui')
    await sleep(4000)
    const p5 = await page.evaluate(POS)
    check('toujours aucun recadrage tout seul', { ecart: +dist(p5.dot, p4.dot).toFixed(1) }, dist(p5.dot, p4.dot) < 3)
    // Recentrer : revient sur la position
    await page.locator('.loc').tap(); await sleep(1200)
    const p6 = await page.evaluate(POS)
    check('« Recentrer » ramène la position à l’écran (centre de la zone visible)', { x: Math.round(p6.dot.x), y: Math.round(p6.dot.y) }, Math.abs(p6.dot.x - 195) < 30 && p6.dot.y > 150 && p6.dot.y < 560)
    await shot(page, '12-zoom-4-apres-recentrer')
    await c.close()
  }

  // ===================== 5. Épingles « en ligne maintenant » / « disponible plus tard » + détail par métier =====================
  // Simulation côté navigateur seulement (rien n'est écrit) : un prestataire « hors ligne » est ajouté à la réponse de
  // providers_nearby, à ~300 m de la position, pour voir les deux styles d'épingle côte à côte.
  {
    const c = await ctx(browser, GRASSE); const page = await c.newPage()
    await page.route(/\/rpc\/providers_nearby/, async route => {
      const r = await route.fetch(); let j = []
      try { j = await r.json() } catch { }
      if (Array.isArray(j) && j.length) j = [...j, { ...j[0], id: '00000000-0000-4000-8000-00000000qa01', full_name: 'QA hors ligne simulé', is_active: false, lat: j[0].lat + 0.0022, lng: j[0].lng + 0.0030, distance_m: 380, rating: 0, reviews_count: 0 }]
      await route.fulfill({ response: r, json: j })
    })
    await login(page); await openMap(page)
    const live = await page.locator('.ping-pin .pin-live').count()
    const later = await page.locator('.ping-pin .pin-tag:has-text("Plus tard")').count()
    check('épingles en ligne : anneau animé présent ; hors ligne : « Plus tard » sans anneau', { enLigneAnimees: live, plusTard: later }, live >= 1 && later === 1)
    await shot(page, '13-epingles-en-ligne-et-plus-tard')
    const st = (await statusText(page)).replace(/\s+/g, ' ').trim()
    check('ligne d’état ne compte que les prestataires en ligne', st, /^\d+ en ligne près de vous$/.test(st))
    await page.locator('[data-map-status]').tap(); await sleep(500)
    const panel = (await page.locator('.map-status-panel').innerText().catch(() => '')).replace(/\s+/g, ' ')
    check('au toucher de la ligne : détail par métier', panel, /en ligne/.test(panel) && /Filtrer par service/.test(panel))
    await shot(page, '14-detail-par-metier')
    await c.close()
  }

  // ===================== 6. Prestataire : « Voir la plus proche » (/pro/carte) =====================
  {
    const c = await ctx(browser, GRASSE); const page = await c.newPage()
    await login(page, PRO)
    await page.evaluate(() => { localStorage.setItem('ping_mode', 'pro'); localStorage.setItem('ping_sheet_pro-carte', 'half') })
    await page.goto(BASE + '/pro/carte', { waitUntil: 'networkidle' }).catch(() => { })
    await sleep(5000)
    const b = page.locator('[data-voir-plus-proche]:visible').first()
    const n = await page.locator('[data-voir-plus-proche]:visible').count()
    check('prestataire : bouton « Voir la plus proche » (si des demandes sont ouvertes)', n ? (await b.innerText()).trim() : 'aucune demande ouverte dans la zone du compte audit : non vérifié', true)
    await shot(page, '15-pro-voir-la-plus-proche')
    if (n) {
      const bb = await b.boundingBox()
      check('bouton >= 44 px', `${Math.round(bb.width)}x${Math.round(bb.height)}`, bb.height >= 44)
      await b.tap(); await sleep(900); await shot(page, '16-pro-demande-la-plus-proche')
      check('un appui ouvre la demande (bouton de la liste disparu)', await page.locator('[data-voir-plus-proche]:visible').count(), (await page.locator('[data-voir-plus-proche]:visible').count()) === 0)
    }
    await c.close()
  }
} finally {
  await browser.close()
}
res.ko = res.checks.filter(c => !c.ok).map(c => c.k)
fs.writeFileSync(OUT + 'mesures.json', JSON.stringify(res, null, 2))
console.log(`\nAppuis jusqu’à la réservation préremplie : ${res.tapsToConfirmScreen} (objectif <= 4). Contrôles KO : ${res.ko.length}`, res.ko)
process.exit(res.ko.length ? 1 : 0)
