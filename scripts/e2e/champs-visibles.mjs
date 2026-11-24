// Détecte les champs de saisie visibles sans bordure ni fond ni ombre (invisibles à l'écran) : bug du 24/11 (règle a-lift).
// BASE=https://nexto-eta.vercel.app node champs-visibles.mjs   (lecture seule, comptes audit)
import { chromium } from 'playwright'
import fs from 'fs'
const BASE = process.env.BASE || 'https://nexto-eta.vercel.app'
const PWD = process.env.AUDIT_PWD || fs.readFileSync(new URL('./parcours.mjs', import.meta.url), 'utf8').match(/PWD = '([^']+)'/)[1]
const CLIENT = 'audit.client.claude@ping-demo.invalid', PRO = 'audit.pro.claude@ping-demo.invalid'
const PAGES = {
  client: ['/messages', '/agenda', '/client/profil', '/client/demandes/new', '/client/demandes', '/client/paiements', '/client/documents', '/mission/new?pro=b9f8cd9a-16de-4a36-afd8-10a2135ab970', '/pro/b9f8cd9a-16de-4a36-afd8-10a2135ab970', '/support'],
  pro: ['/messages', '/agenda', '/pro/dashboard', '/pro/paiements', '/pro/documents', '/pro/annonce', '/pro/tarifs', '/pro/disponibilites', '/pro/revenus'],
}
const browser = await chromium.launch()
let bad = 0
for (const [who, email] of [['client', CLIENT], ['pro', PRO]]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR' })
  const p = await ctx.newPage()
  await p.goto(BASE + '/auth/login', { waitUntil: 'networkidle' })
  await p.locator('input[type=email]').fill(email); await p.locator('input[type=password]').fill(PWD)
  await p.locator('button[type=submit]').first().click(); await p.waitForTimeout(4000)
  await p.evaluate(m => localStorage.setItem('ping_mode', m), who === 'pro' ? 'pro' : 'particulier')
  for (const path of PAGES[who]) {
    await p.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {})
    await p.waitForTimeout(2500)
    const found = await p.evaluate(() => [...document.querySelectorAll('input, textarea, select')].filter(e => {
      if (['checkbox', 'radio', 'hidden', 'file', 'range', 'submit', 'button'].includes(e.type)) return false
      const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false
      const c = getComputedStyle(e)
      const noBorder = ['Top', 'Right', 'Bottom', 'Left'].every(s => parseFloat(c['border' + s + 'Width']) === 0 || c['border' + s + 'Style'] === 'none')
      const noBg = c.backgroundColor === 'rgba(0, 0, 0, 0)' || c.backgroundColor === 'transparent'
      // un champ sans bordure ni fond est acceptable s'il est dans un conteneur qui porte la bordure ou le fond
      let a = e.parentElement, boxed = false
      for (let i = 0; i < 3 && a; i++, a = a.parentElement) { const s = getComputedStyle(a); if (parseFloat(s.borderTopWidth) > 0 || (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent' && s.backgroundColor !== 'rgb(255, 255, 255)' && s.backgroundColor !== 'rgb(243, 246, 245)')) boxed = true }
      return noBorder && noBg && c.boxShadow === 'none' && !boxed
    }).map(e => (e.getAttribute('placeholder') || e.getAttribute('aria-label') || e.name || e.type) + ' <' + e.tagName.toLowerCase() + '>'))
    if (found.length) { bad += found.length; console.log('KO', who, path, JSON.stringify(found)) } else console.log('OK', who, path)
  }
  await ctx.close()
}
await browser.close()
console.log(bad ? `${bad} champ(s) invisible(s)` : 'aucun champ invisible')
process.exit(bad ? 1 : 0)
