// Onglet « Factures » de l'agenda (24/11/2026), mobile 390x844, comptes audit prestataire puis client. LECTURE SEULE.
// Vérifie : la facture du prestataire précède les frais PING (repliés), aucune donnée de la commission de l'autre
// partie, les 3 actions (Voir, Imprimer, Envoyer) sur chaque document, feuille « Envoyer » (e-mail, WhatsApp,
// comptable, lien) sans téléphone ni adresse, résumé annuel par prestataire côté client, cibles >= 44 px, texte >= 15 px.
// Captures : docs/refonte-factures-2026-11-24/apres-*.jpg
//   BASE=http://localhost:3000 node scripts/e2e/factures-liste.mjs
import { chromium } from 'playwright'
import fs from 'fs'

const BASE = process.env.BASE || 'https://nexto-eta.vercel.app'
const PWD = process.env.AUDIT_PWD || fs.readFileSync(new URL('./parcours.mjs', import.meta.url), 'utf8').match(/PWD = '([^']+)'/)[1]
const OUT = new URL('../../docs/refonte-factures-2026-11-24/', import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })
let ko = 0
const check = (k, v, ok) => { if (!ok) ko++; console.log(ok ? 'OK' : 'KO', k, typeof v === 'string' ? v : JSON.stringify(v)); return ok }
const browser = await chromium.launch()
try {
  for (const [who, email, mode] of [['pro', 'audit.pro.claude@ping-demo.invalid', 'pro'], ['client', 'audit.client.claude@ping-demo.invalid', 'particulier']]) {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR' })
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 120)))
    await p.goto(BASE + '/auth/login', { waitUntil: 'networkidle' })
    await p.locator('input[type=email]').fill(email); await p.locator('input[type=password]').fill(PWD)
    await p.locator('button[type=submit]').first().click(); await p.waitForTimeout(3500)
    await p.evaluate(m => { localStorage.setItem('ping_mode', m); sessionStorage.removeItem('ping_agenda_tab') }, mode)
    await p.goto(BASE + '/agenda?onglet=factures', { waitUntil: 'networkidle' })
    await p.locator('[data-factures-list]').waitFor({ timeout: 20000 }); await p.waitForTimeout(2500)
    await p.screenshot({ path: `${OUT}apres-factures-${who}.jpg`, type: 'jpeg', quality: 70 })

    const mainTitle = who === 'pro' ? 'Factures de mes clients' : 'Factures de mes prestataires'
    check(`${who} : section « ${mainTitle} »`, '', await p.getByRole('heading', { name: mainTitle }).count() === 1)
    const pingBtn = p.getByRole('button', { name: /^Frais PING/ })
    check(`${who} : « Frais PING » replié par défaut`, '', await pingBtn.count() === 1 && (await pingBtn.getAttribute('aria-expanded')) === 'false')
    const before = await p.locator('li[data-kind]').evaluateAll(l => l.map(e => e.getAttribute('data-kind')))
    check(`${who} : avant dépliage, seulement des documents du prestataire`, before.length, before.length > 0 && before.every(k => k === 'prestation'))
    await pingBtn.click(); await p.waitForTimeout(500)
    const kinds = await p.locator('li[data-kind]').evaluateAll(l => l.map(e => e.getAttribute('data-kind')))
    const firstPing = kinds.findIndex(k => k !== 'prestation'), lastPrest = kinds.lastIndexOf('prestation')
    check(`${who} : la facture du prestataire précède les frais PING`, { firstPing, lastPrest }, firstPing > lastPrest && lastPrest >= 0)
    const mine = who === 'pro' ? 'commission_pro' : 'commission_client', other = who === 'pro' ? 'commission_client' : 'commission_pro'
    check(`${who} : frais PING = SA commission seulement`, [...new Set(kinds)], kinds.includes(mine) && !kinds.includes(other))
    const txt = (await p.locator('body').innerText()).replace(/\s+/g, ' ')
    check(`${who} : aucun numéro de la commission de l'autre partie`, '', who === 'pro' ? !/PING-C-/.test(txt) : !/PING-V-/.test(txt))
    const acts = await p.locator('li[data-kind]').evaluateAll(l => l.map(e => [...e.querySelectorAll('button')].map(b => b.innerText.trim()).join('|')))
    check(`${who} : 3 actions sur chaque document`, acts[0], acts.length > 0 && acts.every(a => a === 'Voir|Imprimer|Envoyer'))
    const petits = await p.evaluate(() => [...document.querySelectorAll('[data-factures-list] button')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && Math.min(r.width, r.height) < 43.5 }).map(e => e.innerText.trim().slice(0, 20)))
    check(`${who} : cibles >= 44 px`, petits, petits.length === 0)
    const fins = await p.evaluate(() => [...document.querySelectorAll('[data-factures-list] *')].filter(e => e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 15).map(e => e.textContent.trim().slice(0, 20)))
    check(`${who} : texte >= 15 px`, fins.slice(0, 5), fins.length === 0)
    await p.locator('section[aria-label="Frais PING"]').screenshot({ path: `${OUT}apres-frais-ping-${who}.jpg`, type: 'jpeg', quality: 70 })

    // Feuille « Envoyer » de la première facture : ouverte puis fermée, rien n'est envoyé.
    await p.locator('li[data-kind="prestation"]').first().getByRole('button', { name: /^Envoyer/ }).click(); await p.waitForTimeout(600)
    const dlg = p.getByRole('dialog')
    const sheet = (await dlg.innerText()).replace(/\s+/g, ' ')
    check(`${who} : feuille Envoyer (e-mail, WhatsApp, comptable, lien)`, '', /E-mail/.test(sheet) && /WhatsApp/.test(sheet) && /Envoyer à mon comptable/.test(sheet) && /Copier le lien/.test(sheet))
    check(`${who} : texte envoyé sans téléphone ni adresse`, '', !/(\+33|\b0[1-9])([ .]?\d{2}){4}/.test(sheet) && !/\brue\b|avenue|boulevard|chemin/i.test(sheet))
    await p.screenshot({ path: `${OUT}apres-envoyer-${who}.jpg`, type: 'jpeg', quality: 70 })
    await dlg.getByRole('button', { name: 'Fermer' }).click(); await p.waitForTimeout(300)

    if (who === 'pro') {
      check('pro : relevé annuel en haut (Exporter, Partager)', '', await p.locator('section[aria-label="Relevé annuel"]').count() === 1 && await p.getByRole('button', { name: /^Exporter/ }).count() === 1)
    } else {
      const r = p.locator('#resume-annuel')
      check('client : résumé annuel par prestataire', '', await r.count() === 1)
      await r.getByRole('button', { name: /détail par prestataire/ }).click(); await p.waitForTimeout(400)
      const rows = await r.locator('tbody tr').count()
      const rt = (await r.innerText()).replace(/\s+/g, ' ')
      check('client : tableau par prestataire (lignes + total)', rows, rows >= 2)
      check('client : export CSV et partage', '', await r.getByRole('button', { name: /Exporter \(CSV\)/ }).count() === 1 && await r.getByRole('button', { name: /Partager/ }).count() === 1)
      check('client : déclaratif, jamais « certifié » ni « garanti »', '', /déclaratif/i.test(rt) && !/certifi|garanti/i.test(rt))
      await r.screenshot({ path: `${OUT}apres-resume-annuel-client.jpg`, type: 'jpeg', quality: 70 })
    }
    check(`${who} : erreurs de page`, errs, errs.length === 0)
    await p.screenshot({ path: `${OUT}apres-factures-${who}-long.jpg`, type: 'jpeg', quality: 60, fullPage: true })
    await c.close()
  }
} finally { await browser.close() }
console.log(ko ? `FACTURES-LISTE : ${ko} KO` : 'FACTURES-LISTE : tout OK')
process.exit(ko ? 1 : 0)
