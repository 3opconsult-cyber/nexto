// Contrôle de lecture des vidéos courtes (23/11/2026) : rend chaque page avec Chromium (Playwright) en 390 x 844, avance le temps de 0,1 s en 0,1 s
// (PING_ANIM.seek, rendu déterministe) et mesure, pour CHAQUE texte du dessin :
//   - la durée pendant laquelle il est lisible (opacité effective >= 50 %, dans l'écran, voile de jonction < 50 %) ;
//   - son seuil de lecture : 1 s + max(mots / 2,5 ; signes / 17) ;
// les messages (groupes data-msg) sont mesurés en bloc (toutes les lignes) et doivent laisser 0,6 s de respiration avant le message suivant ;
// le doigt (calque #finger) doit être sur sa cible 0,8 s avant chaque toucher et y rester 0,4 s après, sans autre action pendant 1,2 s.
// Usage : node brand/anim-courte/audit.mjs [dossier de sortie]   (depuis la racine du dépôt ; nécessite Playwright et les pages générées)
// Sortie : tableau Markdown sur la sortie standard ; code de sortie 1 si un texte est sous son seuil.
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const PAGES = [['client', 'animation-courte-client'], ['prestataire', 'animation-courte-prestataire']]
const STEP = 0.1
const words = s => s.split(/\s+/).filter(w => /[A-Za-z0-9À-ÿ]/.test(w)).length
const thr = s => 1 + Math.max(words(s) / 2.5, s.length / 17)
const fmt = x => x.toFixed(2).replace('.', ',')

const browser = await chromium.launch()
let bad = 0
for (const [label, page] of PAGES) {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errs = []
  p.on('pageerror', e => errs.push(e.message))
  await p.goto('file://' + path.join(ROOT, 'public', page + '.html') + '?autoplay=0')
  await p.waitForFunction(() => window.PING_ANIM && window.PING_ANIM.ready, null, { timeout: 15000 })
  const dbg = await p.evaluate(() => ({ total: window.PING_DBG.total, scenes: window.PING_DBG.scenes }))
  const samples = []
  for (let t = 0; t <= dbg.total - 0.001; t += STEP) {
    const r = await p.evaluate(x => {
      window.PING_ANIM.seek(x)
      const svg = document.getElementById('svg'), sb = svg.getBoundingClientRect(), out = []
      const eff = n => { let o = 1; for (let e = n; e && e !== svg.parentNode; e = e.parentNode) { if (e.getAttribute && e.getAttribute('display') === 'none') return 0; const a = e.getAttribute && e.getAttribute('opacity'); if (a != null) o *= parseFloat(a) } return o }
      const dip = parseFloat(document.getElementById('dip').getAttribute('opacity') || 0)
      svg.querySelectorAll('text').forEach((n, i) => {
        const b = n.getBoundingClientRect(), o = eff(n)
        const inside = b.width > 0 && b.right > sb.left + 2 && b.left < sb.right - 2 && b.bottom > sb.top + 2 && b.top < sb.bottom - 2
        let g = n.closest('[data-msg]')
        out.push({ i, txt: n.textContent, o: inside ? o * (dip > 0.5 ? 0 : 1) : 0, msg: g ? g.getAttribute('data-msg') : null, px: parseFloat(getComputedStyle(n).fontSize) * (sb.width / 540) })
      })
      const f = document.getElementById('finger'), tm = (f.getAttribute('transform') || '').match(/translate\(([-\d.]+),([-\d.]+)\)/)
      return { texts: out, finger: { o: parseFloat(f.getAttribute('opacity') || 0), x: tm ? +tm[1] : null, y: tm ? +tm[2] : null } }
    }, t)
    samples.push({ t, ...r })
  }
  // 1. chaque texte : plus longue plage continue
  const runs = new Map()
  samples.forEach(s => s.texts.forEach(x => {
    if (!x.txt.trim()) return
    const key = x.i + '|' + x.txt, vis = x.o >= 0.5
    let R = runs.get(key); if (!R) { R = { txt: x.txt, msg: x.msg, i: x.i, runs: [], cur: null, px: x.px }; runs.set(key, R) }
    if (vis) { if (!R.cur) { R.cur = { a: s.t, b: s.t + STEP }; R.runs.push(R.cur) } else R.cur.b = s.t + STEP } else R.cur = null
  }))
  // 2. messages : groupe = lignes qui partagent data-msg
  const groups = new Map()
  for (const R of runs.values()) if (R.msg) { if (!groups.has(R.msg)) groups.set(R.msg, []); groups.get(R.msg).push(R) }
  const rows = []
  const sceneOf = t => dbg.scenes.findIndex(s => t >= s.t0 && t < s.t0 + s.d)
  const msgRows = []
  for (const [id, list] of groups) {
    const lines = list.sort((a, b) => a.i - b.i), txt = lines.map(l => l.txt).join(' ')
    let best = null
    for (const r0 of lines[0].runs) {   // plage où toutes les lignes sont visibles ensemble
      let a = r0.a, b = r0.b
      for (const l of lines.slice(1)) { const m = l.runs.find(r => r.a < b && r.b > a); if (!m) { a = b = 0; break } a = Math.max(a, m.a); b = Math.min(b, m.b) }
      if (b > a && (!best || b - a > best.b - best.a)) best = { a, b }
    }
    const th = thr(txt), vis = best ? best.b - best.a : 0
    msgRows.push({ id, txt, a: best ? best.a : 0, vis, th, sc: id.split('-')[0] })
  }
  msgRows.sort((a, b) => a.a - b.a)
  const out = []
  out.push(`### ${label} : ${dbg.total.toFixed(1).replace('.', ',')} s, ${dbg.scenes.length} scènes (mesuré en Chromium 390 x 844, pas de 0,1 s)`)
  out.push('')
  out.push('| Scène | Début (s) | Durée (s) | Messages à l\'écran | Mots | Lisible (s) / seuil (s) | Verdict |')
  out.push('|---|---|---|---|---|---|---|')
  dbg.scenes.forEach((s, k) => {
    const ms = msgRows.filter(m => m.sc === s.id)
    const w = ms.reduce((n, m) => n + words(m.txt), 0)
    const ok = ms.every(m => m.vis >= m.th - 0.05)
    if (!ok) bad++
    out.push(`| ${k + 1}. ${s.id} | ${fmt(s.t0)} | ${fmt(s.d)} | ${ms.map(m => '« ' + m.txt + ' »').join(' puis ') || 'aucun'} | ${w} | ${ms.map(m => fmt(m.vis) + ' / ' + fmt(m.th)).join(' ; ')} | ${ok ? 'ok' : '**SOUS LE SEUIL**'} |`)
    // respiration entre messages d'une même scène
    for (let q = 1; q < ms.length; q++) { const gap = ms[q].a - (ms[q - 1].a + ms[q - 1].th); if (gap < 0.6 - 0.12) { bad++; out.push(`| | | | respiration insuffisante entre « ${ms[q - 1].txt} » et « ${ms[q].txt} » : ${fmt(gap)} s | | | **A CORRIGER** |`) } }
  })
  out.push('')
  // 3. textes isolés (interface dessinée, étiquettes) : hors messages
  const low = []
  let n = 0
  for (const R of runs.values()) {
    if (R.msg || !R.runs.length) continue
    n++
    const best = R.runs.reduce((m, r) => Math.max(m, r.b - r.a), 0), th = thr(R.txt)
    if (best < th - 0.05) low.push(`« ${R.txt} » ${fmt(best)} s pour ${fmt(th)} s`)
    if (R.px < 11.5 && best > 0) low.push(`« ${R.txt} » taille ${R.px.toFixed(1)} px (< 11,5)`)
  }
  out.push(`Textes hors messages (étiquettes, interface dessinée) : ${n} mesurés, ${low.length} sous le seuil ou trop petits.${low.length ? ' Détail : ' + low.join(' ; ') : ''}`)
  bad += low.length
  const small = []
  for (const R of runs.values()) if (R.px < 11.5 && R.runs.length) small.push(R)
  // 4. doigt
  out.push('')
  out.push('| Toucher | Scène | À (s) | Doigt sur la cible à T-0,8 s | à T-0,4 s | à T+0,4 s | Résultat laissé (s) avant la scène suivante ou le toucher suivant |')
  out.push('|---|---|---|---|---|---|---|')
  const at = t => samples[Math.min(samples.length - 1, Math.max(0, Math.round(t / STEP)))].finger
  dbg.scenes.forEach(s => s.taps.forEach((tp, k) => {
    const [T, x, y] = tp, g = s.t0 + T
    const near = f => f.o >= 0.9 && Math.hypot(f.x - x, f.y - y) <= 6
    const a = near(at(g - 0.8)), b = near(at(g - 0.4)), c = near(at(g + 0.4)) || Math.hypot(at(g + 0.4).x - x, at(g + 0.4).y - y) < 40
    const nxt = s.taps[k + 1] ? s.taps[k + 1][0] : s.d, after = nxt - T
    const ok = a && b && c && after >= 1.2 + 0.0
    if (!ok) bad++
    out.push(`| ${k + 1} | ${s.id} | ${fmt(T)} | ${a ? 'oui' : '**non**'} | ${b ? 'oui' : '**non**'} | ${c ? 'oui' : '**non**'} | ${fmt(after)} ${ok ? '' : '**A CORRIGER**'} |`)
  }))
  out.push('')
  out.push(errs.length ? 'Erreurs JavaScript : ' + errs.join(' | ') : 'Aucune erreur JavaScript.')
  out.push('')
  console.log(out.join('\n'))
  await p.close()
}
await browser.close()
console.log(bad ? `RESULTAT : ${bad} point(s) à corriger` : 'RESULTAT : zéro texte sous le seuil, doigt conforme')
process.exit(bad ? 1 : 0)
