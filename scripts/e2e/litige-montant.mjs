// Litige : panneau « Décision PING », montant rendu au client (remarque de Romain, capture iPhone du 24/11).
// iPhone simulé (390x844, isMobile, hasTouch), compte audit client connecté, puis TOUT le dossier est SIMULÉ dans
// le navigateur : is_admin = vrai, litige, mission, fil et paiements fictifs (« QA litige-montant »). Aucune écriture :
// ping_decide_dispute et /api/disputes/apply sont INTERCEPTÉS (réponse fictive), toute autre écriture vers la base
// est bloquée et comptée (doit rester à 0). Le mot de passe est lu dans parcours.mjs (ligne 22), jamais recopié.
//   BASE=http://localhost:3000 node scripts/e2e/litige-montant.mjs           (contrôles du curseur synchronisé)
//   AVANT=1 BASE=... node scripts/e2e/litige-montant.mjs                      (diagnostic de l'ancien panneau à pastilles %)
// Captures : docs/refonte-litige-2026-11-24/.
import { chromium } from 'playwright'
import fs from 'fs'

const BASE = process.env.BASE || 'http://localhost:3000'
const AVANT = !!process.env.AVANT
const PWD = process.env.AUDIT_PWD || fs.readFileSync(new URL('./parcours.mjs', import.meta.url), 'utf8').match(/PWD = '([^']+)'/)[1]
const OUT = new URL('../../docs/refonte-litige-2026-11-24/', import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })
const TAG = AVANT ? 'avant' : 'apres'
// Prix de la prestation simulé : 75,50 € (centimes non ronds, pour vérifier la conversion exacte).
const CEIL = 7550
const DID = '00000000-0000-4000-8000-0000000a1171', TX = '00000000-0000-4000-8000-0000000a1172'
const BUYER = '00000000-0000-4000-8000-0000000a1173', SELLER = '00000000-0000-4000-8000-0000000a1174'
const now = Date.now()
const DISPUTE = {
  id: DID, transaction_id: TX, opener_id: BUYER, status: 'open', reason: 'QA litige-montant : simulation, aucune donnée réelle',
  category: 'qualite', claimed_cents: 3000, photo_paths: [], resolution: null, created_at: new Date(now - 3600e3).toISOString(),
  deadline_at: new Date(now + 40 * 3600e3).toISOString(), decided_at: null, decision_refund_cents: null, decision_payout_cents: null,
  mediation_requested_at: new Date(now - 1800e3).toISOString(), mediation_requested_by: BUYER, money_result: null, money_error: null,
  settlement_status: null, settlement_cents: null, settlement_by: null, agreed_cents: null,
}
const TXROW = { id: TX, buyer_id: BUYER, seller_id: SELLER, subtotal_cents: CEIL, buyer_fee_cents: 604, total_charged_cents: CEIL + 604,
  payout_cents: CEIL - 1284, payment_status: 'none', payment_provider: null, scheduled_at: new Date(now - 7200e3).toISOString(),
  completed_at: new Date(now - 3600e3).toISOString(), requests: { title: 'QA litige-montant (simulé)', category: 'menage' } }

const res = { base: BASE, mode: TAG, checks: [], decide: [], blocked: [] }
const check = (k, v, ok) => { res.checks.push({ k, v, ok: !!ok }); console.log(ok ? 'OK' : 'KO', k, typeof v === 'string' ? v : JSON.stringify(v)); return ok }
const sleep = ms => new Promise(r => setTimeout(r, ms))

const browser = await chromium.launch()
try {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR' })
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)))
  await p.goto(BASE + '/auth/login', { waitUntil: 'networkidle' })
  await p.locator('input[type=email]').fill('audit.client.claude@ping-demo.invalid'); await p.locator('input[type=password]').fill(PWD)
  await p.locator('button[type=submit]').first().click(); await sleep(3500)

  // Simulation de lecture + interception des écritures (rien ne part vers la base).
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  await c.route(/\/rest\/v1\//, async route => {
    const r = route.request(); const u = new URL(r.url()); const path = u.pathname.replace(/^.*\/rest\/v1\//, ''); const m = r.method()
    if (path === 'rpc/is_admin') return json(route, true)
    if (path === 'rpc/transaction_counterparts') return json(route, [{ transaction_id: TX, full_name: 'QA Partie' }])
    if (path === 'rpc/ping_decide_dispute') { res.decide.push(JSON.parse(r.postData() || '{}')); return json(route, null) }
    if (path === 'disputes' && m === 'GET') return json(route, u.searchParams.get('select')?.includes('transactions') ? { ...DISPUTE, transactions: TXROW } : DISPUTE)
    if (path === 'dispute_messages' && m === 'GET') return json(route, [])
    if (path === 'payments' && m === 'GET') return json(route, [])
    if (m === 'GET' || m === 'HEAD') return route.continue() // lectures des autres composants (menu, non-lus) : laissées passer
    if (path.startsWith('rpc/')) { res.blocked.push(`${m} ${path} (simulé, non envoyé)`); return json(route, null) }
    res.blocked.push(`${m} ${path} (ÉCRITURE BLOQUÉE)`); return route.abort()
  })
  await c.route(/\/api\/disputes\/apply/, route => json(route, { argent: { etat: 'virement_avoir' } }))
  await c.route(/\/api\/(?!disputes\/apply)/, route => route.request().method() === 'GET' ? route.continue() : (res.blocked.push(`API ${route.request().url()}`), route.abort()))

  await p.goto(`${BASE}/litiges/${DID}`, { waitUntil: 'networkidle' })
  await p.getByText('Décision PING', { exact: true }).waitFor({ timeout: 20000 }).catch(async () => { await p.screenshot({ path: `${OUT}${TAG}-echec-chargement.png` }) })
  check('panneau Décision PING visible (admin simulé)', '', await p.getByText('Décision PING', { exact: true }).count() > 0)
  const field = p.locator('#dec-refund')
  await field.scrollIntoViewIfNeeded()
  // Capture centrée sur un élément du panneau (par défaut le titre « Décision PING » en haut de l'écran).
  const shot = async (name, sel) => {
    await p.evaluate(s => { const el = s ? document.querySelector(s) : [...document.querySelectorAll('[data-dec-panel] div')].find(d => d.textContent === 'Décision PING'); el?.scrollIntoView({ block: s ? 'center' : 'start' }); if (!s) scrollBy(0, -20) }, sel || null)
    await sleep(250); await p.screenshot({ path: `${OUT}${TAG}-${name}.png` })
  }

  if (AVANT) {
    await p.evaluate(() => document.getElementById('dec-refund')?.closest('div[style*="1.5px solid"]')?.scrollIntoView({ block: 'start' }))
    await p.screenshot({ path: `${OUT}avant-1-panneau.png` })
    const pills = await p.locator('#dec-refund ~ div button').allInnerTexts()
    check('pastilles présentes', pills, pills.length > 0)
    for (const t of pills) {
      const before = await field.inputValue()
      await p.locator('#dec-refund ~ div button', { hasText: t }).tap()
      await sleep(300)
      const after = await field.inputValue()
      const box = await p.locator('#dec-refund ~ div button', { hasText: t }).boundingBox()
      check(`tap « ${t} » : champ ${JSON.stringify(before)} -> ${JSON.stringify(after)} (pastille ${Math.round(box.width)}x${Math.round(box.height)})`, '', true)
    }
    const style = await field.evaluate(e => { const s = getComputedStyle(e); return { border: s.borderTopWidth + ' ' + s.borderTopStyle, bg: s.backgroundColor, font: s.fontSize } })
    check('style calculé du champ (règle .a-lift)', style, true)
    await field.tap(); await field.fill('12'); await p.screenshot({ path: `${OUT}avant-2-saisie.png` })
  } else {
    const slider = p.getByRole('slider', { name: /Montant rendu au client/ })
    check('curseur présent', '', await slider.count() === 1)
    const attrs = await slider.evaluate(e => ({ min: e.min, max: e.max, step: e.step }))
    check('curseur de 0 au prix de la prestation, pas de 1 €', attrs, attrs.min === '0' && attrs.max === String(CEIL) && attrs.step === '100')
    const readOut = async () => (await p.locator('[data-dec-split]').innerText()).replace(/\s+/g, ' ')
    const sliderVal = () => slider.evaluate(e => Number(e.value))
    await shot('1-panneau')

    // Pastilles : Rien / La moitié / Tout, au doigt.
    for (const [t, want, wantField] of [['Tout', CEIL, '75,50'], ['La moitié', Math.round(CEIL / 2), '37,75'], ['Rien', 0, '0']]) {
      await p.getByRole('button', { name: t, exact: true }).tap(); await sleep(200)
      const fv = await field.inputValue(); const sv = await sliderVal()
      check(`tap « ${t} » : champ ${fv}, curseur ${sv}`, '', fv === wantField && sv === (want === CEIL ? 7500 : want - (want % 100)) || (fv === wantField && Math.abs(sv - want) < 100))
    }
    // Curseur -> champ : on fait glisser la poignée au doigt jusqu'au milieu.
    const box = await slider.boundingBox()
    check('poignée du curseur : zone tactile >= 44 px de haut', Math.round(box.height), box.height >= 44)
    await p.touchscreen.tap(box.x + box.width * 0.6, box.y + box.height / 2); await sleep(200)
    const sv1 = await sliderVal(); const fv1 = await field.inputValue()
    check(`curseur -> champ (tap à 60 %) : curseur ${sv1}, champ ${fv1}`, '', sv1 > 0 && sv1 % 100 === 0 && fv1 === String(sv1 / 100))
    await slider.focus(); await p.keyboard.press('ArrowRight'); await sleep(150)
    const sv2 = await sliderVal(); const fv2 = await field.inputValue()
    check(`curseur au clavier +1 € : ${sv1} -> ${sv2}, champ ${fv2}`, '', sv2 === sv1 + 100 && fv2 === String(sv2 / 100))
    // Champ -> curseur.
    await field.tap(); await field.fill('20,40'); await sleep(150)
    check('champ -> curseur (20,40 €)', await sliderVal(), Math.abs((await sliderVal()) - 2040) < 100)
    const ro = await readOut()
    check('affichage en direct', ro, /Rendu au client : 20,40 €/.test(ro) && /Versé au prestataire : 55,10 €/.test(ro))
    // Clavier ouvert simulé : le clavier décimal de l'iPhone occupe ~336 px, il reste 508 px visibles.
    await p.locator('#dec-reason').tap(); await p.setViewportSize({ width: 390, height: 508 }); await field.tap(); await sleep(900)
    const onTop = await p.evaluate(() => {
      const hit = el => { const r = el.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { y: Math.round(r.top), bas: Math.round(r.bottom), libre: e === el || el.contains(e) } }
      return { champ: hit(document.getElementById('dec-refund')), curseur: hit(document.querySelector('.dec-range')), haut: innerHeight }
    })
    check('clavier ouvert (508 px visibles) : champ et curseur visibles, non recouverts', onTop, onTop.champ.libre && onTop.curseur.libre && onTop.champ.bas <= 508)
    await p.screenshot({ path: `${OUT}apres-2-clavier-ouvert.png` })
    await p.locator('#dec-reason').tap(); await sleep(900)
    const btnVis = await p.evaluate(() => { const ta = document.getElementById('dec-reason').getBoundingClientRect(); const e = document.elementFromPoint(ta.x + ta.width / 2, ta.y + 10); return { y: Math.round(ta.top), bas: Math.round(ta.bottom), libre: e?.id === 'dec-reason' } })
    check('clavier ouvert sur le motif : zone de saisie non recouverte', btnVis, btnVis.libre && btnVis.bas <= 508)
    await p.setViewportSize({ width: 390, height: 844 }); await sleep(300)
    // Bornes.
    const apply = p.getByRole('button', { name: 'Appliquer la décision' })
    await field.fill('80'); await sleep(150)
    check('montant > total : refusé (bouton inactif, message)', await readOut(), await apply.isDisabled() && /entre 0 et 75,50/.test(await p.locator('[data-dec-panel]').innerText()))
    await shot('3-borne-depassee', '#dec-refund')
    await field.fill('-5'); await sleep(150)
    check('montant négatif : refusé', await field.inputValue(), await apply.isDisabled())
    await field.fill('abc'); await sleep(150)
    check('texte non numérique : refusé', await field.inputValue(), await apply.isDisabled())
    await field.fill('12,345'); await sleep(150)
    check('plus de 2 décimales : refusé', '', await apply.isDisabled())
    // Motif : 10 caractères au moins.
    await field.fill('20,40')
    await p.locator('#dec-reason').fill('Trop court')
    await p.locator('#dec-reason').fill('Court'); await sleep(100)
    check('motif < 10 caractères : bouton inactif', '', await apply.isDisabled())
    await p.locator('#dec-reason').fill('QA simulation : partie du ménage non faite'); await sleep(100)
    check('motif >= 10 et montant valide : bouton actif', '', await apply.isEnabled())
    const ab = await apply.boundingBox()
    check('bouton Appliquer : cible >= 44 px', Math.round(ab.height), ab.height >= 44)
    // Mesures de lecture aérée dans le panneau.
    const m = await p.locator('[data-dec-panel]').evaluate(el => {
      const small = [...el.querySelectorAll('*')].filter(e => e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 15).map(e => e.textContent.trim().slice(0, 30) + ' ' + getComputedStyle(e).fontSize)
      const tiny = [...el.querySelectorAll('button, input, textarea')].filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 }).map(e => (e.innerText || e.id || e.type) + ' ' + Math.round(e.getBoundingClientRect().height))
      return { small, tiny }
    })
    check('panneau : aucun texte < 15 px', m.small, m.small.length === 0)
    check('panneau : aucune cible < 44 px', m.tiny, m.tiny.length === 0)
    await apply.tap(); await sleep(900)
    await p.screenshot({ path: `${OUT}${TAG}-4-confirmation.png` })
    const conf = p.getByRole('button', { name: /^Confirmer : 20,40\s€ au client, 55,10\s€ au prestataire/ })
    check('confirmation en 2 appuis avec les montants', await conf.count(), await conf.count() === 1)
    const confFree = await conf.evaluate(b => { const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { y: Math.round(r.top), bas: Math.round(r.bottom), libre: e === b || b.contains(e) } })
    check('bouton Confirmer amené à l\'écran, non recouvert par la barre d\'envoi', confFree, confFree.libre)
    await conf.tap(); await sleep(1500)
    check('ping_decide_dispute intercepté : centimes exacts', res.decide, res.decide.length === 1 && res.decide[0].p_refund_cents === 2040 && res.decide[0].p_dispute === DID && /QA simulation/.test(res.decide[0].p_reason))
    // Deuxième envoi : « Tout » -> 7550 centimes exacts (pas de perte sur le pas de 1 €).
    await p.reload({ waitUntil: 'networkidle' }); await sleep(2000)
    await p.getByRole('button', { name: 'Tout', exact: true }).tap()
    await p.locator('#dec-reason').fill('QA simulation : rien n a été fait'); await p.getByRole('button', { name: 'Appliquer la décision' }).tap()
    await p.getByRole('button', { name: /^Confirmer : 75,50\s€ au client, 0,00\s€ au prestataire/ }).tap(); await sleep(1500)
    check('« Tout » envoie le prix exact en centimes (7550)', res.decide.map(x => x.p_refund_cents), res.decide.length === 2 && res.decide[1].p_refund_cents === CEIL)
  }
  check('aucune écriture réelle partie vers la base', res.blocked.filter(b => /BLOQUÉE|API/.test(b)), true)
  check('erreurs de page', errs, errs.length === 0)
  await c.close()
} finally { await browser.close() }
fs.writeFileSync(`${OUT}litige-montant-${TAG}.json`, JSON.stringify(res, null, 1))
const ko = res.checks.filter(x => !x.ok)
console.log(ko.length ? `${ko.length} KO` : 'tout OK'); process.exit(ko.length ? 1 : 0)
