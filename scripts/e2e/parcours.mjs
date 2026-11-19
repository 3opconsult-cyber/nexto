// Parcours complet sur la PROD (https://nexto-eta.vercel.app), deux scénarios de bout en bout, comptes audit :
//   A. client sur place : Contacter → devis → accord → RDV (adresse du profil confirmée d'office) → « Commande
//      validée » → « Je serai sur place » → Mission du jour → Je pars → QR d'arrivée (code lu chez le client,
//      saisi dans le scanner du pro) → QR de fin (jeton get_mission_proof, écran /scan/complete) → 3 factures →
//      mention du mode de validation → virement annoncé → avis.
//   B. client absent : même début, « Je ne serai pas sur place » sur /mission/[id]/commande → Je pars → position
//      (géolocalisation Playwright, près de l'adresse) → photo (setInputFiles) → envoi dans la messagerie →
//      confirmation du client → fin : code de fin demandé par le pro, envoyé par le client, saisi par le pro →
//      3 factures, mention, virement, avis.
// Lancer depuis un dossier qui a playwright + @supabase/supabase-js dans node_modules :
//   NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node parcours.mjs            (les deux scénarios)
//   SCEN=A node parcours.mjs   |   SCEN=B node parcours.mjs   |   TOUR=1 (ajoute le tour des pages)
// Écrit en base (comptes audit uniquement) : une mission par scénario, demande titrée « QA parcours … ».
// Le rendez-vous est ramené à maintenant (le client peut modifier scheduled_at) : l'arrivée n'est acceptée
// que le jour du rendez-vous et le sélecteur n'offre que des heures à +30 min.
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const BASE = process.env.BASE || 'https://nexto-eta.vercel.app'
const SB = ['https://wmiawwaxwlvascyflpba.supabase.co', 'sb_publishable_ehRFsNEJD1hnkOyi7vdfEA_NJey8yfP']
const CLIENT = 'audit.client.claude@ping-demo.invalid', PRO = 'audit.pro.claude@ping-demo.invalid', PWD = 'AuditPing2026!'
const PID = 'b9f8cd9a-16de-4a36-afd8-10a2135ab970' // audit.pro
const OLD_QA = ['e7f32fae-7688-4b66-83ea-badc400bf7cf'] // essai précédent, annulé s'il est encore ouvert
// Offre jouée : forfait 90 € / 3 h incluses / 25 €/h au-delà. Durée réelle de quelques minutes : 90 € (forfait).
const OFFER = { eur: 90, hours: 3, hourly: 25 }
// Repli si l'adresse du profil n'est pas géocodée (« 2 rue de l Audit, Grasse ») : centre de Grasse.
const FALLBACK_POS = { lat: 43.6589, lng: 6.9237 }

fs.mkdirSync('shots', { recursive: true })
const report = { started: new Date().toISOString(), scenarios: {}, pages: [] }
let cur = null
const log = (k, v, ok) => {
  const line = { k, v, ok: ok === undefined ? null : !!ok }
  if (cur) cur.steps.push(line)
  console.log(ok === undefined ? '##' : ok ? 'OK' : 'KO', k, typeof v === 'string' ? v : JSON.stringify(v))
  return ok
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const eur = c => (c / 100).toFixed(2).replace('.', ',') + ' €'
const shot = (page, name) => page.screenshot({ path: `shots/${name}.jpg`, quality: 55, type: 'jpeg' }).catch(() => { })
const text = async page => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ')

async function newCtx(browser, extra = {}) {
  return browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris', ...extra })
}
function watch(page, tag, sink) {
  page.on('pageerror', e => sink.push(`[${tag}] pageerror: ${e.message.slice(0, 200)}`))
  page.on('console', m => { if (m.type() === 'error') sink.push(`[${tag}] console: ${m.text().slice(0, 200)} @ ${page.url().replace(BASE, '')}`) })
  page.on('response', r => {
    if (r.status() >= 400 && /supabase|nexto-eta/.test(r.url())) sink.push(`[${tag}] ${r.status()} ${r.request().method()} ${r.url().replace(BASE, '').replace(SB[0], '').slice(0, 150)}`)
  })
  // Pas de confirm() bloquant (Annuler, Contester…) : accepté.
  page.on('dialog', d => d.accept().catch(() => { }))
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
// Attend qu'un texte (regex) apparaisse, en rechargeant au besoin (les écrans sondent toutes les 4-5 s).
async function waitText(page, re, { timeout = 20000, reload = false } = {}) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (re.test(await text(page))) return true
    await page.waitForTimeout(1500)
    if (reload && Date.now() - t0 > 6000) await page.reload({ waitUntil: 'networkidle' }).catch(() => { })
  }
  return false
}
const btn = (page, re) => page.getByRole('button', { name: re })

async function tour(browser) {
  const sink = []
  for (const [email, mode, paths] of [
    [CLIENT, 'particulier', ['/map', `/pro/${PID}`, '/client/profil', '/client/demandes', '/messages', '/agenda', '/documents', '/litiges']],
    [PRO, 'pro', ['/pro/carte', '/pro/dashboard', '/pro/tarifs', '/pro/revenus', '/pro/disponibilites', '/pro/documents', '/pro/paiements', '/messages', '/agenda', '/documents']],
  ]) {
    const ctx = await newCtx(browser); const page = await ctx.newPage(); watch(page, mode, sink)
    await login(page, email)
    await page.evaluate(m => localStorage.setItem('ping_mode', m), mode)
    for (const p of paths) {
      sink.length = 0
      await go(page, p)
      const raw = []
      const body = await text(page)
      for (const w of ['undefined', 'NaN', 'null €', '[object Object]', 'Invalid Date']) if (body.includes(w)) raw.push(w)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
      report.pages.push({ mode, path: p, errs: [...sink].slice(0, 6), raw, overflow })
      console.log('PAGE', mode, p, JSON.stringify({ errs: sink.slice(0, 3), raw, overflow }))
    }
    await ctx.close()
  }
}

// ------------------------------------------------------------------------------------------------------------
async function scenario(browser, sbC, label, absent) {
  cur = report.scenarios[label] = { steps: [], errors: [] }
  const errs = cur.errors
  const tag = label.toLowerCase()
  const cctx = await newCtx(browser)
  const pctx = await newCtx(browser)
  const cp = await cctx.newPage(); watch(cp, 'client', errs)
  const pp = await pctx.newPage(); watch(pp, 'pro', errs)
  await login(cp, CLIENT); await login(pp, PRO)
  await cp.evaluate(() => localStorage.setItem('ping_mode', 'particulier'))
  await pp.evaluate(() => localStorage.setItem('ping_mode', 'pro'))

  // 1. Contacter depuis la fiche du prestataire
  await go(cp, `/pro/${PID}`, 2000)
  await cp.locator('button:has-text("Contacter")').first().click()
  await cp.waitForURL(/\/mission\/.*\/chat/, { timeout: 20000 }).catch(() => { })
  const m = cp.url().match(/mission\/([0-9a-f-]{36})\/chat/)
  if (!log('Contacter → conversation', cp.url().replace(BASE, ''), !!m)) throw new Error('pas de conversation')
  const tx = cur.tx = m[1]
  const { data: t0 } = await sbC.from('transactions').select('request_id').eq('id', tx).single()
  const title = `QA parcours ${label} — ${absent ? 'client absent' : 'client sur place'} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`
  const { error: tErr } = await sbC.from('requests').update({ title }).eq('id', t0.request_id)
  log('demande titrée « QA parcours »', tErr ? tErr.message : title, !tErr)

  // 2. Le prestataire propose un tarif
  await go(pp, `/mission/${tx}/chat`)
  const propose = pp.locator('button:has-text("Proposer un tarif")').first()
  if (log('pro : « + Proposer un tarif » visible', await propose.count(), (await propose.count()) > 0)) {
    await propose.click(); await pp.waitForTimeout(800)
    const nums = pp.locator('input[type=number]')
    await nums.nth(0).fill(String(OFFER.eur)); await nums.nth(1).fill(String(OFFER.hours)); await nums.nth(2).fill(String(OFFER.hourly))
    const recap = await text(pp)
    log('pro : « Vous percevez » dans le formulaire', (recap.match(/Vous percevez [\d ,]+ €/) || [''])[0], /Vous percevez/.test(recap))
    await pp.locator('button:has-text("Envoyer la proposition")').click(); await pp.waitForTimeout(2500)
  }
  await shot(pp, `${tag}-01-pro-offre`)

  // 3. Le client accepte
  await cp.reload({ waitUntil: 'networkidle' }); await cp.waitForTimeout(2500)
  const acc = cp.locator('button:has-text("Accepter")').last()
  if (log('client : « Accepter » visible', await acc.count(), (await acc.count()) > 0)) { await acc.click(); await cp.waitForTimeout(3000) }
  const { data: tA } = await sbC.from('transactions').select('price_confirmed, subtotal_cents, buyer_fee_cents, seller_fee_cents, base_forfait_cents, included_hours, hourly_rate_cents').eq('id', tx).single()
  log('tarif validé en base', tA, tA?.price_confirmed && tA.subtotal_cents === OFFER.eur * 100 && tA.base_forfait_cents === OFFER.eur * 100 && Number(tA.included_hours) === OFFER.hours && tA.hourly_rate_cents === OFFER.hourly * 100)

  // 4. Le client fixe le rendez-vous : adresse du profil confirmée d'office (plus de case « Je confirme »)
  const rdvCard = cp.locator('text=Fixez le rendez-vous')
  if (log('client : carte « Fixez le rendez-vous »', await rdvCard.count(), (await rdvCard.count()) > 0)) {
    log('plus de case « Je confirme l’adresse »', await cp.locator('label:has-text("Je confirme") input[type=checkbox]').count(), (await cp.locator('label:has-text("Je confirme") input[type=checkbox]').count()) === 0)
    const street = cp.locator('input[autocomplete="street-address"]')
    if (await street.count()) { await street.first().fill('2 rue de l Audit, Grasse'); log('adresse saisie (profil sans adresse)', 'oui') }
    else log('adresse du profil présélectionnée', ((await text(cp)).match(/Adresse retenue[^.]*\./) || ['?'])[0], /Adresse de votre profil/.test(await text(cp)))
    const times = () => cp.locator('button:not([disabled])').filter({ hasText: /^\s*\d{1,2} h \d{2}\s*$/ })
    if (!(await times().count())) await cp.locator('button[type=button]').filter({ hasText: /^(lun|mar|mer|jeu|ven|sam|dim)/i }).first().click()
    await times().first().click()
    await cp.locator('button:has-text("Confirmer le rendez-vous")').click(); await cp.waitForTimeout(4000)
  }
  const { data: tR } = await sbC.from('transactions').select('scheduled_at, address_status, requests(address, lat, lng)').eq('id', tx).single()
  log('RDV enregistré (adresse du profil, statut « profil »)', tR, !!tR?.scheduled_at && tR.address_status === 'profil' && !!tR.requests?.address)
  await shot(cp, `${tag}-02-client-rdv`)
  // L'arrivée n'est acceptée que le jour du RDV : on le ramène à maintenant (comme le ferait un RDV du jour).
  await sbC.from('transactions').update({ scheduled_at: new Date(Date.now() + 5 * 60000).toISOString() }).eq('id', tx)
  let target = tR?.requests?.lat != null ? { lat: Number(tR.requests.lat), lng: Number(tR.requests.lng) } : null
  log('adresse géocodée à la prise de RDV', target || 'non (lat/lng nuls)', target ? true : undefined)
  if (!target) {
    // Sans coordonnées, /api/arrival géocode à la volée ; pour un test déterministe, on pose celles de Grasse.
    target = FALLBACK_POS
    await sbC.from('requests').update({ lat: target.lat, lng: target.lng }).eq('id', t0.request_id)
  }

  // 5. Commande validée + question « Serez-vous sur place ? »
  await cp.reload({ waitUntil: 'networkidle' }); await cp.waitForTimeout(2500)
  const chatBody = await text(cp)
  log('chat : billet « Commande validée. Serez-vous sur place ? »', /Commande validée\. Serez-vous sur place/.test(chatBody), /Commande validée\. Serez-vous sur place/.test(chatBody))
  if (!absent) {
    // A : réponse dans le billet du chat (compact), puis contrôle de la page Commande validée.
    await btn(cp, /^Je serai sur place$/).first().click(); await cp.waitForTimeout(2500)
    await go(cp, `/mission/${tx}/commande`)
    const b = await text(cp)
    log('/commande client : « Commande validée » + présence notée', b.slice(0, 200), /Commande validée/.test(b) && /Je serai sur place/.test(b))
  } else {
    // B : réponse sur la page « Commande validée ».
    await go(cp, `/mission/${tx}/commande`)
    let b = await text(cp)
    log('/commande client : « Commande validée » + « Serez-vous sur place ? »', b.slice(0, 220), /Commande validée/.test(b) && /Serez-vous sur place/.test(b))
    log('/commande client : total et virement sur facture', (b.match(/Total[^€]*€/) || [''])[0], /€/.test(b))
    await btn(cp, /Je ne serai pas sur place/).first().click(); await cp.waitForTimeout(2500)
    b = await text(cp)
    log('/commande client : réponse notée', (b.match(/Noté[^.]*\./) || [''])[0], /Noté/.test(b))
  }
  await shot(cp, `${tag}-03-client-commande`)
  const { data: tP } = await sbC.from('transactions').select('client_presence').eq('id', tx).single()
  log('présence en base', tP?.client_presence, tP?.client_presence === (absent ? 'absent' : 'sur_place'))
  await go(pp, `/mission/${tx}/commande`)
  const pc = await text(pp)
  log('/commande pro : « Commande reçue », présence, « Vous percevez »', pc.slice(0, 200),
    /Commande reçue/.test(pc) && (absent ? /Client absent/.test(pc) : /Client sur place/.test(pc)) && /percevez/i.test(pc))
  await shot(pp, `${tag}-04-pro-commande`)

  // 6. Mission du jour (pro) : accès rapide + Je pars
  await go(pp, '/agenda')
  log('pro : bouton « Mission du jour » dans la barre du bas', await pp.locator('button[aria-label="Mission du jour"]').count(), (await pp.locator('button[aria-label="Mission du jour"]').count()) > 0)
  await go(pp, `/mission/${tx}/jour`)
  let pj = await text(pp)
  log('pro : Mission du jour (présence sur le billet)', (pj.match(/Client (sur place|absent)/) || ['?'])[0], absent ? /Client absent/.test(pj) : /Client sur place/.test(pj))
  await btn(pp, /^Je pars$/).click(); await pp.waitForTimeout(600)
  await btn(pp, /^10 min$/).click()
  await btn(pp, /Prévenir le client/).click(); await pp.waitForTimeout(3500)
  const { data: tE } = await sbC.from('transactions').select('en_route_at, eta_minutes').eq('id', tx).single()
  log('« Je pars » enregistré', tE, !!tE?.en_route_at && tE.eta_minutes === 10)
  await shot(pp, `${tag}-05-pro-en-route`)

  if (!absent) {
    // 7A. Arrivée : le client affiche son QR (code de secours dessous), le pro scanne (saisie du code).
    await go(cp, `/mission/${tx}/jour`, 4000)
    const cj = await text(cp)
    log('client : « Votre prestataire arrive dans … »', (cj.match(/arrive dans \d+ min/) || [''])[0], /arrive dans \d+ min|d.un instant/.test(cj))
    log('client : QR d’arrivée affiché', await cp.locator('svg, canvas, img').count(), /Votre QR d.arrivée/.test(cj))
    await shot(cp, `${tag}-06-client-qr-arrivee`)
    const code = (cj.match(/Dictez-lui ce code\s*(\d{6})/) || [])[1]
    log('client : code de secours sous le QR', code || 'absent', !!code)
    await pp.reload({ waitUntil: 'networkidle' }); await pp.waitForTimeout(2500)
    await btn(pp, /Scanner le QR du client/).click(); await pp.waitForTimeout(1500)
    await shot(pp, `${tag}-07-pro-scanner`)
    await pp.locator('input[aria-label="Code à 6 chiffres"]').fill(code || '000000')
    await pp.getByRole('dialog').getByRole('button', { name: /^Valider$/ }).click()
    await waitText(pp, /Arrivée validée|Intervention en cours/, { timeout: 15000 })
    pj = await text(pp)
    log('pro : arrivée validée (scanner intégré)', (pj.match(/Arrivée (validée|à \d\d:\d\d)[^·]*/) || [''])[0], /Intervention en cours/.test(pj))
    // 8A. Fin : jeton de fin lu par le client, QR scanné avec l'appareil photo → /scan/complete
    await go(cp, `/mission/${tx}/jour`, 3500)
    log('client : QR de fin affiché', /Votre QR de fin/.test(await text(cp)), /Votre QR de fin/.test(await text(cp)))
    await shot(cp, `${tag}-08-client-qr-fin`)
    const { data: pf, error: pfe } = await sbC.rpc('get_mission_proof', { p_transaction: tx, p_phase: 'fin' })
    log('get_mission_proof(fin) côté client', pfe ? pfe.message : { token: !!pf?.token, code: !!pf?.code }, !!pf?.token)
    await go(pp, `/mission/${tx}/scan/complete?token=${encodeURIComponent(pf?.token || '')}`, 5000)
    const sc = await text(pp)
    log('pro : écran de scan de fin', sc.slice(0, 160), /Fin validée/.test(sc))
    await shot(pp, `${tag}-09-pro-scan-fin`)
  } else {
    // 7B. Arrivée, client absent : position → photo → envoi dans la messagerie → confirmation du client.
    const near = { latitude: target.lat + 0.0006, longitude: target.lng + 0.0004, accuracy: 15 } // ≈ 70 m
    await pctx.grantPermissions(['geolocation'], { origin: BASE })
    await pctx.setGeolocation(near)
    await pp.reload({ waitUntil: 'networkidle' }); await pp.waitForTimeout(2500)
    pj = await text(pp)
    log('pro : démarche « Client absent : votre arrivée en 5 étapes »', /votre arrivée en 5 étapes/.test(pj), /votre arrivée en 5 étapes/.test(pj))
    await shot(pp, `${tag}-06-pro-absent-etapes`)
    await btn(pp, /partager ma position/).click(); await pp.waitForTimeout(2500)
    log('pro : position relevée', ((await text(pp)).match(/Position relevée[^.]*\./) || [''])[0], /Position relevée/.test(await text(pp)))
    const photo = await pp.screenshot({ type: 'jpeg', quality: 40 })
    await pp.locator('input[type=file][capture]').setInputFiles({ name: 'arrivee.jpg', mimeType: 'image/jpeg', buffer: photo })
    await pp.waitForTimeout(800)
    log('pro : aperçu de la photo', await pp.locator('img[alt*="photo d’arrivée"], img[alt*="photo d\'arrivée"]').count(), (await pp.locator('img[alt*="photo d’arrivée"]').count()) > 0)
    await btn(pp, /Envoyer la photo à/).click()
    await waitText(pp, /En attente de|Photo envoyée/, { timeout: 15000 })
    pj = await text(pp)
    log('pro : photo envoyée, en attente du client', (pj.match(/Position relevée une fois[^.]*\./) || [''])[0], /En attente de/.test(pj))
    await shot(pp, `${tag}-07-pro-photo-envoyee`)
    // Messagerie du client : la photo, la distance et l'heure
    await go(cp, `/mission/${tx}/chat`, 4000)
    const cc = await text(cp)
    const { data: pm } = await sbC.from('messages').select('body, photo_path, kind').eq('transaction_id', tx).not('photo_path', 'is', null)
    log('messagerie client : message avec photo (base)', pm?.map(x => x.body.slice(0, 140)), (pm || []).length > 0)
    log('messagerie client : photo affichée dans le fil', await cp.locator('img[src*="presence-photos"], img[src*="token="]').count(), undefined)
    await shot(cp, `${tag}-08-client-chat-photo`)
    await go(cp, `/mission/${tx}/jour`, 4000)
    const cj = await text(cp)
    log('client : « … indique être sur place » + distance', (cj.match(/Photo reçue à [^.]*\./) || [''])[0], /indique être sur place/.test(cj) && /\d+ m de votre adresse|position conforme/.test(cj))
    await shot(cp, `${tag}-09-client-confirme`)
    await btn(cp, /^Je confirme$/).click(); await cp.waitForTimeout(3500)
    await waitText(pp, /Intervention en cours/, { timeout: 20000, reload: true })
    pj = await text(pp)
    log('pro : arrivée validée par la confirmation du client', (pj.match(/Arrivée à \d\d:\d\d[^0-9]*/) || [''])[0], /Intervention en cours/.test(pj))
    // 8B. Fin : le pro demande le code de fin, le client l'envoie, le pro le saisit.
    await pp.waitForTimeout(1500)
    await btn(pp, /Demander le code de fin à/).click(); await pp.waitForTimeout(3000)
    log('pro : code de fin demandé', /Demande envoyée à/.test(await text(pp)), /Demande envoyée à/.test(await text(pp)))
    await go(cp, `/mission/${tx}/jour`, 4000)
    let cf = await text(cp)
    log('client : « … indique avoir terminé » + durée et montant', (cf.match(/Fin annoncée à [^.]*\./) || [''])[0], /indique avoir terminé/.test(cf))
    await btn(cp, /Envoyer mon code de fin/).click(); await cp.waitForTimeout(3000)
    cf = await text(cp)
    const endCode = ((cf.match(/Votre code de fin, envoyé\s*(\d{3} ?\d{3})/) || [])[1] || '').replace(/\s/g, '')
    log('client : code de fin affiché', endCode || 'absent', /^\d{6}$/.test(endCode))
    await shot(cp, `${tag}-10-client-code-fin`)
    const { data: cm } = await sbC.from('messages').select('body').eq('transaction_id', tx).like('body', 'Mon code de fin%')
    log('code de fin posté dans la messagerie', cm?.map(x => x.body), (cm || []).length > 0)
    await pp.reload({ waitUntil: 'networkidle' }); await pp.waitForTimeout(3000)
    log('pro : « … vous a envoyé son code »', /vous a envoyé son code/.test(await text(pp)), /vous a envoyé son code/.test(await text(pp)))
    await pp.locator('input[placeholder="000000"]').fill(endCode)
    await btn(pp, /Clôturer avec le code de fin/).click()
    await waitText(pp, /Mission terminée/, { timeout: 15000 })
    log('pro : mission clôturée par le code de fin', /Mission terminée/.test(await text(pp)), /Mission terminée/.test(await text(pp)))
    await shot(pp, `${tag}-11-pro-fin`)
  }

  // 9. État final, factures et montants
  await sleep(2500)
  const { data: tF } = await sbC.from('transactions').select('status, arrived_at, completed_at, duration_minutes, arrival_proof, completion_proof, arrival_method, arrival_photo_path, subtotal_cents, buyer_fee_cents, seller_fee_cents, total_charged_cents, payout_cents').eq('id', tx).single()
  const expArr = absent ? 'distance_confirmation' : 'code', expFin = absent ? 'distance_code' : 'qr'
  log('mission terminée en base (preuves)', tF, tF?.status === 'completed' && tF.arrival_proof === expArr && tF.completion_proof === expFin && (!absent || !!tF.arrival_photo_path))
  const sub = OFFER.eur * 100
  log('montant : forfait inchangé (durée < 3 h incluses)', { prestation: eur(tF?.subtotal_cents || 0), frais: eur(tF?.buyer_fee_cents || 0), commission: eur(tF?.seller_fee_cents || 0), total: eur(tF?.total_charged_cents || 0), percu: eur(tF?.payout_cents || 0) },
    tF?.subtotal_cents === sub && tF.total_charged_cents === sub + tF.buyer_fee_cents && tF.payout_cents === sub - tF.seller_fee_cents)
  const { data: inv } = await sbC.from('invoices').select('number, kind, net_cents, lines').eq('transaction_id', tx)
  const byKind = Object.fromEntries((inv || []).map(i => [i.kind, i]))
  cur.invoices = (inv || []).map(i => ({ number: i.number, kind: i.kind, net: eur(i.net_cents) }))
  log('3 factures (montants)', cur.invoices,
    (inv || []).length === 3 && byKind.prestation?.net_cents === sub && byKind.commission_client?.net_cents === tF.buyer_fee_cents && byKind.commission_pro?.net_cents === tF.seller_fee_cents)
  const l0 = byKind.prestation?.lines?.[0] || {}
  log('facture : preuves dans la ligne', { arrivee: l0.preuve_arrivee, depart: l0.preuve_depart, photo: l0.photo_arrivee }, l0.preuve_arrivee === expArr && l0.preuve_depart === expFin && (!absent || l0.photo_arrivee === true))

  // 10. Page Facturation (client) : mention du mode de validation, virement
  await go(cp, `/mission/${tx}/facture`, 4000)
  // La fenêtre d'avis peut s'ouvrir seule : « Plus tard » pour lire la facture.
  if (await cp.locator('text=Comment s\'est passée').count()) { await btn(cp, /^Plus tard$/).click().catch(() => { }); await cp.waitForTimeout(600) }
  const fb = await text(cp)
  const mention = absent ? /client absent, photo et position envoyées/ : /QR du client scanné sur place|code du client saisi sur place/
  const mentionFin = absent ? /code de fin envoyé par le client/ : /QR du client scanné sur place/
  log('facture (écran) : mention du mode de validation', (fb.match(/\d\d:\d\d — \d\d:\d\d[^€]{0,200}/) || [''])[0], mention.test(fb) && mentionFin.test(fb))
  log('facture (écran) : montant de la prestation', eur(sub), fb.includes(eur(sub).replace(' ', '\u00a0')) || fb.includes(eur(sub)) || fb.includes('90,00'))
  await shot(cp, `${tag}-12-client-facture`)
  const payBtn = cp.getByRole('button', { name: /J.ai fait le virement/ })
  const nPay = await payBtn.count()
  log('facture : « J’ai fait le virement » (client)', nPay, nPay > 0)
  for (let i = 0; i < nPay; i++) { await payBtn.first().click().catch(() => { }); await cp.waitForTimeout(1500) }
  const { data: tp } = await sbC.from('transfer_payments').select('payer_role, payee, reference, status, amount_cents').eq('transaction_id', tx)
  log('virements (client) annoncés', tp, (tp || []).length >= 2 && (tp || []).every(x => x.status === 'declare_paye'))
  await shot(cp, `${tag}-13-client-virement`)

  // 11. Avis du client
  await go(cp, `/mission/${tx}/chat?avis`, 3500)
  if (await cp.locator('text=Comment s\'est passée').count()) {
    for (const g of await cp.getByRole('radiogroup').all()) await g.getByRole('radio', { name: '5 sur 5' }).click()
    await btn(cp, /^Oui$/).click()
    await cp.locator('#avis-com').fill(`Test QA parcours ${label} (compte audit).`)
    await btn(cp, /Publier mon avis/).click(); await cp.waitForTimeout(2500)
  }
  const { data: rv } = await sbC.from('reviews').select('stars, comment').eq('transaction_id', tx)
  log('avis du client enregistré', rv, (rv || []).length === 1 && rv[0].stars === 5)
  await shot(cp, `${tag}-14-client-avis`)

  // 12. Récapitulatif pro
  await go(pp, `/mission/${tx}/jour`, 3000)
  const pr = await text(pp)
  log('pro : récapitulatif « Vous percevez »', (pr.match(/Vous percevez\s*[\d ,]+\s*€/) || [''])[0], /Vous percevez/.test(pr))
  await shot(pp, `${tag}-15-pro-recap`)

  log('erreurs console / réseau', errs.slice(0, 20))
  await cctx.close(); await pctx.close()
}

// ------------------------------------------------------------------------------------------------------------
const browser = await chromium.launch()
const sbC = createClient(...SB, { auth: { persistSession: false } })
await sbC.auth.signInWithPassword({ email: CLIENT, password: PWD })
try {
  cur = report.scenarios.setup = { steps: [], errors: [] }
  // Missions QA restées ouvertes (essai précédent) : annulées et titrées.
  for (const id of OLD_QA) {
    const { data: o } = await sbC.from('transactions').select('id, status, arrived_at, request_id').eq('id', id).maybeSingle()
    if (o && o.status === 'pending' && !o.arrived_at) {
      const { error } = await sbC.from('transactions').update({ status: 'cancelled' }).eq('id', id)
      await sbC.from('requests').update({ title: 'QA parcours — essai annulé' }).eq('id', o.request_id)
      log(`annulation de l'essai ${id.slice(0, 8)}`, error ? error.message : 'annulée', !error)
    } else log(`essai ${id.slice(0, 8)}`, o ? o.status : 'introuvable')
  }
  if (process.env.TOUR) await tour(browser)
  const which = process.env.SCEN || 'AB'
  for (const [label, absent] of [['A', false], ['B', true]]) {
    if (!which.includes(label)) continue
    try { await scenario(browser, sbC, label, absent) } catch (e) { log('ERREUR', String(e && e.stack || e).slice(0, 600), false) }
  }
} catch (e) { log('ERREUR', String(e && e.stack || e), false) }
await browser.close()
for (const [k, s] of Object.entries(report.scenarios)) {
  const ko = s.steps.filter(x => x.ok === false)
  console.log(`\n=== ${k} : ${s.steps.filter(x => x.ok).length} OK, ${ko.length} KO${s.tx ? ` · mission ${s.tx}` : ''}`)
  for (const x of ko) console.log('  KO', x.k)
}
fs.writeFileSync('report.json', JSON.stringify(report, null, 1))
