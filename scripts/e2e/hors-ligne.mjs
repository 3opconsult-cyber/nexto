// Essais « GPS et hors connexion » (audit du 23/11/2026, corrections 3, 4, 5 et conservation de la preuve).
// Rejouable contre la prod (BASE par défaut) ou un serveur local (BASE=http://localhost:3100 après `npm run build && npm start`).
// Comptes audit `.invalid` uniquement (mot de passe : voir docs/claude/HISTORIQUE.md, passé par PWD_AUDIT, jamais écrit ici).
// Lancer depuis un dossier qui a playwright + @supabase/supabase-js dans node_modules :
//   PWD_AUDIT=… BASE=http://localhost:3100 TESTS=coupure,distance,permission,retour,chat,brouillon,zone node hors-ligne.mjs
// Écrit en base (comptes audit) : une mission « QA hors-ligne … » par passage, des messages « QA hors-ligne 23-11 … ».
// Les tests `coupure`, `distance`, `retour` partagent une mission en route (client absent) créée au début.
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const BASE = process.env.BASE || 'https://nexto-eta.vercel.app'
const SB = ['https://wmiawwaxwlvascyflpba.supabase.co', 'sb_publishable_ehRFsNEJD1hnkOyi7vdfEA_NJey8yfP']
const CLIENT = 'audit.client.claude@ping-demo.invalid', PRO = 'audit.pro.claude@ping-demo.invalid'
const PWD = process.env.PWD_AUDIT
if (!PWD) { console.error('PWD_AUDIT manquant (mot de passe des comptes audit)'); process.exit(2) }
const PID = 'b9f8cd9a-16de-4a36-afd8-10a2135ab970'
const FALLBACK_POS = { lat: 43.6589, lng: 6.9237 }
const TESTS = (process.env.TESTS || 'coupure,distance,permission,retour,chat,brouillon,zone').split(',')
const OUT = process.env.OUT || 'shots-hl'
fs.mkdirSync(OUT, { recursive: true })

let fails = 0
const log = (k, v, ok) => { if (ok === false) fails++; console.log(ok === undefined ? '##' : ok ? 'OK' : 'KO', k, typeof v === 'string' ? v : JSON.stringify(v)) }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const text = async page => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ')
const shot = (page, n) => page.screenshot({ path: `${OUT}/${n}.jpg`, quality: 55, type: 'jpeg' }).catch(() => { })
const btn = (page, re) => page.getByRole('button', { name: re })
async function waitText(page, re, timeout = 20000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) { if (re.test(await text(page))) return true; await sleep(700) }
  return false
}
async function newCtx(browser) {
  return browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
}
async function login(page, email) {
  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle' })
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(PWD)
  await page.locator('button[type=submit], button:has-text("connecter")').first().click()
  await page.waitForTimeout(3500)
}
async function go(page, path, wait = 2500) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => { })
  await page.waitForTimeout(wait)
}
async function signed(email) {
  const sb = createClient(SB[0], SB[1])
  const { data, error } = await sb.auth.signInWithPassword({ email, password: PWD })
  if (error) throw new Error('connexion ' + email + ' : ' + error.message)
  return { sb, uid: data.user.id }
}
// Photo de test lourde (3000 x 2000, bruit) : permet de vérifier la compression (≤ 1600 px, JPEG 0,8).
async function bigPhoto(page) {
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 3000; c.height = 2000
    const x = c.getContext('2d')
    for (let i = 0; i < 4000; i++) { x.fillStyle = `hsl(${(i * 37) % 360},70%,${30 + (i % 40)}%)`; x.fillRect((i * 97) % 3000, (i * 53) % 2000, 40 + (i % 90), 30 + (i % 70)) }
    return c.toDataURL('image/jpeg', 0.95).split(',')[1]
  })
  return Buffer.from(b64, 'base64')
}
const idb = page => page.evaluate(() => new Promise(res => {
  const r = indexedDB.open('ping_proofs')
  r.onerror = () => res(null)
  r.onsuccess = () => {
    const db = r.result
    if (!db.objectStoreNames.contains('proofs')) { db.close(); return res([]) }
    const q = db.transaction('proofs').objectStore('proofs').getAll()
    q.onsuccess = () => { db.close(); res(q.result.map(e => ({ txId: e.txId, size: e.photo.size, type: e.photo.type, queued: !!e.queued, savedAt: e.savedAt, takenAt: e.takenAt, uploadedPath: e.uploadedPath || null }))) }
  }
}))
// Repart d'un téléphone sans preuve gardée (les essais s'enchaînent dans le même navigateur).
const clearIdb = page => page.evaluate(() => new Promise(res => { const r = indexedDB.deleteDatabase('ping_proofs'); r.onsuccess = r.onerror = r.onblocked = () => res(true) }))
const countFiles = async (sb, uid, tx) => {
  const { data, error } = await sb.storage.from('presence-photos').list(`${uid}/${tx}`)
  return error ? -1 : (data || []).length
}

// ------------------------------------------------------------------------------------------------------------
// Mission « client absent » prête à l'arrivée : contact, devis, accord, RDV, « Je ne serai pas sur place », « Je pars ».
async function setup(browser) {
  const { sb: sbC } = await signed(CLIENT)
  const cctx = await newCtx(browser), pctx = await newCtx(browser)
  const cp = await cctx.newPage(), pp = await pctx.newPage()
  for (const p of [cp, pp]) p.on('dialog', d => d.accept().catch(() => { }))
  await login(cp, CLIENT); await login(pp, PRO)
  await cp.evaluate(() => localStorage.setItem('ping_mode', 'particulier'))
  await pp.evaluate(() => localStorage.setItem('ping_mode', 'pro'))
  if (process.env.TX) {
    // Mission déjà en route (entre les comptes audit) : le client annonce « Je ne serai pas sur place » (comme à l'écran).
    const tx = process.env.TX
    const r = await sbC.rpc('set_client_presence', { p_transaction: tx, p_presence: 'absent' })
    const { data: t } = await sbC.from('transactions').select('en_route_at, arrived_at, requests(lat, lng)').eq('id', tx).single()
    log('mise en place : mission existante, client absent, prestataire en route', { tx, presence: r.data?.presence ?? r.error?.message, en_route: !!t?.en_route_at, arrive: !!t?.arrived_at }, !!t?.en_route_at && !t?.arrived_at)
    return { tx, cctx, pctx, cp, pp, target: { lat: Number(t.requests.lat), lng: Number(t.requests.lng) }, sbC }
  }
  await go(cp, `/pro/${PID}`, 2000)
  await cp.locator('button:has-text("Contacter")').first().dispatchEvent('click')
  await cp.waitForURL(/\/mission\/.*\/chat/, { timeout: 20000 })
  const tx = cp.url().match(/mission\/([0-9a-f-]{36})\/chat/)[1]
  const { data: t0 } = await sbC.from('transactions').select('request_id, requests(title)').eq('id', tx).single()
  // Titre « QA » reconnaissable (sans renommer une demande déjà titrée QA : « Contacter » reprend la conversation de devis en cours).
  if (!/^QA/.test(t0.requests?.title || '')) await sbC.from('requests').update({ title: `QA hors-ligne 23-11 ${new Date().toISOString().slice(0, 16).replace('T', ' ')}` }).eq('id', t0.request_id)
  // Le prestataire ne voit la conversation qu'après un premier message du client.
  const hello = btn(cp, /Envoyer le message/)
  await hello.locator('xpath=preceding-sibling::input').fill('Bonjour, QA hors-ligne 23-11')
  await hello.dispatchEvent('click'); await cp.waitForTimeout(2000)
  await go(pp, `/mission/${tx}/chat`)
  const propose = pp.locator('button:has-text("Proposer un tarif")').first()
  await propose.waitFor({ timeout: 15000 }).catch(async e => { console.log('## DEBUG mission', tx, (await text(pp)).slice(0, 600)); throw e })
  await propose.click(); await pp.waitForTimeout(800)
  const nums = pp.locator('input[type=number]')
  await nums.nth(0).fill('90'); await nums.nth(1).fill('3'); await nums.nth(2).fill('25')
  await pp.locator('button:has-text("Envoyer la proposition")').click(); await pp.waitForTimeout(2500)
  await cp.reload({ waitUntil: 'networkidle' }); await cp.waitForTimeout(2500)
  const acc = cp.locator('button:has-text("Accepter")').last()
  await acc.waitFor({ timeout: 15000 }); await acc.click(); await cp.waitForTimeout(3000)
  await cp.locator('text=Fixez le rendez-vous').waitFor({ timeout: 15000 })
  const street = cp.locator('input[autocomplete="street-address"]')
  if (await street.count()) await street.first().fill('2 rue de l Audit, Grasse')
  const times = () => cp.locator('button:not([disabled])').filter({ hasText: /^\s*\d{1,2} h \d{2}\s*$/ })
  if (!(await times().count())) await cp.locator('button[type=button]').filter({ hasText: /^(lun|mar|mer|jeu|ven|sam|dim)/i }).first().click()
  await times().first().click()
  await cp.locator('button:has-text("Confirmer le rendez-vous")').click(); await cp.waitForTimeout(4000)
  await sbC.from('transactions').update({ scheduled_at: new Date(Date.now() + 5 * 60000).toISOString() }).eq('id', tx)
  const { data: tR } = await sbC.from('transactions').select('requests(lat, lng)').eq('id', tx).single()
  let target = tR?.requests?.lat != null ? { lat: Number(tR.requests.lat), lng: Number(tR.requests.lng) } : null
  if (!target) { target = FALLBACK_POS; await sbC.from('requests').update({ lat: target.lat, lng: target.lng }).eq('id', t0.request_id) }
  await go(cp, `/mission/${tx}/commande`)
  await btn(cp, /Je ne serai pas sur place/).first().click(); await cp.waitForTimeout(2500)
  await go(pp, `/mission/${tx}/jour`)
  await btn(pp, /^Je pars$/).click(); await pp.waitForTimeout(600)
  await btn(pp, /^10 min$/).click()
  await btn(pp, /Prévenir le client/).click(); await pp.waitForTimeout(3500)
  const { data: tE } = await sbC.from('transactions').select('en_route_at').eq('id', tx).single()
  log('mise en place : mission client absent, prestataire en route', { tx, en_route: !!tE?.en_route_at }, !!tE?.en_route_at)
  return { tx, cctx, pctx, cp, pp, target, sbC }
}

const near = t => ({ latitude: t.lat + 0.0006, longitude: t.lng + 0.0004, accuracy: 15 })

async function prepareProof(S, photoBuf) {
  const { pp, pctx } = S
  await pctx.grantPermissions(['geolocation'], { origin: BASE })
  await pctx.setGeolocation(near(S.target))
  await clearIdb(pp)
  await go(pp, `/mission/${S.tx}/jour`, 3000)
  await btn(pp, /partager ma position|Réessayer/).click()
  const okPos = await waitText(pp, /(Position relevée|Position approximative) \(précision/, 20000)
  log('position relevée, précision affichée', ((await text(pp)).match(/(Position relevée|Position approximative) \(précision[^)]*\)/) || [''])[0], okPos)
  await pp.locator('input[type=file][capture]').setInputFiles({ name: 'arrivee.jpg', mimeType: 'image/jpeg', buffer: photoBuf })
  await pp.waitForTimeout(1200)
}

async function main() {
  const browser = await chromium.launch()
  const needMission = TESTS.some(t => ['coupure', 'distance', 'permission', 'retour', 'chat'].includes(t))
  const S = needMission ? await setup(browser) : null
  let proPair = null
  if (S) proPair = await signed(PRO)

  if (S && TESTS.includes('coupure')) {
    console.log('## --- coupure réseau 20 s, photo et position en cours ---')
    const photo = await bigPhoto(S.pp)
    await prepareProof(S, photo)
    const before = await text(S.pp)
    log('avant coupure : aperçu de la photo', await S.pp.locator('img[alt*="photo d’arrivée"]').count(), (await S.pp.locator('img[alt*="photo d’arrivée"]').count()) > 0)
    await S.pctx.setOffline(true)
    await sleep(20000)
    let t = await text(S.pp)
    log('coupure 20 s : « Mission introuvable » absent', t.includes('Mission introuvable') ? 'PRÉSENT' : 'absent', !t.includes('Mission introuvable'))
    log('coupure 20 s : photo toujours à l’écran', await S.pp.locator('img[alt*="photo d’arrivée"]').count(), (await S.pp.locator('img[alt*="photo d’arrivée"]').count()) > 0)
    log('coupure 20 s : position toujours à l’écran', /(Position relevée|Position approximative) \(précision/.test(t), /(Position relevée|Position approximative) \(précision/.test(t))
    log('coupure 20 s : bannière « Pas de connexion, nouvelle tentative »', (await S.pp.locator('[data-ping-offline]').innerText().catch(() => 'absente')).replace(/\s+/g, ' ').slice(0, 120), await S.pp.locator('[data-ping-offline]').count() > 0)
    log('coupure : aucun texte anglais brut', /Failed to fetch|TypeError|NetworkError|Load failed/.test(t) ? 'PRÉSENT' : 'aucun', !/Failed to fetch|TypeError|NetworkError|Load failed/.test(t))
    await shot(S.pp, 'coupure-hors-ligne')
    await S.pctx.setOffline(false)
    const gone = await S.pp.locator('[data-ping-offline]').waitFor({ state: 'detached', timeout: 20000 }).then(() => true).catch(() => false)
    log('retour du réseau : bannière disparue', gone, gone)
    t = await text(S.pp)
    log('retour du réseau : page intacte, bouton d’envoi présent', await btn(S.pp, /Envoyer la photo à/).count(), (await btn(S.pp, /Envoyer la photo à/).count()) > 0 && !t.includes('Mission introuvable'))
    await shot(S.pp, 'coupure-retour')
  }

  if (S && TESTS.includes('distance')) {
    console.log('## --- photo refusée pour distance : aucun fichier au stockage ---')
    const { sb, uid } = proPair
    const n0 = await countFiles(sb, uid, S.tx)
    await S.pctx.grantPermissions(['geolocation'], { origin: BASE })
    await S.pctx.setGeolocation({ latitude: 43.7102, longitude: 7.262, accuracy: 15 }) // Nice
    await clearIdb(S.pp)
    await go(S.pp, `/mission/${S.tx}/jour`, 3000)
    await btn(S.pp, /partager ma position|Réessayer/).click()
    await waitText(S.pp, /Position relevée|Position approximative/, 20000)
    await S.pp.locator('input[type=file][capture]').setInputFiles({ name: 'arrivee.jpg', mimeType: 'image/jpeg', buffer: await bigPhoto(S.pp) })
    await S.pp.waitForTimeout(1200)
    if (!(await btn(S.pp, /Envoyer la photo à/).count())) console.log('## DEBUG écran sans bouton d’envoi :', (await text(S.pp)).slice(0, 700))
    await btn(S.pp, /Envoyer la photo à/).click()
    const refused = await waitText(S.pp, /éloignée/, 20000)
    const n1 = await countFiles(sb, uid, S.tx)
    log('Nice : refus « position éloignée » affiché', ((await text(S.pp)).match(/Votre position semble éloignée[^.]*\./) || [''])[0], refused)
    log('Nice : fichiers au stockage avant / après le refus', { avant: n0, apres: n1 }, n0 >= 0 && n0 === n1)
    log('Nice : aucune preuve gardée sur le téléphone après refus', await idb(S.pp), ((await idb(S.pp)) || []).length === 0)
    await shot(S.pp, 'distance-refus')
  }

  if (S && TESTS.includes('permission')) {
    console.log('## --- permission refusée, repli basse précision, position indisponible, bouton Réessayer ---')
    const mk = async init => {
      const ctx = await newCtx(browser); const page = await ctx.newPage()
      if (init) await page.addInitScript(init, near(S.target))
      await login(page, PRO)
      await page.evaluate(() => localStorage.setItem('ping_mode', 'pro'))
      await clearIdb(page)
      await go(page, `/mission/${S.tx}/jour`, 3000)
      return { ctx, page }
    }
    // 1. Aucune permission : refus, aide iPhone / Android, bouton Réessayer, puis succès après autorisation.
    const a = await mk(null)
    await btn(a.page, /partager ma position/).click()
    await waitText(a.page, /refusée pour PING/, 15000)
    let t = await text(a.page)
    log('refus : cause « refusée » + où réactiver (iPhone, Android)', { refusee: /La localisation est refusée pour PING/.test(t), iphone: /iPhone/.test(t), android: /Android/.test(t) }, /La localisation est refusée pour PING/.test(t) && /iPhone/.test(t) && /Android/.test(t))
    log('refus : bouton « Réessayer » visible', await btn(a.page, /^Réessayer$/).count(), (await btn(a.page, /^Réessayer$/).count()) > 0)
    await shot(a.page, 'permission-refus')
    await a.ctx.grantPermissions(['geolocation'], { origin: BASE }); await a.ctx.setGeolocation(near(S.target))
    await btn(a.page, /^Réessayer$/).click()
    const okRetry = await waitText(a.page, /Position relevée \(précision/, 15000)
    log('refus puis autorisation : « Réessayer » relève la position', okRetry, okRetry)
    await a.ctx.close()
    // 2. Haute précision en délai dépassé, repli basse précision : position approximative affichée.
    const initFallback = pos => {
      window.__geoCalls = []
      navigator.geolocation.getCurrentPosition = (ok, err, o) => {
        window.__geoCalls.push({ high: !!(o && o.enableHighAccuracy), maximumAge: o && o.maximumAge, timeout: o && o.timeout })
        if (o && o.enableHighAccuracy) setTimeout(() => err({ code: 3, message: 'timeout' }), 30)
        else setTimeout(() => ok({ coords: { latitude: pos.latitude, longitude: pos.longitude, accuracy: 800 }, timestamp: Date.now() }), 30)
      }
    }
    const b = await mk(initFallback)
    await btn(b.page, /partager ma position/).click()
    const okFb = await waitText(b.page, /Position approximative \(précision ± 800 m\)/, 15000)
    const calls = await b.page.evaluate(() => window.__geoCalls)
    log('repli : haute précision (délai) puis basse précision avec cache court, « Position approximative »', calls, okFb && calls.length === 2 && calls[0].high === true && calls[1].high === false && calls[1].maximumAge === 30000)
    await shot(b.page, 'permission-repli')
    await b.ctx.close()
    // 3. Position indisponible (code 2) aux deux essais : message distinct du refus et du délai.
    const initUnavail = () => { navigator.geolocation.getCurrentPosition = (ok, err) => setTimeout(() => err({ code: 2, message: 'unavailable' }), 30) }
    const c = await mk(initUnavail)
    await btn(c.page, /partager ma position/).click()
    await waitText(c.page, /n’arrive pas à déterminer/, 15000)
    t = await text(c.page)
    log('position indisponible : message propre, ni « refusée » ni « délai »', (t.match(/Votre téléphone n’arrive pas à déterminer[^.]*\./) || [''])[0], /n’arrive pas à déterminer sa position/.test(t) && !/refusée pour PING/.test(t))
    // 4. Délai dépassé aux deux essais (code 3).
    const initTimeout = () => { navigator.geolocation.getCurrentPosition = (ok, err) => setTimeout(() => err({ code: 3, message: 'timeout' }), 30) }
    await c.ctx.close()
    const d = await mk(initTimeout)
    await btn(d.page, /partager ma position/).click()
    await waitText(d.page, /pas été trouvée à temps/, 15000)
    t = await text(d.page)
    log('délai dépassé : message propre', (t.match(/La position n’a pas été trouvée à temps[^.]*\./) || [''])[0], /pas été trouvée à temps/.test(t))
    await d.ctx.close()
  }

  if (S && TESTS.includes('retour')) {
    console.log('## --- hors ligne puis retour : preuve gardée puis renvoyée ---')
    const { sb, uid } = proPair
    const photo = await bigPhoto(S.pp)
    await prepareProof(S, photo)
    await S.pp.waitForTimeout(1500)
    let e = await idb(S.pp)
    log('preuve gardée sur le téléphone (1 entrée, compressée)', e?.map(x => ({ size: x.size, original: photo.length, type: x.type })), e?.length === 1 && e[0].size < photo.length * 0.8 && e[0].type === 'image/jpeg')
    // Rechargement : la preuve est reprise.
    await go(S.pp, `/mission/${S.tx}/jour`, 3000)
    const t1 = await text(S.pp)
    log('après rechargement : preuve reprise (photo + position + message)', /Votre preuve est gardée sur ce téléphone/.test(t1), /Votre preuve est gardée sur ce téléphone/.test(t1) && (await S.pp.locator('img[alt*="photo d’arrivée"]').count()) > 0)
    const n0 = await countFiles(sb, uid, S.tx)
    await S.pctx.setOffline(true)
    await S.pp.waitForTimeout(800)
    if (!(await btn(S.pp, /Envoyer la photo à/).count())) console.log('## DEBUG écran sans bouton d’envoi :', (await text(S.pp)).slice(0, 900))
    await btn(S.pp, /Envoyer la photo à/).click()
    const kept = await waitText(S.pp, /votre preuve est gardée/i, 15000)
    log('envoi sans réseau : « Pas de connexion, votre preuve est gardée »', ((await text(S.pp)).match(/Pas de connexion, votre preuve est gardée[^.]*\./) || [''])[0], kept)
    e = await idb(S.pp)
    log('envoi sans réseau : entrée en attente d’envoi', e?.map(x => ({ queued: x.queued })), e?.length === 1 && e[0].queued === true)
    await shot(S.pp, 'retour-hors-ligne')
    const n1 = await countFiles(sb, uid, S.tx)
    log('envoi sans réseau : rien au stockage', { avant: n0, apres: n1 }, n0 === n1)
    await S.pctx.setOffline(false)
    const arrived = await (async () => {
      const t0 = Date.now()
      while (Date.now() - t0 < 60000) {
        const { data } = await sb.rpc('presence_state', { p_transaction: S.tx })
        if (data?.remote?.arrivee?.etat === 'en_attente') return data.remote.arrivee
        await sleep(2000)
      }
      return null
    })()
    log('retour du réseau : preuve renvoyée seule (demande d’arrivée en attente côté serveur)', arrived ? { etat: arrived.etat, requested_at: arrived.requested_at } : 'non renvoyée', !!arrived)
    await S.pp.waitForTimeout(3000)
    const n2 = await countFiles(sb, uid, S.tx)
    log('retour du réseau : 1 seule photo ajoutée au stockage', { avant: n1, apres: n2 }, n2 === n1 + 1)
    e = await idb(S.pp)
    log('retour du réseau : copie du téléphone purgée', e, (e || []).length === 0)
    await S.pp.waitForTimeout(4000)
    const t2 = await text(S.pp)
    log('écran du pro : « Envoyée à » (heure du serveur), pas « Photo prise à »', { envoyee: /Envoyée à \d\d:\d\d/.test(t2), prise: /Photo prise à/.test(t2) }, /Envoyée à \d\d:\d\d/.test(t2) && !/Photo prise à/.test(t2))
    await shot(S.pp, 'retour-envoye')
    // Le client voit la demande, avec l'heure du serveur.
    const { data: msg } = await S.sbC.from('messages').select('body, created_at').eq('transaction_id', S.tx).not('photo_path', 'is', null)
    log('un seul message avec photo côté client', msg?.map(m => m.body.slice(0, 90)), msg?.length === 1)
  }

  if (S && TESTS.includes('chat')) {
    console.log('## --- double envoi du chat (réponse perdue après traitement) ---')
    const cp = S.cp
    await go(cp, `/mission/${S.tx}/chat`, 3000)
    const body = `QA hors-ligne 23-11 doublon ${Date.now().toString(36)}`
    let dropped = false
    await cp.route('**/rest/v1/messages*', async route => {
      if (route.request().method() === 'POST' && !dropped) {
        dropped = true
        await route.fetch() // le serveur reçoit et enregistre…
        await route.abort('failed') // …mais la réponse est perdue
      } else await route.continue()
    })
    const input = btn(cp, /Envoyer le message/).locator('xpath=preceding-sibling::input')
    await input.fill(body)
    await btn(cp, /Envoyer le message/).dispatchEvent('click')
    await cp.waitForTimeout(2500)
    const t1 = await text(cp)
    log('réponse perdue : message d’erreur clair (pas d’anglais), texte gardé', { avertissement: (t1.match(/Message non envoyé[^.]*\./) || [''])[0], champ: await input.inputValue() }, /Message non envoyé/.test(t1) && (await input.inputValue()) === body && !/Failed to fetch/.test(t1))
    await btn(cp, /Envoyer le message/).dispatchEvent('click')
    await cp.waitForTimeout(3500)
    const { data: rows } = await S.sbC.from('messages').select('id, body').eq('transaction_id', S.tx).eq('body', body)
    log('renvoi : un seul message en base', rows?.length, rows?.length === 1)
    log('renvoi : champ vidé après succès', await input.inputValue(), (await input.inputValue()) === '')
    await shot(cp, 'chat-doublon')
  }

  if (TESTS.includes('brouillon')) {
    console.log('## --- brouillon d’annonce après rechargement ---')
    const ctx = await newCtx(browser); const page = await ctx.newPage()
    await login(page, CLIENT)
    await go(page, '/client/demandes/new', 3000)
    const title = `QA brouillon 23-11 ${Date.now() % 100000}`
    await page.locator('label:has-text("Titre de l’annonce") input').fill(title)
    await page.locator('textarea').first().fill('QA brouillon : description de test')
    await page.waitForTimeout(1200)
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(3000)
    const v = await page.locator('label:has-text("Titre de l’annonce") input').inputValue()
    const d = await page.locator('textarea').first().inputValue()
    log('rechargement : titre et description conservés', { titre: v, description: d }, v === title && d.startsWith('QA brouillon'))
    log('rechargement : note « brouillon repris »', await page.locator('[data-draft-note]').count(), (await page.locator('[data-draft-note]').count()) > 0)
    await shot(page, 'brouillon')
    // Nettoyage : « Repartir de zéro » efface le brouillon.
    if (await page.locator('[data-draft-note] button').count()) { await page.locator('[data-draft-note] button').click(); await page.waitForTimeout(3000) }
    const v2 = await page.locator('label:has-text("Titre de l’annonce") input').inputValue()
    log('« Repartir de zéro » : formulaire vide', v2, v2 === '')
    await ctx.close()
  }

  if (TESTS.includes('zone')) {
    console.log('## --- zone « en intervention ici » : arrêt hors ligne rejoué ---')
    const { sb, uid } = await signed(PRO)
    const ctx = await newCtx(browser); const page = await ctx.newPage()
    await login(page, PRO)
    await page.evaluate(() => localStorage.setItem('ping_mode', 'pro'))
    await ctx.grantPermissions(['geolocation'], { origin: BASE })
    await ctx.setGeolocation({ latitude: 43.6589, longitude: 6.9237, accuracy: 20 })
    await go(page, '/pro/dashboard', 3500)
    const sw = page.getByRole('switch', { name: /en intervention ici/ })
    if (!(await sw.count())) { log('zone : interrupteur présent (migration 058)', 'absent', false) } else {
      const had = (await sb.from('provider_private').select('live_zone_consent_at').eq('id', uid).maybeSingle()).data?.live_zone_consent_at
      await sw.click(); await page.waitForTimeout(1200)
      if (await page.getByRole('dialog').count()) { await page.getByRole('dialog').getByRole('button', { name: /J’accepte/ }).click() }
      await page.waitForTimeout(5000)
      const on = (await sw.getAttribute('aria-checked')) === 'true'
      log('zone : activée', on, on)
      await ctx.setOffline(true)
      await page.waitForTimeout(500)
      await sw.click(); await page.waitForTimeout(2500)
      const t = await text(page)
      log('arrêt hors ligne : « Arrêt en attente » (pas d’anglais)', (t.match(/Arrêt en attente[^.]*\./) || [''])[0], /Arrêt en attente/.test(t) && !/Failed to fetch|TypeError/.test(t))
      const { data: z0 } = await sb.from('provider_live_zone').select('ended_at, expires_at').eq('provider_id', uid).maybeSingle()
      log('arrêt hors ligne : la base n’est pas encore arrêtée', z0, !!z0 && !z0.ended_at)
      await page.screenshot({ path: `${OUT}/zone-attente.jpg`, quality: 55, type: 'jpeg' }).catch(() => { })
      await ctx.setOffline(false)
      let stopped = false
      for (let i = 0; i < 25 && !stopped; i++) {
        await sleep(2000)
        const { data: z } = await sb.from('provider_live_zone').select('ended_at').eq('provider_id', uid).maybeSingle()
        stopped = !z || !!z.ended_at
      }
      log('retour du réseau : arrêt rejoué seul (zone arrêtée en base)', stopped, stopped)
      // Remise à l'état initial du consentement.
      if (!had) { await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(3000); const w = page.getByRole('button', { name: /Retirer mon consentement/ }); if (await w.count()) await w.click(); await page.waitForTimeout(2000) }
    }
    await ctx.close()
  }

  await browser.close()
  console.log(fails ? `## ${fails} ÉCHEC(S)` : '## TOUT OK')
  process.exit(fails ? 1 : 0)
}
main().catch(e => { console.error('ERREUR', e); process.exit(1) })
