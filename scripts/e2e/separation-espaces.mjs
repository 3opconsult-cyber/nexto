// Séparation des espaces particulier / prestataire sur un même compte (règle Romain du 30/10 :
// on change d'espace uniquement depuis le menu, et toute l'interface change avec).
//   node scripts/e2e/separation-espaces.mjs        (Playwright, réseau vers la prod)
// Compte audit.pro : prestataire, ET acheteur d'une mission fictive « Repassage chez moi » auprès de Fictif 2.
import { chromium } from 'playwright'

const B = 'https://nexto-eta.vercel.app'
let ok = 0, ko = 0
const check = (c, m) => { c ? ok++ : ko++; console.log((c ? 'OK    ' : 'ECHEC ') + m) }
const b = await chromium.launch()

for (const [label, viewport] of [['mobile', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 860 }]]) {
  console.log(`\n=== ${label}`)
  const p = await b.newPage({ viewport })
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 120)))
  const text = async () => (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  const tabs = async () => p.evaluate(() => [...document.querySelectorAll('.app-bottom-bar a, .app-bottom-bar button')].map(x => x.innerText.trim()).filter(Boolean).join('/'))
  const nav = async () => p.evaluate(() => [...document.querySelectorAll('.desk-nav .dnav-item')].map(x => x.innerText.trim()).join('/'))
  const go = async u => { await p.goto(B + u); await p.waitForTimeout(4500) }

  await go('/auth/login'); await p.fill('input[type=email]', 'audit.pro.claude@ping-demo.invalid'); await p.fill('input[type=password]', 'AuditPing2026!')
  await p.click('button[type=submit]'); await p.waitForTimeout(4500)

  await go('/pro/carte')
  if (label === 'mobile') check(/Demandes/.test(await tabs()) && /Entreprise/.test(await tabs()), `espace prestataire : barre du bas = ${await tabs()}`)
  else check(/Mon entreprise/.test(await nav()), `espace prestataire : menu = ${await nav()}`)

  await go('/messages'); let t = await text()
  check(/Audit C/.test(t) && !/Fictif 2/.test(t), 'Messages (prestataire) : seulement les clients, pas l’achat personnel')
  check(/dans votre espace particulier/.test(t), 'cloche : signale ce qui attend côté particulier')
  check(!(await p.locator('button', { hasText: /^Particulier$/ }).count()), 'aucun bouton de bascule dans la page')

  // Bascule par le menu : seul chemin autorisé.
  if (label === 'mobile') { await p.locator('.app-burger').first().click(); await p.waitForTimeout(800) }
  await p.locator('text=/mode particulier/i >> visible=true').first().click(); await p.waitForTimeout(4500)
  check(/\/map/.test(p.url()), `la bascule ouvre l’accueil particulier (${p.url().replace(B, '')})`)
  if (label === 'mobile') check(/Carte/.test(await tabs()) && /Profil/.test(await tabs()) && !/Entreprise/.test(await tabs()), `espace particulier : barre du bas = ${await tabs()}`)
  else check(/Mon profil/.test(await nav()) && !/Mon entreprise/.test(await nav()), `espace particulier : menu = ${await nav()}`)

  await go('/messages'); t = await text()
  check(/Fictif 2/.test(t) && !/Audit C\./.test(t), 'Messages (particulier) : seulement l’achat personnel')
  check(/dans votre espace prestataire/.test(t), 'cloche : signale ce qui attend côté prestataire')
  await go('/agenda'); t = await text()
  check(/Fictif 2/.test(t) && !/Audit C\./.test(t), 'Agenda (particulier) : seulement ses propres rendez-vous')
  await go('/documents'); t = await text()
  check(!/Audit Client/.test(t), 'Mes opérations (particulier) : aucune facture émise comme prestataire')

  // Une page de l'espace prestataire remet tout l'espace prestataire.
  await go('/pro/dashboard')
  if (label === 'mobile') check(/Entreprise/.test(await tabs()), `ouvrir Mon entreprise remet l’espace prestataire : ${await tabs()}`)
  else check(/Mon entreprise/.test(await nav()), `ouvrir Mon entreprise remet l’espace prestataire : ${await nav()}`)
  await go('/messages'); t = await text()
  check(/Audit C/.test(t) && !/Fictif 2/.test(t), 'Messages : de nouveau seulement les clients')
  check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''))
  await p.close()
}
await b.close()
console.log(`\n${ok} vérifications réussies, ${ko} échecs`)
