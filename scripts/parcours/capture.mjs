// Parcours navigable (/parcours-navigable) : captures RÉELLES de la prod, côté particulier et côté
// prestataire, avec les comptes de test et leurs missions fictives. Envoie les images et le
// manifeste dans le bucket Supabase public `parcours` ; la page les lit en direct, donc relancer
// ce script suffit à la mettre à jour (aucun déploiement).
//
//   node scripts/parcours/capture.mjs          (Playwright requis, réseau vers la prod et Supabase)
//
// Les identifiants de mission pointent sur les missions « Exemple — … » (voir scripts/demo/factice.mjs).
import { chromium } from 'playwright'

const B = 'https://nexto-eta.vercel.app'
const SB = 'https://wmiawwaxwlvascyflpba.supabase.co'
const KEY = 'sb_publishable_ehRFsNEJD1hnkOyi7vdfEA_NJey8yfP'
const PWD = 'AuditPing2026!'
const CLIENT = 'audit.client.claude@ping-demo.invalid'
const PRO = 'audit.pro.claude@ping-demo.invalid'
const PRO_ID = 'b9f8cd9a-16de-4a36-afd8-10a2135ab970'
const M = {
  done: '3ecb9d28-693b-4ed6-84f5-f0cdbbc882e6', soon: 'eb623c2e-ba46-44aa-bcf7-e4c0739edfe1',
  live: 'f7097ba6-63b7-42ff-823d-b960e972debe', dispute: 'a5fcd6df-1322-4b1b-84d9-1b4aabcc3876',
  nego: '145ea246-5190-43d6-86d8-f553015b365b', negoR: '1a055b1e-adbf-4a88-a8e6-8b772f258fe2',
}
const clickText = (p, t) => p.getByText(t, { exact: false }).first().click({ timeout: 5000 })
const later = async p => { const b = p.getByRole('button', { name: 'Plus tard' }); if (await b.count()) await b.first().click() }

// [id, chapitre, titre, légende, chemin, action?, pleine page?]
const CLIENT_SCREENS = [
  ['c-signup', 'Commencer', 'Inscription', 'Prénom, nom, e-mail : le compte est créé en une minute, puis un e-mail de confirmation.', '/auth/signup', null, false, true],
  ['c-map', 'Trouver', 'La carte', 'Les prestataires disponibles autour de vous, le prix au-dessus de chaque épingle, filtres par service.', '/map'],
  ['c-fiche', 'Trouver', 'Fiche du prestataire', 'Avis, pièces déclarées, un prix par service. Réserver ou contacter.', `/pro/${PRO_ID}`, null, true],
  ['c-reserver', 'Trouver', 'Réserver', 'La formule de prix du prestataire, le créneau, l’adresse : la réservation est confirmée sans aller-retour.', `/mission/new?pro=${PRO_ID}`, null, true],
  ['c-demandes', 'Demander', 'Mes demandes', 'Vos demandes publiées et les propositions reçues, à comparer et accepter.', '/client/demandes'],
  ['c-demande-new', 'Demander', 'Publier une demande', 'Service, date, budget, urgence. Téléphone et e-mail sont refusés dans le texte : tout passe par PING.', '/client/demandes/new', null, true],
  ['c-messages', 'Échanger', 'Messages', 'Toutes vos conversations, triées par date ou par prestataire.', '/messages'],
  ['c-chat-nego', 'Échanger', 'Négocier le prix', 'Proposition du prestataire, contre-proposition : le prix est fixé avant l’intervention, jamais après.', `/mission/${M.negoR}/chat`],
  ['c-chat-avenir', 'Intervention', 'Rendez-vous confirmé', 'Le contrat est validé, le rendez-vous fixé. L’adresse n’est transmise qu’à ce moment-là.', `/mission/${M.soon}/chat`],
  ['c-qrcodes', 'Intervention', 'Codes QR', 'Le prestataire scanne le code d’arrivée puis celui de fin chez vous : la durée réelle fait foi.', `/mission/${M.soon}/qrcodes`, null, true],
  ['c-chat-encours', 'Intervention', 'Intervention en cours', 'Arrivée scannée, le chrono tourne.', `/mission/${M.live}/chat`],
  ['c-avis', 'Après', 'Noter le prestataire', 'Deux critères, recommandation, un mot, un pourboire facultatif.', `/mission/${M.done}/chat?avis`],
  ['c-recap', 'Après', 'Récapitulatif de la mission', 'Contrat accepté, scans, montants, avis, factures : tout le détail de l’opération.', `/mission/${M.done}/chat`, later, true],
  ['c-facture', 'Après', 'La facture', 'Facture du prestataire et vos frais de service PING, émises automatiquement au scan de fin.', `/mission/${M.done}/facture`, null, true],
  ['c-litige', 'Après', 'Réclamation', 'Un souci ? La réclamation s’ouvre depuis la conversation, avec le fil complet.', `/mission/${M.dispute}/chat`, later],
  ['c-agenda', 'Mon espace', 'Agenda', 'Vos rendez-vous en vue mois, semaine ou jour.', '/agenda'],
  ['c-operations', 'Mon espace', 'Mes opérations', 'Factures classées par mois, relevé annuel pour le crédit d’impôt.', '/documents', null, true],
  ['c-partage', 'Mon espace', 'Partager une facture', 'E-mail, WhatsApp, SMS ou téléchargement du PDF.', '/documents', p => clickText(p, 'Partager')],
  ['c-profil', 'Mon espace', 'Mon profil', 'Mon activité, paiements, mon compte : même organisation que l’espace prestataire.', '/client/profil', null, true],
  ['c-avance', 'Mon espace', 'Crédit d’impôt immédiat', 'L’avance immédiate de l’Urssaf : ne payer que 50 % (bientôt).', '/client/avance-immediate', null, true],
]
const PRO_SCREENS = [
  ['p-service', 'Devenir prestataire', 'Inscription prestataire', 'Un écran, une question : services, tarif par service, statut, adresse, pièces.', '/pro/onboarding'],
  ['p-tarif', 'Devenir prestataire', 'Tarif par service', 'Forfait, à l’heure, ou forfait + heures supplémentaires, pour chaque service.', '/pro/onboarding', p => clickText(p, 'Continuer')],
  ['p-carte', 'Trouver des clients', 'Demandes autour de moi', 'Les demandes ouvertes à moins de 25 km, les urgentes en orange et en tête.', '/pro/carte'],
  ['p-demande', 'Trouver des clients', 'Détail d’une demande', 'Distance, date, budget, description. L’adresse exacte reste masquée.', '/pro/carte', p => p.locator('div[style*="cursor: pointer"]').filter({ hasText: 'Exemple' }).first().click({ timeout: 5000 })],
  ['p-interventions', 'Trouver des clients', 'Mes interventions', 'Les missions au tarif validé, avec leur adresse.', '/pro/carte', p => clickText(p, 'Mes interventions')],
  ['p-chat-nego', 'Échanger', 'Proposer un prix', 'Le prestataire propose, le client accepte ou fait une contre-proposition. Adresse masquée tant que rien n’est validé.', `/mission/${M.nego}/chat`],
  ['p-messages', 'Échanger', 'Messages', 'Toutes les conversations clients.', '/messages'],
  ['p-noter', 'Après', 'Noter le client', 'Remarques rapides, avis publié ou note privée, sans pourboire.', `/mission/${M.done}/chat`],
  ['p-mission-detail', 'Après', 'Récapitulatif de la mission', 'Contrat, scans, ce que vous percevez, avis du client avec ses étoiles, factures.', `/mission/${M.done}/chat`, later, true],
  ['p-doc-fact', 'Après', 'Facture émise', 'Facture à votre en-tête et relevé de commission PING.', `/mission/${M.done}/facture`, null, true],
  ['p-dashboard', 'Mon entreprise', 'Mon entreprise', 'Mon activité, prix et revenus, paiements et fiscalité, coordonnées et pièces.', '/pro/dashboard', null, true],
  ['p-tarifs', 'Mon entreprise', 'Mes tarifs', 'Un prix par service, « + Fixer un prix » pour les autres.', '/pro/tarifs', null, true],
  ['p-tarif-edit', 'Mon entreprise', 'Modifier un tarif', 'Forfait, à l’heure, forfait + heures sup.', '/pro/tarifs', p => clickText(p, 'modifier')],
  ['p-dispo', 'Mon entreprise', 'Mes disponibilités', 'Le calendrier : toucher un jour pour ouvrir ses horaires.', '/pro/disponibilites'],
  ['p-dispo-jour', 'Mon entreprise', 'Ouvrir une journée', 'Journée complète ou tranches de 2 h, pour ce jour, toute la semaine ou 4 semaines.', '/pro/disponibilites', p => p.locator('button').filter({ hasText: /^4/ }).last().click({ timeout: 5000 })],
  ['p-agenda', 'Mon entreprise', 'Agenda', 'Rendez-vous et créneaux libres en vue mois, semaine ou jour.', '/agenda'],
  ['p-revenus', 'Mon entreprise', 'Mes revenus', 'Chiffre d’affaires, numéro SAP, déclaration.', '/pro/revenus', null, true],
  ['p-paiements', 'Mon entreprise', 'Versements', 'Compte de versement et prélèvement des commissions.', '/pro/paiements', null, true],
  ['p-documents', 'Mon entreprise', 'Mes pièces', 'Identité, assurances, statut, diplômes : plusieurs pièces par rubrique, en photo ou en fichier.', '/pro/documents', null, true],
  ['d-factures', 'Mon entreprise', 'Mes opérations', 'Factures par mois, envoi au comptable, relevé pour l’Urssaf et les impôts.', '/documents', null, true],
]

async function token(email) {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PWD }) })
  const j = await r.json(); if (!j.access_token) throw new Error('connexion ' + email + ' : ' + JSON.stringify(j)); return j.access_token
}
async function upload(tok, name, body, type) {
  const r = await fetch(`${SB}/storage/v1/object/parcours/${name}`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${tok}`, 'Content-Type': type, 'x-upsert': 'true', 'Cache-Control': 'max-age=60' }, body })
  if (!r.ok) throw new Error(`envoi ${name} : ${r.status} ${await r.text()}`)
}

const upTok = await token(PRO)
const b = await chromium.launch()
const out = []
for (const [side, email, mode, screens] of [['particulier', CLIENT, 'particulier', CLIENT_SCREENS], ['prestataire', PRO, 'pro', PRO_SCREENS]]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
  const p = await ctx.newPage()
  for (const [id, chapter, title, caption, path, act, full, loggedOut] of screens) {
    if (loggedOut) {
      await p.goto(B + path); await p.waitForTimeout(3000)
    } else {
      if (!p.url().startsWith(B) || p.url().includes('/auth/')) {
        await p.goto(B + '/auth/login'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', PWD)
        await p.click('button[type=submit]'); await p.waitForTimeout(4500)
        await p.evaluate(m => { try { localStorage.setItem('ping_mode', m) } catch { } }, mode)
      }
      await p.goto(B + path); await p.waitForTimeout(5000)
    }
    if (act) { try { await act(p) } catch (e) { console.log('  action', id, e.message.split('\n')[0]) } await p.waitForTimeout(1800) }
    const img = await p.screenshot({ type: 'jpeg', quality: 70, fullPage: !!full })
    const file = `${id}.jpg`
    await upload(upTok, file, img, 'image/jpeg')
    out.push({ id, side, chapter, title, caption, img: file, full: !!full })
    console.log('ok', id, Math.round(img.length / 1024) + ' Ko')
  }
  await ctx.close()
}
await b.close()
await upload(upTok, 'manifest.json', JSON.stringify({ generated_at: new Date().toISOString(), screens: out }), 'application/json')
console.log('manifeste envoyé :', out.length, 'écrans')
