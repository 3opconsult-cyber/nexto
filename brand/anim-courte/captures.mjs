// Captures de contrôle des vidéos courtes : une image toutes les 2 s, en 390 x 844 (téléphone) et 1280 x 720 (ordinateur), page entière.
// Usage : node brand/anim-courte/captures.mjs [dossier de sortie, défaut docs/animations-2026-11-23]   (depuis la racine du dépôt)
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const OUT = path.resolve(process.argv[2] || 'docs/animations-2026-11-23')
fs.mkdirSync(OUT, { recursive: true })
const PAGES = [['client', 'animation-courte-client'], ['prestataire', 'animation-courte-prestataire']]
const VIEWS = [[390, 844], [1280, 720]]
const browser = await chromium.launch()
for (const [label, page] of PAGES) {
  for (const [w, h] of VIEWS) {
    const p = await browser.newPage({ viewport: { width: w, height: h } })
    await p.goto('file://' + path.resolve('public', page + '.html') + '?autoplay=0')
    await p.waitForFunction(() => window.PING_ANIM && window.PING_ANIM.ready, null, { timeout: 15000 })
    const total = await p.evaluate(() => window.PING_ANIM.duration)
    for (let t = 0; t < total; t += 2) {
      await p.evaluate(x => window.PING_ANIM.seek(x), t)
      await p.screenshot({ path: path.join(OUT, `${label}-${w}-${String(t).padStart(2, '0')}s.jpg`), type: 'jpeg', quality: 80 })
    }
    await p.close()
  }
}
await browser.close()
console.log('captures écrites dans', OUT)
