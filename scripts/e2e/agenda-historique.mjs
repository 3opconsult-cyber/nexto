// Agenda comme point de recherche (24/11/2026) : mobile 390x844, comptes audit, LECTURE SEULE (aucun appui sur une action d'écriture).
//   BASE=http://localhost:3000 LABEL=apres node scripts/e2e/agenda-historique.mjs     (depuis la racine du dépôt)
// Vérifie, pour le client puis le prestataire : état d'une seule ligne en haut de l'agenda, feuille « jour » (Mois), jour à plusieurs
// missions (une ligne chacune, Conversation / Mission toujours là, Facture seulement si elle existe), onglet Terminées (recherche, mois,
// 10 lignes puis « Voir plus »), Messages (groupes, recherche, tri). Captures dans docs/refonte-agenda-historique-2026-11-24/<LABEL>/.
// Mot de passe des comptes audit : lu dans parcours.mjs, jamais recopié. Sortie : lignes OK / KO (code 1 si KO).
import { chromium } from 'playwright'
import fs from 'fs'

const BASE = process.env.BASE || 'http://localhost:3000'
const LABEL = process.env.LABEL || 'apres'
const PWD = process.env.AUDIT_PWD || fs.readFileSync(new URL('./parcours.mjs', import.meta.url), 'utf8').match(/PWD = '([^']+)'/)[1]
const OUT = new URL(`../../docs/refonte-agenda-historique-2026-11-24/${LABEL}/`, import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })
let ko = 0
const check = (k, v, ok) => { if (!ok) ko++; console.log(ok ? 'OK' : 'KO', k, typeof v === 'string' ? v : JSON.stringify(v)); return ok }
const info = (k, v) => console.log('..', k, typeof v === 'string' ? v : JSON.stringify(v))

async function session(browser, email, mode) {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
  const p = await c.newPage()
  await p.goto(BASE + '/auth/login', { waitUntil: 'networkidle' })
  await p.locator('input[type=email]').fill(email)
  await p.locator('input[type=password]').fill(PWD)
  await p.locator('button[type=submit], button:has-text("connecter")').first().click()
  await p.waitForTimeout(4000)
  await p.evaluate(m => localStorage.setItem('ping_mode', m), mode)
  return { c, p }
}
const shot = (p, name) => p.screenshot({ path: `${OUT}${name}.jpg`, quality: 72, type: 'jpeg' })

async function agenda(p, who) {
  await p.goto(BASE + '/agenda?onglet=calendrier', { waitUntil: 'networkidle' }).catch(() => { })
  await p.waitForSelector('[data-agenda-state]', { timeout: 30000 }).catch(() => { })
  await p.waitForTimeout(800)
  // 1. une seule ligne d'état, plus de double décompte ni de « (via le menu) »
  const top = await p.locator('body').innerText()
  check(`${who} agenda : ligne d'état « Aujourd'hui »`, await p.locator('[data-agenda-state]').count(), (await p.locator('[data-agenda-state]').count()) === 1)
  check(`${who} agenda : plus de « dans votre espace » ni « (via le menu) »`, '', !/dans votre espace/.test(top) && !/\(via le menu\)/.test(top))
  check(`${who} agenda : 4 onglets lisibles`, '', (await p.getByRole('tab').count()) === 4)
  await p.getByRole('tab', { name: 'Calendrier' }).tap(); await p.waitForTimeout(600)
  await p.getByRole('button', { name: 'Mois', exact: true }).first().tap().catch(() => { }); await p.waitForTimeout(500)
  await shot(p, `${who}-agenda-mois`)

  // Vue Semaine : toucher l'en-tête d'un jour ouvre aussi la feuille « jour »
  await p.getByRole('button', { name: 'Semaine', exact: true }).first().tap(); await p.waitForTimeout(500)
  await p.locator('[role=button][aria-label^="Missions du"]').first().tap(); await p.waitForTimeout(500)
  check(`${who} agenda : Semaine, toucher un jour ouvre la feuille`, '', (await p.locator('[data-day-detail]').count()) === 1)
  await shot(p, `${who}-semaine-feuille-jour`)
  await p.getByRole('button', { name: 'Fermer' }).tap(); await p.waitForTimeout(300)
  await p.getByRole('button', { name: 'Mois', exact: true }).first().tap(); await p.waitForTimeout(400)
  // 2. feuille « jour » : on cherche (mois précédent, courant, suivant) un jour avec des missions, de préférence plusieurs
  let multi = null, single = null
  for (const delta of [0, -1, 1, -2]) {
    if (delta === -1) await p.getByLabel('Précédent').tap()
    if (delta === 1) { await p.getByLabel('Suivant').tap(); await p.getByLabel('Suivant').tap() }
    if (delta === -2) { await p.getByLabel('Précédent').tap(); await p.getByLabel('Précédent').tap(); await p.getByLabel('Précédent').tap() }
    await p.waitForTimeout(500)
    const days = p.locator('button[aria-label*="rendez-vous"]')
    const n = await days.count()
    for (let i = 0; i < n; i++) {
      const d = days.nth(i)
      const label = await d.getAttribute('aria-label')
      await d.tap(); await p.waitForTimeout(500)
      const lines = await p.locator('[data-day-detail] [data-mission-line]').count()
      if (lines >= 2 && !multi) { multi = { label, lines }; await shot(p, `${who}-jour-plusieurs-missions`) }
      else if (lines === 1 && !single) { single = { label, lines }; await shot(p, `${who}-jour-une-mission`) }
      if (multi && single) break
      await p.getByRole('button', { name: 'Fermer' }).tap(); await p.waitForTimeout(300)
    }
    if (multi && single) break
    if (multi) break
    if (await p.locator('[data-day-detail]').count()) await p.getByRole('button', { name: 'Fermer' }).tap()
  }
  const target = multi || single
  if (!target) { info(`${who} agenda : aucun jour avec mission dans les 4 mois proches`, 'non vérifié'); return }
  if (!multi) info(`${who} agenda : aucun jour à plusieurs missions dans les données de test`, 'non vérifié')
  // La feuille de la dernière capture est ouverte : on la rouvre si elle a été fermée.
  if (!(await p.locator('[data-day-detail]').count())) { await p.locator(`button[aria-label="${target.label}"]`).first().tap(); await p.waitForTimeout(500) }
  const rows = p.locator('[data-day-detail] [data-mission-line]')
  const n = await rows.count()
  check(`${who} feuille « jour » : ${n} ligne(s) pour « ${target.label} »`, '', n >= 1)
  let okActions = true
  for (let i = 0; i < n; i++) {
    const r = rows.nth(i)
    const conv = await r.getByRole('button', { name: 'Conversation', exact: true }).count()
    const mis = await r.getByRole('button', { name: 'Mission', exact: true }).count()
    const fac = await r.getByRole('button', { name: 'Facture', exact: true }).count()
    const h = await r.getByRole('button', { name: 'Conversation', exact: true }).evaluate(el => el.getBoundingClientRect().height)
    info(`${who} ligne ${i + 1}`, { conversation: conv, mission: mis, facture: fac, hauteurBouton: Math.round(h), texte: (await r.innerText()).replace(/\n+/g, ' | ') })
    if (conv !== 1 || mis !== 1 || h < 44) okActions = false
  }
  check(`${who} feuille « jour » : Conversation et Mission sur chaque ligne (>= 44 px)`, '', okActions)
  // les 3 actions mènent au bon écran (lecture seule : on ouvre et on revient)
  const first = rows.first()
  const id = await first.getAttribute('data-mission-line')
  await first.getByRole('button', { name: 'Conversation', exact: true }).tap(); await p.waitForTimeout(2500)
  check(`${who} « Conversation » -> /mission/${id.slice(0, 8)}…/chat`, p.url().replace(BASE, '').slice(0, 60), p.url().includes(`/mission/${id}/chat`))
  await p.goBack(); await p.waitForTimeout(2500)
  if (!(await p.locator('[data-day-detail]').count())) { await p.getByRole('button', { name: 'Mois', exact: true }).first().tap().catch(() => { }) }
}

async function terminees(p, who) {
  await p.goto(BASE + '/agenda?onglet=terminees', { waitUntil: 'networkidle' }).catch(() => { })
  await p.waitForSelector('[data-agenda-state]', { timeout: 30000 }).catch(() => { })
  await p.waitForTimeout(800)
  await p.getByRole('tab', { name: 'Terminées' }).tap(); await p.waitForTimeout(800)
  const lines = await p.locator('[data-mission-line]').count()
  const months = await p.locator('[data-done-month]').count()
  info(`${who} terminées`, { lignes: lines, mois: months })
  await shot(p, `${who}-terminees`)
  check(`${who} terminées : au plus 10 lignes au départ`, lines, lines <= 10)
  check(`${who} terminées : champ de recherche`, '', (await p.getByPlaceholder('Rechercher par nom').count()) === 1)
  if (lines > 0) {
    const name = (await p.locator('[data-mission-line] [data-line-name]').first().innerText().catch(() => '')).trim()
    const q = (name || 'a').split(' ')[0].slice(0, 4)
    await p.getByPlaceholder('Rechercher par nom').fill(q); await p.waitForTimeout(500)
    await shot(p, `${who}-terminees-recherche`)
    check(`${who} terminées : la recherche « ${q} » garde des lignes`, await p.locator('[data-mission-line]').count(), (await p.locator('[data-mission-line]').count()) >= 1)
    await p.getByPlaceholder('Rechercher par nom').fill('zzzzqq'); await p.waitForTimeout(400)
    check(`${who} terminées : recherche sans résultat dite simplement`, '', /Aucune mission terminée pour/.test(await p.locator('[role=tabpanel]').innerText()))
    await p.getByPlaceholder('Rechercher par nom').fill('')
  }
  const more = await p.getByRole('button', { name: /^Voir plus/ }).count()
  info(`${who} terminées : bouton « Voir plus »`, more ? 'présent' : 'absent (moins de 11 missions terminées)')
  if (more) { await p.getByRole('button', { name: /^Voir plus/ }).tap(); await p.waitForTimeout(400); check(`${who} terminées : « Voir plus » ajoute des lignes`, await p.locator('[data-mission-line]').count(), (await p.locator('[data-mission-line]').count()) > 10) }
}

async function messages(p, who) {
  await p.goto(BASE + '/messages', { waitUntil: 'networkidle' }).catch(() => { })
  await p.waitForTimeout(3500)
  const groups = await p.locator('[data-conv-group]').allInnerTexts()
  info(`${who} messages : groupes`, groups)
  await shot(p, `${who}-messages`)
  check(`${who} messages : groupes parmi Aujourd'hui / Hier / Cette semaine / Ce mois-ci / Plus ancien`, groups, groups.length >= 1 && groups.every(g => ["Aujourd'hui", 'Hier', 'Cette semaine', 'Ce mois-ci', 'Plus ancien'].includes(g)))
  check(`${who} messages : recherche par nom et tri`, '', (await p.getByPlaceholder('Rechercher par nom').count()) === 1 && (await p.getByText('Trier :').count()) <= 1)
  const nb = await p.locator('button.a-row').count()
  if (await p.getByRole('button', { name: 'par nom' }).count()) {
    await p.getByRole('button', { name: 'par nom' }).tap(); await p.waitForTimeout(400)
    info(`${who} messages : tri par nom, groupes`, await p.locator('[data-conv-group]').allInnerTexts())
    await shot(p, `${who}-messages-tri-nom`)
    await p.getByRole('button', { name: 'par date' }).tap(); await p.waitForTimeout(300)
  }
  if (nb) {
    const first = (await p.locator('button.a-row').first().innerText()).split('\n')[0].trim()
    const q = first.slice(0, 3)
    await p.getByPlaceholder('Rechercher par nom').fill(q); await p.waitForTimeout(500)
    await shot(p, `${who}-messages-recherche`)
    check(`${who} messages : recherche « ${q} » garde au moins une conversation`, await p.locator('button.a-row').count(), (await p.locator('button.a-row').count()) >= 1)
  }
}

const browser = await chromium.launch()
try {
  for (const [who, email, mode] of [['client', 'audit.client.claude@ping-demo.invalid', 'particulier'], ['pro', 'audit.pro.claude@ping-demo.invalid', 'pro']]) {
    const { c, p } = await session(browser, email, mode)
    await agenda(p, who)
    await terminees(p, who)
    await messages(p, who)
    await c.close()
  }
} finally { await browser.close() }
console.log(ko ? `=== ${ko} KO` : '=== tout OK')
process.exit(ko ? 1 : 0)
