// Audit par scénario sur la prod : visite chaque écran comme un vrai utilisateur, relève erreurs JS,
// requêtes Supabase en échec, textes suspects, et un extrait du contenu. Usage : node audit.mjs client|pro
import { chromium } from 'playwright'
import fs from 'fs'
const B = 'https://nexto-eta.vercel.app'
const who = process.argv[2]
const ACC = { client: 'audit.client.claude@ping-demo.invalid', pro: 'audit.pro.claude@ping-demo.invalid' }
const PRO_ID = 'b9f8cd9a-16de-4a36-afd8-10a2135ab970'
const M = { done: '3ecb9d28-693b-4ed6-84f5-f0cdbbc882e6', done2: '828ee61f-5571-40ad-9ef1-73fefcae5a4d', soon: 'eb623c2e-ba46-44aa-bcf7-e4c0739edfe1', live: 'f7097ba6-63b7-42ff-823d-b960e972debe', cancel: '13f97528-99e8-467d-9b3e-b390789b3224', dispute: 'a5fcd6df-1322-4b1b-84d9-1b4aabcc3876', nego: '145ea246-5190-43d6-86d8-f553015b365b', negoR: '1a055b1e-adbf-4a88-a8e6-8b772f258fe2', doneR: '0dd6ab09-5e28-43ed-8a68-9d35b73593f7', gone: '5158e473-c0c1-4e32-828b-7cfcdbf1e7a9' }
const out = []
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
const p = await ctx.newPage()
let errs = []
p.on('pageerror', e => errs.push('JS: ' + e.message.slice(0, 160)))
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 160)) })
p.on('response', r => { const u = r.url(); if (r.status() >= 400 && (/supabase|\/api\//.test(u))) errs.push(r.status() + ' ' + r.request().method() + ' ' + u.replace(/https:\/\/[^/]+/, '').slice(0, 150)) })
const SUS = /undefined|NaN|Invalid Date|\bnull\b|Erreur|impossible|Application error|introuvable|n’ont pas pu|n'ont pas pu|Réessayez/i
async function visit(label, path, act) {
  errs = []
  try {
    await p.goto(B + path, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await p.waitForTimeout(4500)
    if (act) { try { await act() } catch (e) { errs.push('ACT: ' + e.message.slice(0, 140)) } await p.waitForTimeout(1500) }
  } catch (e) { errs.push('NAV: ' + e.message.slice(0, 140)) }
  const txt = (await p.evaluate(() => document.body.innerText).catch(() => '')).replace(/\s+/g, ' ').trim()
  const sus = (txt.match(new RegExp('.{0,50}(' + SUS.source + ').{0,50}', 'gi')) || []).slice(0, 4)
  const tab = await p.evaluate(() => !!document.querySelector('.app-bottom-bar')).catch(() => false)
  out.push({ label, path, url: p.url().replace(B, ''), tabbar: tab, errs: [...new Set(errs)].slice(0, 8), sus, text: txt.slice(0, 700) })
}
await p.goto(B + '/auth/login'); await p.fill('input[type=email]', ACC[who]); await p.fill('input[type=password]', 'AuditPing2026!')
await p.click('button[type=submit]'); await p.waitForTimeout(5000)
out.push({ label: 'login', url: p.url().replace(B, '') })
const clickText = t => p.getByText(t, { exact: false }).first().click({ timeout: 4000 })
if (who === 'client') {
  await p.evaluate(() => { localStorage.setItem('ping_mode', 'particulier') })
  await visit('Carte', '/map')
  await visit('Carte - clic 1er pro', '/map', async () => { const pin = p.locator('.leaflet-marker-icon').nth(1); await pin.click({ timeout: 4000 }) })
  await visit('Mes demandes', '/client/demandes')
  await visit('Nouvelle demande - anti-fraude', '/client/demandes/new', async () => {
    const inputs = p.locator('input:not([type=date]):not([type=number])'); await inputs.first().fill('Ménage appelez-moi 06 12 34 56 78')
    await p.locator('textarea').first().fill('Test anti-fraude')
    await clickText('Publier')
  })
  await visit('Messages', '/messages')
  await visit('Agenda', '/agenda')
  await visit('Agenda vue semaine', '/agenda', () => clickText('Semaine'))
  await visit('Agenda vue jour', '/agenda', () => clickText('Jour'))
  await visit('Mes opérations', '/documents')
  await visit('Réclamations', '/litiges')
  await visit('Mon profil', '/client/profil')
  await visit('Mes avis', '/client/avis')
  await visit('Favoris', '/client/favoris')
  await visit('Mes pièces client', '/client/documents')
  await visit('Parrainage', '/client/parrainage')
  await visit('Avance immédiate', '/client/avance-immediate')
  await visit('Fiche pro', '/pro/' + PRO_ID)
  await visit('Réserver (mission/new)', '/mission/new?pro=' + PRO_ID)
  await visit('Chat terminée (forfait+HS)', `/mission/${M.done}/chat`)
  await visit('Facture terminée', `/mission/${M.done}/facture`)
  await visit('Chat terminée R (sans avis?)', `/mission/${M.doneR}/chat`)
  await visit('Chat à venir', `/mission/${M.soon}/chat`)
  await visit('QR à venir', `/mission/${M.soon}/qrcodes`)
  await visit('Chat en cours', `/mission/${M.live}/chat`)
  await visit('Chat annulée', `/mission/${M.cancel}/chat`)
  await visit('Chat litige', `/mission/${M.dispute}/chat`)
  await visit('Chat négociation (contre-offre client)', `/mission/${M.negoR}/chat`)
  await visit('Mission supprimée', `/mission/${M.gone}/facture`)
  await visit('Support', '/support')
} else {
  await p.evaluate(() => { localStorage.setItem('ping_mode', 'pro') })
  await visit('Carte pro', '/pro/carte')
  await visit('Carte pro - 1re demande', '/pro/carte', async () => { await p.locator('div[style*="cursor: pointer"]').filter({ hasText: 'Exemple' }).first().click({ timeout: 4000 }) })
  await visit('Carte pro - Mes interventions', '/pro/carte', () => clickText('Mes interventions'))
  await visit('Mon entreprise', '/pro/dashboard')
  await visit('Tarifs', '/pro/tarifs')
  await visit('Tarifs - ajouter', '/pro/tarifs', () => clickText('Ajouter une prestation'))
  await visit('Disponibilités', '/pro/disponibilites')
  await visit('Disponibilités - clic jour', '/pro/disponibilites', async () => { const d = p.locator('button').filter({ hasText: /^2[0-9]$/ }).first(); await d.click({ timeout: 4000 }) })
  await visit('Revenus', '/pro/revenus')
  await visit('Versements', '/pro/paiements')
  await visit('Mes pièces', '/pro/documents')
  await visit('Onboarding (édition)', '/pro/onboarding')
  await visit('Messages', '/messages')
  await visit('Agenda', '/agenda')
  await visit('Mes opérations', '/documents')
  await visit('Litiges', '/litiges')
  await visit('Chat terminée (noter client)', `/mission/${M.done}/chat`)
  await visit('Facture terminée (pro)', `/mission/${M.done}/facture`)
  await visit('Chat à venir (adresse visible?)', `/mission/${M.soon}/chat`)
  await visit('Chat en cours', `/mission/${M.live}/chat`)
  await visit('Chat négociation (adresse masquée?)', `/mission/${M.nego}/chat`)
  await visit('Chat litige', `/mission/${M.dispute}/chat`)
  await visit('Chat annulée', `/mission/${M.cancel}/chat`)
}
fs.writeFileSync(`audit-${who}.json`, JSON.stringify(out, null, 1))
await b.close()
console.log('OK', out.length)
