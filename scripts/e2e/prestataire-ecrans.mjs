// Captures et mesures des écrans prestataire (carte, Mon entreprise, Agenda, carte « Mon annonce »), mobile 390x844.
//   PHASE=avant|apres BASE=http://localhost:3000 node scripts/e2e/prestataire-ecrans.mjs   (depuis la racine du dépôt)
// Écrit docs/refonte-prestataire-2026-11-24/<PHASE>-*.jpg et mesures-<PHASE>.json.
// Aucune donnée modifiée : connexion du compte audit seulement ; les écritures vers provider_profiles sont
// interceptées côté navigateur (jamais envoyées) et l'état « En ligne / En pause » est simulé en réécrivant la LECTURE.
// Mot de passe des comptes audit : lu dans parcours.mjs, jamais recopié.
import { chromium } from 'playwright'
import fs from 'fs'

const BASE = process.env.BASE || 'http://localhost:3000'
const PHASE = process.env.PHASE || 'apres'
const PRO = 'audit.pro.claude@ping-demo.invalid', CLIENT = 'audit.client.claude@ping-demo.invalid'
const PWD = process.env.AUDIT_PWD || fs.readFileSync(new URL('./parcours.mjs', import.meta.url), 'utf8').match(/PWD = '([^']+)'/)[1]
const OUT = new URL('../../docs/refonte-prestataire-2026-11-24/', import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })
const GRASSE = { latitude: 43.6584, longitude: 6.9225 }
const res = { base: BASE, phase: PHASE, checks: [], mesures: {} }
const check = (k, v, ok) => { res.checks.push({ k, v, ok: !!ok }); console.log(ok ? 'OK' : 'KO', k, typeof v === 'string' ? v : JSON.stringify(v)); return ok }
const shot = (page, name, full = false) => page.screenshot({ path: `${OUT}${PHASE}-${name}.jpg`, quality: 72, type: 'jpeg', fullPage: full })

async function ctx(browser) {
  return browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris', geolocation: GRASSE, permissions: ['geolocation'] })
}
async function login(page, email) {
  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle' })
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(PWD)
  await page.locator('button[type=submit], button:has-text("connecter")').first().click()
  await page.waitForTimeout(4000)
}
const setMode = (page, m) => page.evaluate(m => { localStorage.setItem('ping_mode', m); localStorage.removeItem('ping_sheet_pro-carte') }, m)

// Mesure du premier écran : texte visible le plus petit, bordures visibles, cibles tactiles < 44 px.
const mesure = page => page.evaluate(() => {
  const vh = innerHeight, vw = innerWidth
  const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw && s.visibility !== 'hidden' && s.display !== 'none' }
  let minFont = 99; const small = []
  document.querySelectorAll('body *').forEach(e => {
    if (!vis(e)) return
    const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)
    if (!own) return
    const fs = parseFloat(getComputedStyle(e).fontSize)
    if (fs < minFont) minFont = fs
    if (fs < 12) small.push(`${fs}px ${e.textContent.trim().slice(0, 24)}`)
  })
  let borders = 0
  document.querySelectorAll('body *').forEach(e => {
    if (!vis(e)) return
    const s = getComputedStyle(e)
    if (['Top', 'Right', 'Bottom', 'Left'].some(k => parseFloat(s['border' + k + 'Width']) > 0 && s['border' + k + 'Style'] !== 'none' && !/rgba\(0, 0, 0, 0\)/.test(s['border' + k + 'Color']))) {
      const r = e.getBoundingClientRect(); if (r.width > 40 && r.height > 24) borders++
    }
  })
  const tiny = [...document.querySelectorAll('button, [role=button], a')].filter(e => { if (!vis(e)) return false; const r = e.getBoundingClientRect(); return Math.min(r.width, r.height) < 43.5 }).map(e => `${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)} ${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}`)
  return { minFont, textesSous12px: small.slice(0, 6), bordures: borders, ciblesSous44: tiny.slice(0, 8) }
})

// Lecture simulée de provider_profiles (is_active / payments_suspended_at) ; écritures bloquées.
async function simulate(page, patch) {
  await page.route('**/rest/v1/provider_profiles**', async route => {
    const req = route.request()
    if (req.method() !== 'GET') { res.checks.push({ k: 'écriture interceptée ' + req.method(), v: req.postData() || '', ok: true }); return route.fulfill({ status: 204, body: '' }) }
    const r = await route.fetch(); let body = await r.text()
    try { const j = JSON.parse(body); const f = o => ({ ...o, ...patch }); body = JSON.stringify(Array.isArray(j) ? j.map(f) : f(j)) } catch { }
    return route.fulfill({ response: r, body })
  })
}

const browser = await chromium.launch()
try {
  // ---------- Prestataire ----------
  const c = await ctx(browser); const page = await c.newPage()
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 120)))
  await login(page, PRO); await setMode(page, 'pro')

  // 1. Carte : bouton PING + Recentrer
  await page.goto(BASE + '/pro/carte', { waitUntil: 'networkidle' }).catch(() => { })
  await page.waitForTimeout(5000)
  await shot(page, 'carte-pro-reduite')
  res.mesures.carteReduite = await mesure(page)
  const ping = page.locator('.pingbtn')
  const nPing = await ping.count()
  check('carte pro : bouton PING présent (mobile)', nPing, PHASE === 'avant' ? true : nPing === 1)
  if (nPing) {
    const b = await ping.first().boundingBox(); const l = await page.locator('.loc').first().boundingBox()
    check('PING >= 44 px', b && `${Math.round(b.width)}x${Math.round(b.height)}`, b && b.width >= 44 && b.height >= 44)
    check('PING à côté de Recentrer (même ligne, sans chevauchement)', { ping: b, loc: l }, b && l && Math.abs((b.y + b.height / 2) - (l.y + l.height / 2)) < 40 && (b.x >= l.x + l.width - 1 || l.x >= b.x + b.width - 1))
    const before = []; page.on('request', r => { if (/requests_nearby/.test(r.url())) before.push(r.url()) })
    await ping.first().tap(); await page.waitForTimeout(2500)
    check('un appui sur PING relit les demandes autour de moi', before.length, before.length >= 1)
  }
  // feuille mi-hauteur
  const grip = page.locator('.map-sheet').first()
  await page.evaluate(() => localStorage.setItem('ping_sheet_pro-carte', 'half')).catch(() => { })
  await page.reload({ waitUntil: 'networkidle' }).catch(() => { }); await page.waitForTimeout(4000)
  await shot(page, 'carte-pro-mi-hauteur')
  res.mesures.carteMiHauteur = await mesure(page)

  // 2. Mon entreprise
  await page.goto(BASE + '/pro/dashboard', { waitUntil: 'networkidle' }).catch(() => { }); await page.waitForTimeout(4500)
  await shot(page, 'mon-entreprise'); await shot(page, 'mon-entreprise-page-entiere', true)
  res.mesures.monEntreprise = await mesure(page)
  const enc = await page.locator('[data-commandes]').count()
  check('Mon entreprise : encart Commandes en cours', enc, PHASE === 'avant' ? true : enc === 1)
  if (enc) {
    res.commandes = await page.locator('[data-commandes]').innerText()
    console.log(res.commandes.replace(/\n+/g, ' | '))
  }

  // 3. Agenda : calendrier Mois / Semaine / Jour
  await page.goto(BASE + '/agenda?onglet=calendrier', { waitUntil: 'networkidle' }).catch(() => { }); await page.waitForTimeout(4000)
  await page.evaluate(() => sessionStorage.setItem('ping_agenda_tab', 'calendrier'))
  await page.reload({ waitUntil: 'networkidle' }).catch(() => { }); await page.waitForTimeout(4000)
  for (const [lab, key] of [['Mois', 'mois'], ['Semaine', 'semaine'], ['Jour', 'jour']]) {
    await page.getByRole('button', { name: lab, exact: true }).first().tap().catch(() => { })
    await page.waitForTimeout(600)
    if (key === 'jour') { // jour du 26/11
      for (let i = 0; i < 6; i++) { const t = await page.locator('b[style*="capitalize"]').first().innerText().catch(() => ''); if (/26 novembre/i.test(t)) break; await page.getByLabel('Suivant').tap(); await page.waitForTimeout(250) }
    }
    await shot(page, `agenda-${key}-pro`)
    if (key === 'mois') res.mesures.agendaMoisPro = await mesure(page)
    const txt = await page.locator('[role=tabpanel]').innerText()
    res.mesures['agenda_' + key + '_pro'] = txt.replace(/\n+/g, ' | ').slice(0, 400)
    if (key === 'mois') {
      const pend = await page.locator('[data-pending-day]').count()
      check('Agenda pro (mois) : jours avec réservation à accepter', pend, PHASE === 'avant' ? true : pend >= 1)
    } else {
      const pend = await page.locator('[data-pending-event]').count()
      check(`Agenda pro (${lab}) : réservation « À accepter » visible`, pend, PHASE === 'avant' ? true : pend >= 1)
    }
  }
  // Détail au toucher d'un jour (vue mois)
  await page.getByRole('button', { name: 'Mois', exact: true }).first().tap().catch(() => { }); await page.waitForTimeout(500)
  for (let i = 0; i < 2; i++) { const t = await page.locator('b[style*="capitalize"]').first().innerText().catch(() => ''); if (/novembre/i.test(t)) break; await page.getByLabel('Suivant').tap(); await page.waitForTimeout(300) }
  const dayBtn = page.locator('[data-pending-day]').first()
  if (await dayBtn.count()) {
    await dayBtn.tap(); await page.waitForTimeout(800)
    await shot(page, 'agenda-detail-jour-pro')
    const det = await page.locator('[data-day-detail]').count()
    check('Agenda : détail du jour au toucher', det, det >= 1)
  }
  // Texte de l'onglet En cours
  await page.getByRole('tab', { name: /En cours/ }).tap(); await page.waitForTimeout(800)
  await shot(page, 'agenda-en-cours-pro')

  // 4. Mon annonce : états simulés sur Mon entreprise
  for (const [name, patch] of [['en-ligne', { is_active: true, payments_suspended_at: null }], ['en-pause', { is_active: false, payments_suspended_at: null }], ['suspendue', { is_active: true, payments_suspended_at: '2026-11-01T00:00:00Z' }]]) {
    const p2 = await c.newPage(); await simulate(p2, patch)
    await p2.goto(BASE + '/pro/dashboard', { waitUntil: 'networkidle' }).catch(() => { }); await p2.waitForTimeout(4500)
    await shot(p2, `annonce-${name}`)
    await p2.evaluate(() => document.querySelector('[data-mon-annonce]')?.scrollIntoView({ block: 'start' })); await p2.waitForTimeout(400)
    await shot(p2, `annonce-${name}-actions`)
    const card = p2.locator('[data-mon-annonce]')
    if (await card.count()) {
      res.mesures['annonce_' + name] = (await card.innerText()).replace(/\n+/g, ' | ')
      console.log(name, '->', res.mesures['annonce_' + name])
      if (name === 'en-ligne') {
        await card.getByRole('button', { name: /Mettre en pause|Retirer de la carte/ }).first().tap(); await p2.waitForTimeout(500)
        await p2.evaluate(() => document.querySelector('[data-mon-annonce]')?.scrollIntoView({ block: 'start' })); await p2.waitForTimeout(300)
        await shot(p2, 'annonce-confirmation-pause')
        const conf = await p2.locator('[data-annonce-confirm]').count()
        check('Mettre en pause : confirmation sans confirm() natif', conf, conf === 1)
        const btn = p2.locator('[data-annonce-confirm] button').filter({ hasText: /Oui|Confirmer|Mettre en pause/ }).first()
        if (await btn.count()) { await btn.tap(); await p2.waitForTimeout(1200); await shot(p2, 'annonce-apres-pause') }
      }
    } else if (PHASE !== 'avant') check('carte Mon annonce présente', 0, false)
    await p2.close()
  }
  check('aucune erreur de page (pro)', errs, errs.length === 0)
  await c.close()

  // ---------- Client : Agenda, réservations en attente ----------
  const cc = await ctx(browser); const pc = await cc.newPage()
  await login(pc, CLIENT); await setMode(pc, 'particulier')
  await pc.goto(BASE + '/agenda', { waitUntil: 'networkidle' }).catch(() => { })
  await pc.evaluate(() => sessionStorage.setItem('ping_agenda_tab', 'calendrier'))
  await pc.reload({ waitUntil: 'networkidle' }).catch(() => { }); await pc.waitForTimeout(4000)
  await pc.getByRole('button', { name: 'Mois', exact: true }).first().tap().catch(() => { }); await pc.waitForTimeout(500)
  for (let i = 0; i < 2; i++) { const t = await pc.locator('b[style*="capitalize"]').first().innerText().catch(() => ''); if (/novembre/i.test(t)) break; await pc.getByLabel('Suivant').tap(); await pc.waitForTimeout(300) }
  await shot(pc, 'agenda-mois-client')
  const pendC = await pc.locator('[data-pending-day]').count()
  check('Agenda client (mois) : jours avec « En attente »', pendC, PHASE === 'avant' ? true : pendC >= 1)
  await pc.getByRole('button', { name: 'Semaine', exact: true }).first().tap().catch(() => { }); await pc.waitForTimeout(500)
  await shot(pc, 'agenda-semaine-client')
  res.mesures.agenda_client = (await pc.locator('[role=tabpanel]').innerText()).replace(/\n+/g, ' | ').slice(0, 300)
  await cc.close()
} finally {
  await browser.close()
  fs.writeFileSync(`${OUT}mesures-${PHASE}.json`, JSON.stringify(res, null, 1))
  console.log(res.checks.filter(x => !x.ok).length, 'KO /', res.checks.length)
}
