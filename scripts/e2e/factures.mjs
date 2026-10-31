// Factures en vrai sur la prod : téléchargement du PDF depuis la mission, partage depuis Mes opérations,
// relevé annuel. Vérifie que chaque fichier reçu est un vrai PDF (ou CSV) non vide.
//   node scripts/e2e/factures.mjs        (Playwright, réseau vers la prod)
import { chromium } from 'playwright'

const B = 'https://nexto-eta.vercel.app'
const MISSION = '3ecb9d28-693b-4ed6-84f5-f0cdbbc882e6' // « Exemple — Grand ménage (forfait + heures sup.) », 150 €
let ok = 0, ko = 0
const check = (c, m) => { c ? ok++ : ko++; console.log((c ? 'OK    ' : 'ECHEC ') + m) }
const b = await chromium.launch()

for (const [who, email, mode] of [['client', 'audit.client.claude@ping-demo.invalid', 'particulier'], ['prestataire', 'audit.pro.claude@ping-demo.invalid', 'pro']]) {
  console.log(`\n=== ${who}`)
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true })
  const p = await ctx.newPage()
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 120)))
  await p.goto(B + '/auth/login'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'AuditPing2026!')
  await p.click('button[type=submit]'); await p.waitForTimeout(4500)
  await p.evaluate(m => { try { localStorage.setItem('ping_mode', m) } catch { } }, mode)

  const grab = async (click, label, kind = 'pdf') => {
    try {
      const [d] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), click()])
      const path = await d.path(); const fs = await import('fs'); const buf = fs.readFileSync(path)
      const good = kind === 'pdf' ? buf.subarray(0, 4).toString() === '%PDF' && buf.length > 1200 : buf.length > 20
      check(good, `${label} : ${d.suggestedFilename()} (${buf.length} octets)`)
    } catch (e) { check(false, `${label} : aucun fichier (${e.message.split('\n')[0]})`) }
  }

  await p.goto(`${B}/mission/${MISSION}/facture`); await p.waitForTimeout(5000)
  const t = (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(/FACT-|RECAP-/.test(t), 'la page Facturation affiche la facture du prestataire')
  check(who === 'client' ? /PING-C-/.test(t) && !/PING-V-/.test(t) : /PING-V-/.test(t) && !/PING-C-/.test(t), 'chacun ne voit que SA commission')
  const btns = p.getByRole('button', { name: 'Télécharger le PDF' })
  check(await btns.count() >= 2, `${await btns.count()} boutons de téléchargement (prestation + commission)`)
  for (let i = 0; i < await btns.count(); i++) await grab(() => btns.nth(i).click(), `PDF n°${i + 1} depuis la mission`)

  await p.goto(`${B}/documents`); await p.waitForTimeout(5000)
  await p.getByText('Partager', { exact: false }).first().click(); await p.waitForTimeout(800)
  const sheet = (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(/WhatsApp/.test(sheet) && /SMS/.test(sheet) && /E-mail|e-mail/.test(sheet), 'la fenêtre de partage propose WhatsApp, SMS, e-mail')
  await grab(() => p.getByText('Télécharger le PDF').last().click(), 'PDF depuis Mes opérations')
  await p.keyboard.press('Escape'); await p.waitForTimeout(400)
  await p.goto(`${B}/documents`); await p.waitForTimeout(5000)
  await grab(() => p.getByText('Télécharger le relevé annuel').first().click(), 'relevé annuel (Urssaf / impôts)', 'any')
  check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''))
  await ctx.close()
}
await b.close()
console.log(`\n${ok} vérifications réussies, ${ko} échecs`)
