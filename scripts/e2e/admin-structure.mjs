// Structure du premier ecran de l'admin (Vue d'ensemble) : comptage dans le HTML STATIQUE, JavaScript coupe.
// Aucun compte admin, aucune donnee : ce n'est PAS un rendu reel (les chiffres sont des « — »), seulement le nombre d'elements.
// Usage : node scripts/e2e/admin-structure.mjs <fichier.html> <etiquette>   (ecrit docs/refonte-comptes-2026-11-23/passe2/admin-<etiquette>-<largeur>.png)
import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs'
const file = path.resolve(process.argv[2] || 'public/admin.html')
const tag = process.argv[3] || 'apres'
const OUT = new URL('../../docs/refonte-comptes-2026-11-23/passe2/', import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })
const measure = () => {
  const vh = window.innerHeight
  const vis = el => { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  let mots = 0, motsPage = 0
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n
  while ((n = w.nextNode())) {
    const t = n.textContent.trim(); if (!t) continue
    const p = n.parentElement; if (!p || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(p.tagName) || !vis(p)) continue
    // l'aside de navigation est identique avant / apres : on ne compte que la zone principale (barre de titre + contenu)
    if (!p.closest('main.main')) continue
    const k = t.split(/\s+/).length
    motsPage += k
    const rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect()
    if (r.top < vh && r.bottom > 0) mots += k
  }
  const sel = 'button, a[href], [onclick], input:not([type=hidden]), select, textarea'
  const els = [...document.querySelectorAll('main.main ' + sel.split(', ').join(', main.main '))].filter(vis)
  const inView = els.filter(e => { const r = e.getBoundingClientRect(); return r.top < vh && r.bottom > 0 })
  const all = [...document.querySelectorAll('main.main #s_overview *')].filter(vis)
  const ov = document.getElementById('s_overview').getBoundingClientRect()
  const todo = document.getElementById('ovTodoNow').getBoundingClientRect()
  const top = document.querySelector('main.main .top').getBoundingClientRect()
  // Tout ce qui precede la carte « Derniers inscrits » (haut de la page : titre, A traiter, profils, activite, chiffres cles).
  const anchor = document.getElementById('ovSignupsBody').closest('.card').getBoundingClientRect().top + window.scrollY
  let motsAvant = 0
  const w2 = document.createTreeWalker(document.querySelector('main.main'), NodeFilter.SHOW_TEXT)
  let m
  while ((m = w2.nextNode())) {
    const t = m.textContent.trim(); if (!t) continue
    const p = m.parentElement; if (!p || ['SCRIPT', 'STYLE'].includes(p.tagName) || !vis(p)) continue
    const rg = document.createRange(); rg.selectNodeContents(m); if (rg.getBoundingClientRect().top + window.scrollY < anchor) motsAvant += t.split(/\s+/).length
  }
  const clicAvant = els.filter(e => e.getBoundingClientRect().top + window.scrollY < anchor).length
  return { avantDerniersInscrits: { mots: motsAvant, cliquables: clicAvant, hauteurPx: Math.round(anchor) }, motsEcran: mots, motsPage, cliquablesEcran: inView.length, cliquablesPage: els.length, elementsVueEnsemble: all.length, hauteurBarreTitre: Math.round(top.height), hauteurAtraiter: Math.round(todo.height), debutAtraiter: Math.round(todo.top), hauteurVueEnsemble: Math.round(ov.height) }
}
const browser = await chromium.launch()
const res = {}
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, javaScriptEnabled: false, locale: 'fr-FR' })
  const page = await ctx.newPage()
  await page.goto('file://' + file, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  // JS coupe : la page garde sa structure de depart, sections masquees par la classe .section.on
  res[w] = await page.evaluate(measure)
  await page.screenshot({ path: path.join(OUT, `admin-${tag}-${w}.png`) })
  await ctx.close()
}
await browser.close()
console.log(tag, JSON.stringify(res, null, 1))
