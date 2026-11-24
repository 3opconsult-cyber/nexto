// Cartes, identité de session, visibilité, adresse de référence, position : captures et contrôles, mobile 390x844.
//   PHASE=avant|apres BASE=http://localhost:3000 node scripts/e2e/carte-identite.mjs   (depuis la racine du dépôt)
// Écrit docs/refonte-carte-identite-2026-11-24/<PHASE>-*.jpg et mesures-<PHASE>.json.
// AUCUNE donnée modifiée : connexion des comptes audit seulement ; TOUTE écriture vers l'API Supabase (hors lecture et
// appels rpc) est interceptée côté navigateur, enregistrée dans le rapport, jamais envoyée. Nominatim est simulé
// (réponses fixes) pour que le test ne dépende pas du service public. Mot de passe : lu dans parcours.mjs (ligne 22),
// jamais recopié.
import { chromium } from 'playwright'
import fs from 'fs'

const BASE = process.env.BASE || 'http://localhost:3000'
const PHASE = process.env.PHASE || 'apres'
const PRO = 'audit.pro.claude@ping-demo.invalid'
const PWD = process.env.AUDIT_PWD || fs.readFileSync(new URL('./parcours.mjs', import.meta.url), 'utf8').match(/PWD = '([^']+)'/)[1]
const OUT = new URL('../../docs/refonte-carte-identite-2026-11-24/', import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })
const GRASSE = { latitude: 43.6584, longitude: 6.9225 }
const res = { base: BASE, phase: PHASE, checks: [], writes: [], mesures: {} }
const check = (k, v, ok) => { res.checks.push({ k, v, ok: !!ok }); console.log(ok ? 'OK' : 'KO', k, typeof v === 'string' ? v : JSON.stringify(v)); return ok }
const shot = (page, name, full = false) => page.screenshot({ path: `${OUT}${PHASE}-${name}.jpg`, quality: 72, type: 'jpeg', fullPage: full })
const apres = PHASE !== 'avant'

async function ctx(browser, geo = { ...GRASSE, accuracy: 30 }, perms = ['geolocation']) {
  return browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris', geolocation: geo, permissions: perms })
}
async function login(page) {
  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle' })
  await page.locator('input[type=email]').fill(PRO)
  await page.locator('input[type=password]').fill(PWD)
  await page.locator('button[type=submit], button:has-text("connecter")').first().click()
  await page.waitForTimeout(4000)
}
const setMode = (page, m) => page.evaluate(m => { localStorage.setItem('ping_mode', m); localStorage.removeItem('ping_sheet_pro-carte'); localStorage.removeItem('ping_sheet_map') }, m)

// Aucune écriture : tout ce qui n'est pas une lecture ni un rpc de lecture part vers /dev/null (204).
async function blockWrites(page, patchGet) {
  await page.route(/\/rest\/v1\//, async route => {
    const req = route.request(); const url = req.url()
    if (req.method() === 'GET' || req.method() === 'HEAD') {
      if (patchGet && /\/rest\/v1\/provider_profiles/.test(url) && !/select=id(&|$)/.test(url)) {
        const r = await route.fetch(); let body = await r.text()
        try { const j = JSON.parse(body); const f = o => ({ ...o, ...patchGet }); body = JSON.stringify(Array.isArray(j) ? j.map(f) : f(j)) } catch { }
        return route.fulfill({ response: r, body })
      }
      return route.continue()
    }
    if (/\/rpc\//.test(url)) return route.continue() // lectures (providers_nearby, requests_nearby, compteurs)
    res.writes.push({ m: req.method(), t: url.split('/rest/v1/')[1].split('?')[0], body: req.postData() || '' })
    return route.fulfill({ status: 204, body: '' })
  })
}
// Nominatim simulé : une adresse précise, une rue sans numéro, une ville seule.
async function mockNominatim(page) {
  await page.route(/nominatim\.openstreetmap\.org/, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([
      { lat: '43.6612', lon: '6.9301', display_name: '2, Rue de l’Audit, Grasse', address: { house_number: '2', road: 'Rue de l’Audit', postcode: '06130', city: 'Grasse' } },
      { lat: '43.6570', lon: '6.9180', display_name: 'Rue de l’Audit, Grasse', address: { road: 'Rue de l’Audit', postcode: '06130', city: 'Grasse' } },
      { lat: '43.6584', lon: '6.9225', display_name: 'Grasse', address: { postcode: '06130', city: 'Grasse' } },
    ]),
  }))
}

const mesure = page => page.evaluate(() => {
  const vh = innerHeight, vw = innerWidth
  const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw && s.visibility !== 'hidden' && s.display !== 'none' }
  const tiny = [...document.querySelectorAll('button, [role=button], a')].filter(e => { if (!vis(e)) return false; const r = e.getBoundingClientRect(); return Math.min(r.width, r.height) < 43.5 }).map(e => `${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)} ${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}`)
  return { ciblesSous44: tiny.slice(0, 8) }
})
const minFontOf = (page, sel) => page.evaluate(sel => { let m = 99; document.querySelectorAll(sel + ' *, ' + sel).forEach(e => { const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1); if (own) m = Math.min(m, parseFloat(getComputedStyle(e).fontSize)) }); return m }, sel)

const browser = await chromium.launch()
try {
  // ================= Carte du particulier (/map) =================
  {
    const c = await ctx(browser); const page = await c.newPage()
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 120)))
    await login(page); await setMode(page, 'particulier'); await blockWrites(page); await mockNominatim(page)
    const nearby = []; page.on('request', r => { if (/providers_nearby/.test(r.url())) nearby.push(Date.now()) })
    await page.goto(BASE + '/map', { waitUntil: 'networkidle' }).catch(() => { }); await page.waitForTimeout(5000)
    await shot(page, 'carte-client')
    res.mesures.carteClient = await mesure(page)
    if (apres) {
      const b = page.locator('[data-session-badge]')
      check('carte client : pastille « Particulier » en haut à droite', { n: await b.count(), txt: await b.first().innerText().catch(() => ''), box: await b.first().boundingBox().catch(() => null) },
        (await b.count()) === 1 && /Particulier/.test(await b.first().innerText()) && (await b.first().boundingBox()).y < 80 && (await b.first().boundingBox()).x + (await b.first().boundingBox()).width > 340)
      // appui : explication puis menu ; le mode ne change pas
      await b.first().tap(); await page.waitForTimeout(500); await shot(page, 'pastille-explication-client')
      const modalTxt = await page.locator('[role=dialog][aria-label^="Vous êtes dans"]').innerText().catch(() => '')
      check('pastille : explique et renvoie au menu', modalTxt.slice(0, 160), /menu/i.test(modalTxt) && /Particulier/.test(modalTxt))
      await page.locator('[data-session-open-menu]').tap(); await page.waitForTimeout(700); await shot(page, 'pastille-menu-ouvert-client')
      check('pastille : le menu s’ouvre (bascule uniquement dans le menu)', await page.getByText('Support PING').count(), (await page.getByText('Support PING').count()) >= 1)
      check('pastille : le mode n’a pas changé', await page.evaluate(() => localStorage.getItem('ping_mode')), (await page.evaluate(() => localStorage.getItem('ping_mode'))) === 'particulier')
      await page.reload({ waitUntil: 'networkidle' }).catch(() => { }); await page.waitForTimeout(4500)
      // PING : requêtes + ligne d'état
      const before = nearby.length
      const txt0 = await page.locator('[data-map-status] .tx').innerText()
      await page.locator('.pingbtn').first().tap(); await page.waitForTimeout(1900)
      const txt1 = await page.locator('[data-map-status] .tx').innerText()
      await shot(page, 'ping-ligne-actualise-client')
      check('PING client : providers_nearby repart', { avant: before, apres: nearby.length }, nearby.length > before)
      check('PING client : « Actualisé : N prestataires en ligne » puis texte normal', { avant: txt0, pendant: txt1 }, /^Actualisé : \d+ prestataires? en ligne/.test(txt1) && txt1 !== txt0)
      await page.waitForTimeout(3200)
      const txt2 = await page.locator('[data-map-status] .tx').innerText()
      check('PING client : la ligne disparaît après 3 s', txt2, !/Actualisé/.test(txt2))
      // feuille mi-hauteur : adresse de référence + position
      await page.evaluate(() => localStorage.setItem('ping_sheet_map', 'half')); await page.reload({ waitUntil: 'networkidle' }).catch(() => { }); await page.waitForTimeout(4500)
      await shot(page, 'carte-client-feuille-position-adresse')
      const line = page.locator('[data-adresse-reference]')
      check('carte client : « Adresse de référence : … » + Modifier', await line.innerText().catch(() => ''), (await line.count()) === 1 && /Adresse de référence/.test(await line.innerText()))
      await page.locator('[data-use-position]:visible').tap(); await page.waitForTimeout(3500)
      const prec = await page.locator('[data-position-precision]:visible').innerText().catch(() => '')
      await shot(page, 'position-precise-client')
      check('Utiliser ma position : précision affichée (±30 m)', prec, /±30 m/.test(prec))
      // adresse de référence : recherche, aperçu, ville seule, validation interceptée
      await page.locator('[data-adresse-modifier]').tap(); await page.waitForTimeout(500)
      await page.locator('#addr-ref-q').fill('2 rue de l Audit Grasse'); await page.waitForTimeout(1800)
      await shot(page, 'adresse-propositions')
      const props = await page.locator('[data-adresse-propositions] li').count()
      check('adresse : propositions d’autocomplétion', props, props === 3)
      await page.locator('[data-adresse-propositions] li').nth(2).locator('button').tap(); await page.waitForTimeout(2500)
      await shot(page, 'adresse-ville-seule-apercu')
      check('adresse : une ville seule est signalée AVANT de valider', await page.locator('[data-adresse-alerte]').innerText().catch(() => ''), (await page.locator('[data-adresse-alerte]').count()) === 1)
      await page.getByText('revoir les propositions').tap(); await page.waitForTimeout(400)
      await page.locator('[data-adresse-propositions] li').nth(0).locator('button').tap(); await page.waitForTimeout(2500)
      await shot(page, 'adresse-precise-apercu')
      check('adresse : mini-carte et point trouvé affichés', await page.locator('[data-adresse-apercu]').innerText().catch(() => ''), (await page.locator('[data-adresse-apercu] canvas, [data-adresse-apercu] .leaflet-container, [data-adresse-apercu] .maplibregl-map').count()) >= 1)
      check('adresse précise : aucune alerte', await page.locator('[data-adresse-alerte]').count(), (await page.locator('[data-adresse-alerte]').count()) === 0)
      res.writes.length = 0
      await page.locator('[data-adresse-utiliser]').tap(); await page.waitForTimeout(1500)
      const w = res.writes.find(x => x.t === 'profiles')
      check('adresse : écriture profiles.address interceptée (aucune donnée modifiée)', res.writes, !!w && /2 Rue de l’Audit, 06130 Grasse/.test(w.body))
      check('adresse : la ligne affiche la nouvelle adresse', await page.locator('[data-adresse-reference-texte]').innerText().catch(() => ''), /2 Rue de l’Audit/.test(await page.locator('[data-adresse-reference-texte]').innerText().catch(() => '')))
      await shot(page, 'carte-client-apres-adresse')
    }
    check('aucune erreur de page (carte client)', errs, errs.length === 0)
    await c.close()
  }
  // Position approximative et refusée (carte client)
  if (apres) {
    for (const [name, geo, perms, re] of [['approx', { ...GRASSE, accuracy: 3000 }, ['geolocation'], /Position approximative \(±3 km\) : activez Position précise dans Réglages/], ['refusee', null, [], /refusée pour PING|Réessayer/]]) {
      const c = await ctx(browser, geo || undefined, perms); const page = await c.newPage()
      await login(page); await setMode(page, 'particulier'); await blockWrites(page); await mockNominatim(page)
      await page.addInitScript(() => localStorage.setItem('ping_sheet_map', 'half'))
      await page.goto(BASE + '/map', { waitUntil: 'networkidle' }).catch(() => { }); await page.waitForTimeout(4500)
      // la fenêtre « Où êtes-vous ? » peut recouvrir : on la ferme si elle est là
      await page.getByRole('button', { name: 'Plus tard' }).tap({ timeout: 1500 }).catch(() => { })
      await page.locator('[data-use-position]:visible').tap(); await page.waitForTimeout(4000)
      const t = await page.locator('[data-my-position]').innerText().catch(() => '')
      await shot(page, `position-${name}`)
      check(`Utiliser ma position (${name}) : message honnête`, t.replace(/\n+/g, ' | ').slice(0, 260), re.test(t))
      await c.close()
    }
  }

  // ================= Carte du prestataire (/pro/carte) =================
  {
    const c = await ctx(browser); const page = await c.newPage()
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 120)))
    await login(page); await setMode(page, 'pro'); await blockWrites(page, { is_active: true, payments_suspended_at: null })
    const reqs = []; page.on('request', r => { if (/requests_nearby/.test(r.url())) reqs.push(Date.now()) })
    await page.goto(BASE + '/pro/carte', { waitUntil: 'networkidle' }).catch(() => { }); await page.waitForTimeout(5000)
    await shot(page, 'carte-pro')
    res.mesures.carteProScr1 = await mesure(page)
    if (apres) {
      const b = page.locator('[data-session-badge]')
      const bb = await b.first().boundingBox().catch(() => null)
      check('carte prestataire : pastille « Prestataire » en haut à droite', { txt: await b.first().innerText().catch(() => ''), bb }, (await b.count()) === 1 && /Prestataire/.test(await b.first().innerText()) && bb.y < 80 && bb.x + bb.width > 340)
      const sw = page.locator('[data-visibility-switch]')
      check('carte prestataire : interrupteur « Visible » + texte d’état', await sw.innerText().catch(() => ''), /Visible/.test(await sw.innerText()) && /Les clients vous voient/.test(await sw.innerText()))
      const sb2 = await sw.boundingBox(); check('interrupteur >= 44 px de haut, texte >= 15 px', { h: sb2 && sb2.height, font: await minFontOf(page, '[data-visibility-switch]') }, sb2.height >= 44 && (await minFontOf(page, '[data-visibility-switch]')) >= 15)
      // masquer : écriture réelle (interceptée) is_active=false, texte d'état
      res.writes.length = 0
      await sw.tap(); await page.waitForTimeout(1200)
      const w = res.writes.find(x => x.t === 'provider_profiles')
      check('Masquer : provider_profiles.is_active=false (écriture interceptée)', res.writes, !!w && /"is_active":false/.test(w.body))
      check('Masquer : « Masqué » / « Vous êtes masqué »', await page.locator('[data-visibility-switch]').innerText(), /Masqué/.test(await page.locator('[data-visibility-switch]').innerText()) && /Vous êtes masqué/.test(await page.locator('[data-visibility-switch]').innerText()))
      await shot(page, 'carte-pro-masque')
      // PING
      const before = reqs.length
      const t0 = await page.locator('.searchbar.map-search').first().innerText()
      await page.locator('.pingbtn').first().tap(); await page.waitForTimeout(1900)
      const t1 = await page.locator('.searchbar.map-search').first().innerText()
      await shot(page, 'ping-ligne-actualise-pro')
      check('PING prestataire : requests_nearby repart', { avant: before, apres: reqs.length }, reqs.length > before)
      check('PING prestataire : « N demandes autour de vous » puis texte normal', { avant: t0, pendant: t1 }, /\d+ demandes? autour de vous/.test(t1) && t1 !== t0)
      await page.waitForTimeout(3200)
      check('PING prestataire : la ligne disparaît après 3 s', await page.locator('.searchbar.map-search').first().innerText(), !/autour de vous/.test(await page.locator('.searchbar.map-search').first().innerText()))
      // pastille : explication prestataire
      await page.locator('[data-session-badge]').tap(); await page.waitForTimeout(500); await shot(page, 'pastille-explication-pro')
      check('pastille prestataire : explication', (await page.locator('[role=dialog][aria-label^="Vous êtes dans"]').innerText()).slice(0, 120), /Prestataire/.test(await page.locator('[role=dialog][aria-label^="Vous êtes dans"]').innerText()))
      await page.locator('[role=dialog][aria-label^="Vous êtes dans"]').getByRole('button', { name: 'Fermer' }).tap()
      // position (feuille mi-hauteur)
      await page.evaluate(() => localStorage.setItem('ping_sheet_pro-carte', 'half')); await page.reload({ waitUntil: 'networkidle' }).catch(() => { }); await page.waitForTimeout(4500)
      await page.locator('[data-use-position]:visible').tap(); await page.waitForTimeout(3500)
      await shot(page, 'carte-pro-feuille-position')
      check('carte prestataire : précision de la position affichée', await page.locator('[data-position-precision]:visible').innerText().catch(() => ''), /±30 m/.test(await page.locator('[data-position-precision]:visible').innerText().catch(() => '')))
    }
    check('aucune erreur de page (carte prestataire)', errs, errs.length === 0)
    await c.close()
  }
  // Garde-fous de la visibilité : compte suspendu ne peut pas se remettre en ligne
  if (apres) {
    const c = await ctx(browser); const page = await c.newPage()
    await login(page); await setMode(page, 'pro'); await blockWrites(page, { is_active: false, payments_suspended_at: '2026-11-01T00:00:00Z' })
    await page.goto(BASE + '/pro/carte', { waitUntil: 'networkidle' }).catch(() => { }); await page.waitForTimeout(5000)
    res.writes.length = 0
    await page.locator('[data-visibility-switch]').tap(); await page.waitForTimeout(1500)
    await shot(page, 'carte-pro-suspendu-message')
    check('compte suspendu : message clair, aucune écriture', { msg: await page.locator('[data-visibility-msg]').innerText().catch(() => ''), w: res.writes.length }, /suspendu/.test(await page.locator('[data-visibility-msg]').innerText().catch(() => '')) && res.writes.length === 0)
    await c.close()
  }

  // ================= Mon entreprise et Mon profil =================
  {
    const c = await ctx(browser); const page = await c.newPage()
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 120)))
    await login(page); await setMode(page, 'pro'); await blockWrites(page, { is_active: true, payments_suspended_at: null }); await mockNominatim(page)
    await page.goto(BASE + '/pro/dashboard', { waitUntil: 'networkidle' }).catch(() => { }); await page.waitForTimeout(5000)
    await shot(page, 'mon-entreprise'); await shot(page, 'mon-entreprise-page-entiere', true)
    res.mesures.monEntreprise = await mesure(page)
    if (apres) {
      check('Mon entreprise : pastille Prestataire', await page.locator('[data-session-badge]').innerText().catch(() => ''), /Prestataire/.test(await page.locator('[data-session-badge]').innerText().catch(() => '')))
      check('Mon entreprise : interrupteur Visible / Masqué en haut', await page.locator('[data-visibility-switch]').innerText().catch(() => ''), (await page.locator('[data-visibility-switch]').count()) === 1)
      const sw = page.locator('[data-visibility-switch]'); const y = (await sw.boundingBox()).y
      check('Mon entreprise : l’interrupteur est dans le premier écran', y, y < 200)
      res.writes.length = 0
      await sw.tap(); await page.waitForTimeout(1200)
      check('Mon entreprise : Masquer = écriture is_active=false interceptée', res.writes, res.writes.some(x => x.t === 'provider_profiles' && /"is_active":false/.test(x.body)))
      await shot(page, 'mon-entreprise-masque')
      check('Mon entreprise : « Adresse de référence : … » + Modifier', await page.locator('[data-adresse-reference]').innerText().catch(() => ''), (await page.locator('[data-adresse-reference]').count()) === 1)
      await page.locator('[data-adresse-reference]').scrollIntoViewIfNeeded()
      await shot(page, 'mon-entreprise-adresse')
      await page.locator('[data-adresse-modifier]').tap(); await page.waitForTimeout(400)
      await page.locator('#addr-ref-q').fill('2 rue de l Audit Grasse'); await page.waitForTimeout(1800)
      await page.locator('[data-adresse-propositions] li').nth(0).locator('button').tap(); await page.waitForTimeout(2500)
      await shot(page, 'mon-entreprise-adresse-apercu')
      res.writes.length = 0
      await page.locator('[data-adresse-utiliser]').tap(); await page.waitForTimeout(1500)
      const wp = res.writes.find(x => x.t === 'provider_profiles'), wa = res.writes.find(x => x.t === 'profiles')
      check('Mon entreprise : adresse = provider_profiles.lat/lng + profiles.address (interceptés)', res.writes, !!wp && /"lat":43\.6612/.test(wp.body) && /"lng":6\.9301/.test(wp.body) && !!wa)
    }
    check('aucune erreur de page (Mon entreprise)', errs, errs.length === 0)
    await c.close()
  }
  {
    const c = await ctx(browser); const page = await c.newPage()
    await login(page); await setMode(page, 'particulier'); await blockWrites(page); await mockNominatim(page)
    await page.goto(BASE + '/client/profil', { waitUntil: 'networkidle' }).catch(() => { }); await page.waitForTimeout(4500)
    await shot(page, 'mon-profil'); await shot(page, 'mon-profil-page-entiere', true)
    res.mesures.monProfil = await mesure(page)
    if (apres) {
      check('Mon profil : pastille Particulier', await page.locator('[data-session-badge]').innerText().catch(() => ''), /Particulier/.test(await page.locator('[data-session-badge]').innerText().catch(() => '')))
      check('Mon profil : « Adresse de référence : … » + Modifier', await page.locator('[data-adresse-reference]').innerText().catch(() => ''), (await page.locator('[data-adresse-reference]').count()) === 1)
    }
    await c.close()
  }
} finally {
  await browser.close()
  fs.writeFileSync(`${OUT}mesures-${PHASE}.json`, JSON.stringify(res, null, 1))
  console.log(res.checks.filter(x => !x.ok).length, 'KO /', res.checks.length)
}
