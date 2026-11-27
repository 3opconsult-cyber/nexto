// Audit d'homogénéité et d'ergonomie (session Design, 27/11/2026), sur la PROD, comptes audit, lecture seule.
// Pour chaque écran (390 px et 1280 px) : ouverture, message d'erreur, défilement horizontal, éléments
// cliquables recouverts (par la barre du bas ou un bandeau), cibles < 44 px, textes < 12 px, erreurs console.
// Usage : node audit-design.mjs   (OUT=/chemin pour les captures)
import { chromium } from 'playwright'
import fs from 'fs'
const BASE = process.env.BASE || 'https://nexto-eta.vercel.app'
const OUT = process.env.OUT || 'shots-audit-design/'
const PWD = process.env.AUDIT_PWD || fs.readFileSync(new URL('./parcours.mjs', import.meta.url), 'utf8').match(/PWD = '([^']+)'/)[1]
const CLIENT = 'audit.client.claude@ping-demo.invalid', PRO = 'audit.pro.claude@ping-demo.invalid'
const PID = 'b9f8cd9a-16de-4a36-afd8-10a2135ab970'
fs.mkdirSync(OUT, { recursive: true })
const PAGES = {
  public: ['/', '/auth/login', '/auth/signup', '/comment-ca-marche', '/cgu', '/aide', '/landing-pro.html', '/landing-particulier.html'],
  client: ['/map', '/hub', '/agenda', '/messages', '/client/demandes', '/client/profil', '/client/paiements', '/client/documents', '/client/favoris', '/client/avis', '/client/parrainage', '/documents', '/litiges', `/pro/${PID}`],
  pro: ['/pro/dashboard', '/pro/carte', '/pro/annonce', '/pro/tarifs', '/pro/disponibilites', '/pro/documents', '/pro/paiements', '/pro/revenus', '/agenda', '/messages', '/hub', `/pro/${PID}`],
}
const report = []
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function measure(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth, vh = window.innerHeight
    const out = { hscroll: document.documentElement.scrollWidth > vw + 1, small: [], tiny: 0, covered: [], erreur: null }
    const txt = document.body.innerText
    const m = txt.match(/(introuvable|Une erreur|Erreur inattendue|Application error|404|Page non trouvée)/i)
    if (m) out.erreur = m[0]
    const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw }
    const clickables = [...document.querySelectorAll('a[href], button, [role=button], input:not([type=hidden]), select, textarea, [role=switch], [role=radio], [role=tab]')].filter(vis)
    for (const el of clickables) {
      const r = el.getBoundingClientRect()
      const name = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40)
      if ((r.height < 44 && r.width < 44) || r.height < 32) out.small.push(`${name} (${Math.round(r.width)}x${Math.round(r.height)})`)
      // recouvrement : le point central appartient-il à l'élément ?
      const cx = Math.min(Math.max(r.left + r.width / 2, 1), vw - 1), cy = Math.min(Math.max(r.top + r.height / 2, 1), vh - 1)
      const top = document.elementFromPoint(cx, cy)
      if (top && !el.contains(top) && !top.contains(el)) {
        const tn = (top.closest('nav,header,footer,[role=dialog],[style*="fixed"]') || top)
        const tname = (tn.getAttribute('aria-label') || tn.className?.toString?.() || tn.tagName).toString().slice(0, 40)
        out.covered.push(`${name} sous ${tname}`)
      }
    }
    for (const el of document.querySelectorAll('body *')) {
      if (!el.childNodes.length || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue
      if (!vis(el)) continue
      if (parseFloat(getComputedStyle(el).fontSize) < 12) out.tiny++
    }
    out.small = [...new Set(out.small)].slice(0, 8); out.covered = [...new Set(out.covered)].slice(0, 8)
    return out
  })
}

async function login(ctx, email) {
  const page = await ctx.newPage()
  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle' })
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(PWD)
  await page.locator('button[type=submit], button:has-text("connecter")').first().click()
  await page.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 20000 }).catch(() => { })
  await sleep(2000)
  return page
}

async function tour(b, who, email, vp) {
  const ctx = await b.newContext({ viewport: vp, geolocation: { latitude: 43.6589, longitude: 6.9237 }, permissions: ['geolocation'] })
  const page = email ? await login(ctx, email) : await ctx.newPage()
  if (email && who === 'pro') {
    // bascule en mode prestataire si nécessaire
    await page.goto(BASE + '/pro/dashboard', { waitUntil: 'networkidle' }).catch(() => { })
  }
  const errs = []
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)))
  for (const path of PAGES[who]) {
    errs.length = 0
    const resp = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 45000 }).catch(e => null)
    await sleep(path.includes('map') || path.includes('carte') ? 5000 : 1800)
    const m = await measure(page).catch(e => ({ fail: String(e) }))
    const tag = `${who}-${vp.width}-${path.replace(/[^a-z0-9]+/gi, '_')}`
    await page.screenshot({ path: OUT + tag + '.jpg', type: 'jpeg', quality: 60 }).catch(() => { })
    const row = { who, w: vp.width, path, status: resp?.status(), url: page.url().replace(BASE, ''), ...m, jsErr: [...errs] }
    report.push(row)
    console.log(JSON.stringify(row))
  }
  await ctx.close()
}

const b = await chromium.launch()
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  await tour(b, 'public', null, vp)
  await tour(b, 'client', CLIENT, vp)
  await tour(b, 'pro', PRO, vp)
}
await b.close()
fs.writeFileSync(OUT + 'rapport.json', JSON.stringify(report, null, 1))
