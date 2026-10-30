import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const BASE = 'https://nexto-eta.vercel.app'
const SB = ['https://wmiawwaxwlvascyflpba.supabase.co', 'sb_publishable_ehRFsNEJD1hnkOyi7vdfEA_NJey8yfP']
const CLIENT = 'audit.client.claude@ping-demo.invalid', PRO = 'audit.pro.claude@ping-demo.invalid', PWD = 'AuditPing2026!'
const PID = 'b9f8cd9a-16de-4a36-afd8-10a2135ab970'
fs.mkdirSync('shots', { recursive: true })
const report = { steps: [], pages: [] }
const log = (k, v) => { report.steps.push({ k, v }); console.log('##', k, typeof v === 'string' ? v : JSON.stringify(v)) }

async function ctxFor(browser, mobile) {
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' }
    : { viewport: { width: 1280, height: 800 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
  return ctx
}
function watch(page, tag) {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
  page.on('response', r => { if (r.status() >= 400 && /supabase|nexto-eta/.test(r.url())) errs.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, '').slice(0, 160)}`) })
  return errs
}
async function login(page, email) {
  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle' })
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(PWD)
  await page.locator('button:has-text("connecter"), button[type=submit]').first().click()
  await page.waitForTimeout(3500)
}
async function visit(page, errs, path, name, setMode) {
  errs.length = 0
  if (setMode) await page.evaluate(m => localStorage.setItem('ping_mode', m), setMode)
  await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(e => errs.push('goto ' + e.message))
  await page.waitForTimeout(2500)
  const info = await page.evaluate(() => {
    const doc = document.documentElement
    const hOverflow = doc.scrollWidth > window.innerWidth + 2
    // Textes écrasés : éléments de texte larges de moins de 60 px avec plusieurs lignes.
    const squeezed = []
    document.querySelectorAll('p, span, div, b, a, button').forEach(el => {
      if (el.children.length) return
      const t = (el.textContent || '').trim()
      if (t.length < 25) return
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.width < 70 && r.height > 60) squeezed.push(t.slice(0, 50))
    })
    const raw = []
    const body = document.body.innerText
    for (const w of ['undefined', 'NaN', 'null €', '[object Object]', 'Invalid Date']) if (body.includes(w)) raw.push(w)
    return { hOverflow, squeezed: squeezed.slice(0, 5), raw, title: document.title, text: body.slice(0, 300) }
  })
  await page.screenshot({ path: `shots/${name}.jpg`, quality: 55, type: 'jpeg', fullPage: false })
  report.pages.push({ name, path, url: page.url().replace(BASE, ''), errs: [...errs].slice(0, 8), ...info })
  console.log('PAGE', name, page.url().replace(BASE, ''), JSON.stringify({ errs: errs.slice(0, 4), o: info.hOverflow, sq: info.squeezed, raw: info.raw }))
}

const browser = await chromium.launch()
try {
  // ---------- tour des pages, client puis pro, mobile puis desktop ----------
  for (const mobile of [true, false]) {
    const tag = mobile ? 'm' : 'd'
    const c = await ctxFor(browser, mobile); const cp = await c.newPage(); const ce = watch(cp)
    await login(cp, CLIENT)
    for (const [path, name] of [['/map', 'map'], [`/pro/${PID}`, 'fiche-pro'], [`/mission/new?pro=${PID}`, 'reservation'], ['/client/profil', 'profil'], ['/client/demandes', 'demandes'], ['/client/demandes/new', 'demande-new'], ['/messages', 'messages'], ['/agenda', 'agenda'], ['/documents', 'operations'], ['/litiges', 'reclamations'], ['/client/favoris', 'favoris'], ['/client/parrainage', 'parrainage'], ['/cgu', 'cgu']])
      await visit(cp, ce, path, `${tag}-client-${name}`, 'particulier')
    await c.close()
    const p = await ctxFor(browser, mobile); const pp = await p.newPage(); const pe = watch(pp)
    await login(pp, PRO)
    for (const [path, name] of [['/pro/carte', 'carte'], ['/pro/dashboard', 'entreprise'], ['/pro/tarifs', 'tarifs'], ['/pro/revenus', 'revenus'], ['/pro/disponibilites', 'dispos'], ['/pro/documents', 'pieces'], ['/pro/paiements', 'versements'], ['/messages', 'messages'], ['/agenda', 'agenda'], ['/documents', 'operations']])
      await visit(pp, pe, path, `${tag}-pro-${name}`, 'pro')
    await p.close()
  }

  // ---------- scénario complet : Contacter → devis → accord → RDV → QR → scans → facture ----------
  const sbC = createClient(...SB, { auth: { persistSession: false } }); await sbC.auth.signInWithPassword({ email: CLIENT, password: PWD })
  const c = await ctxFor(browser, true); const cp = await c.newPage(); const ce = watch(cp)
  const p = await ctxFor(browser, true); const pp = await p.newPage(); const pe = watch(pp)
  await login(cp, CLIENT); await login(pp, PRO)
  await cp.evaluate(() => localStorage.setItem('ping_mode', 'particulier'))
  await pp.evaluate(() => localStorage.setItem('ping_mode', 'pro'))
  await cp.goto(`${BASE}/pro/${PID}`, { waitUntil: 'networkidle' }); await cp.waitForTimeout(2000)
  await cp.locator('button:has-text("Contacter")').first().click()
  await cp.waitForURL(/\/mission\/.*\/chat/, { timeout: 20000 }).catch(() => {})
  const m = cp.url().match(/mission\/([0-9a-f-]+)\/chat/)
  log('contacter → chat', cp.url().replace(BASE, ''))
  if (!m) throw new Error('pas de chat après Contacter: ' + ce.join(' | '))
  const tx = m[1]
  await cp.waitForTimeout(2000)
  await cp.screenshot({ path: 'shots/s1-client-chat.jpg', quality: 55, type: 'jpeg' })
  // Pro propose un tarif
  await pp.goto(`${BASE}/mission/${tx}/chat`, { waitUntil: 'networkidle' }); await pp.waitForTimeout(2500)
  const propose = pp.locator('button:has-text("Proposer un tarif")')
  log('pro voit + Proposer un tarif', await propose.count())
  if (await propose.count()) {
    await propose.click(); await pp.waitForTimeout(800)
    await pp.screenshot({ path: 'shots/s2-pro-form-tarif.jpg', quality: 55, type: 'jpeg' })
    const nums = pp.locator('input[type=number]')
    await nums.nth(0).fill('90'); await nums.nth(1).fill('3'); await nums.nth(2).fill('25')
    await pp.locator('button:has-text("Envoyer la proposition")').click(); await pp.waitForTimeout(2500)
  }
  await pp.screenshot({ path: 'shots/s3-pro-chat-offre.jpg', quality: 55, type: 'jpeg' })
  // Client accepte
  await cp.reload({ waitUntil: 'networkidle' }); await cp.waitForTimeout(2500)
  const acc = cp.locator('button:has-text("Accepter")').last()
  log('client voit Accepter', await acc.count())
  if (await acc.count()) { await acc.click(); await cp.waitForTimeout(3000) }
  await cp.screenshot({ path: 'shots/s4-client-apres-accord.jpg', quality: 55, type: 'jpeg' })
  // Client fixe le RDV
  const rdv = cp.locator('text=Fixez le rendez-vous')
  log('carte Fixez le rendez-vous', await rdv.count())
  if (await rdv.count()) {
    const inputs = cp.locator('input[autocomplete="street-address"]')
    await inputs.fill('12 promenade des Anglais, 06000 Nice')
    const dt = new Date(Date.now() + 2 * 86400000); dt.setHours(9, 0, 0, 0)
    const pad = n => String(n).padStart(2, '0')
    await cp.locator('input[type=datetime-local]').fill(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T09:00`)
    await cp.locator('button:has-text("Confirmer le rendez-vous")').click(); await cp.waitForTimeout(4000)
  }
  await cp.screenshot({ path: 'shots/s5-client-rdv.jpg', quality: 55, type: 'jpeg' })
  log('bouton Mes codes QR', await cp.locator('button:has-text("Mes codes QR")').count())
  // Pro : adresse visible + Je pars
  await pp.reload({ waitUntil: 'networkidle' }); await pp.waitForTimeout(2500)
  log('pro voit adresse', await pp.locator('text=promenade des Anglais').count())
  await pp.screenshot({ path: 'shots/s6-pro-adresse.jpg', quality: 55, type: 'jpeg' })
  // Client ouvre ses QR
  await cp.locator('button:has-text("Mes codes QR")').first().click().catch(() => {})
  await cp.waitForTimeout(3000)
  log('client page QR', cp.url().replace(BASE, ''))
  await cp.screenshot({ path: 'shots/s7-client-qr.jpg', quality: 55, type: 'jpeg' })
  const { data: t } = await sbC.from('transactions').select('qr_arrival_token, qr_complete_token').eq('id', tx).single()
  // Pro scanne l'arrivée puis la fin
  await pp.goto(`${BASE}/mission/${tx}/scan/arrival?token=${t.qr_arrival_token}`, { waitUntil: 'networkidle' }); await pp.waitForTimeout(4000)
  log('scan arrivée', (await pp.locator('body').innerText()).slice(0, 160))
  await pp.screenshot({ path: 'shots/s8-pro-scan-arrivee.jpg', quality: 55, type: 'jpeg' })
  await pp.goto(`${BASE}/mission/${tx}/scan/complete?token=${t.qr_complete_token}`, { waitUntil: 'networkidle' }); await pp.waitForTimeout(5000)
  log('scan fin', (await pp.locator('body').innerText()).slice(0, 200))
  await pp.screenshot({ path: 'shots/s9-pro-scan-fin.jpg', quality: 55, type: 'jpeg' })
  // Facture côté client
  await cp.goto(`${BASE}/mission/${tx}/facture`, { waitUntil: 'networkidle' }); await cp.waitForTimeout(4000)
  log('facture client', (await cp.locator('body').innerText()).slice(0, 300))
  await cp.screenshot({ path: 'shots/s10-client-facture.jpg', quality: 55, type: 'jpeg' })
  const { data: inv } = await sbC.from('invoices').select('number, kind, net_cents').eq('transaction_id', tx)
  log('factures en base', inv)
  log('erreurs client', ce.slice(0, 10)); log('erreurs pro', pe.slice(0, 10))
  report.tx = tx
} catch (e) { log('ERREUR', String(e && e.stack || e)) }
await browser.close()
fs.writeFileSync('report.json', JSON.stringify(report, null, 1))
