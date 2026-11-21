# Inventaire des données personnelles (créé le 21/11/2026, À VALIDER par Romain)
Aucun mineur n'est concerné (information de Romain ; la date de naissance est demandée à l'inscription, contrôle d'âge : non vérifié).
Durées de conservation et procédures de suppression : [à compléter] par Romain (décision juridique). Ne rien inventer.
Registre RGPD, base légale, sous-traitants : [à compléter]. Sous-traitants connus : Supabase (base, eu-west-3), Vercel (hébergement).

| Donnée | Où (table / stockage) | Qui la voit | Finalité | Conservation | Suppression |
|---|---|---|---|---|---|
| Identité du compte (nom, e-mail, date de naissance) | `auth.users`, `profiles` (RLS self-read) | soi, admin | Compte, contrat | [à compléter] | [à compléter] |
| Téléphone chiffré | `profiles.phone_enc` | soi ; jamais public | Contact de mission | [à compléter] | [à compléter] |
| Pièce d'identité (client, prestataire) | `documents` + stockage privé | soi, admin | Contrôle des pièces (« profil vérifié par PING ») | [à compléter] | [à compléter] |
| Kbis, assurance, attestation, récépissé SAP, RIB pro | `documents` + stockage privé | soi, admin | Conformité du prestataire | [à compléter] | [à compléter] |
| Adresse de l'intervention | `requests.address`, `transactions` | auteur ; prestataire seulement si confirmé et payé ; vue sans numéro avant | Réalisation de la mission | [à compléter] | [à compléter] |
| Adresse et position fixe du prestataire | `provider_profiles.lat/lng` | public (carte) | Visibilité | [à compléter] | [à compléter] |
| IBAN, titulaire, BIC du prestataire | `provider_private` (jamais `provider_profiles`) | prestataire ; acheteur d'une mission terminée facturée (RPC `payee_bank_details`) | Virement SEPA | [à compléter] | [à compléter] |
| NIF (DAC7) et motif de suspension | `provider_private` | prestataire, admin | Obligation fiscale | [à compléter] | [à compléter] |
| Identifiant client Urssaf, date de naissance | `avance_immediate_clients` (jamais l'IBAN) | soi | Avance immédiate (éteint) | [à compléter] | [à compléter] |
| Photos de présence (arrivée, client absent), distance, heure | bucket privé `presence-photos`, messages | les deux parties, admin | Preuve de présence | [à compléter] | [à compléter] |
| Position GPS lors de la validation « client absent » | transaction | les deux parties, admin | Preuve | [à compléter] | [à compléter] |
| Position d'intervention floutée (grille 0,005 deg), 12 h | `provider_live_zone` | public (version floutée) ; consentement dans `provider_private.live_zone_consent_at` | « Ici aujourd'hui » | 12 h puis fermée, jamais supprimée | [à compléter] |
| Messages et conversations | `messages` | les deux parties, admin | Mission, preuve | [à compléter] | [à compléter] |
| Litiges, messages de litige, photos | `disputes`, `dispute_messages`, bucket `dispute-photos` | les deux parties, admin | Résolution | [à compléter] | [à compléter] |
| Factures, virements, dettes de commission | `invoices`, `transfer_payments`, `commission_debts` | chaque partie (sa part), admin | Obligation comptable | [à compléter] (durée légale à confirmer) | [à compléter] |
| Avis et notes privées | `reviews`, `client_private_notes` | public (avis publiés) ; note privée : prestataire | Confiance | [à compléter] | [à compléter] |
| Journal des connexions, événements marketing, UTM | `events`, journal | admin | Mesure, sécurité | [à compléter] | [à compléter] |
| Journal d'annulations | `mission_cancellations` | admin seul | Antifraude | [à compléter] | [à compléter] |
| Journal d'e-mails | `notification_log` | serveur seul | Limiter les envois | [à compléter] | [à compléter] |
| Parrainage | `referrals`, `localStorage('ping_ref')` | soi | Compteurs | [à compléter] | [à compléter] |

## Principes déjà en place (code)
- Pas de lecture publique de `profiles` ; `requests` limitée aux parties ; adresse jamais dans un e-mail.
- Aucun suivi de position hors validation « client absent » et option consentie.
- Comptes de test et données fictives marqués (`.invalid`, colonne `fictif`).

## À faire (accord de Romain)
Durées de conservation, procédure d'effacement et d'export, mention dans `/confidentialite` (PROVISOIRE), registre des traitements.
Les données de test fictives ne contiennent pas de vraies personnes ; 4 demandes proviennent d'un vrai utilisateur (CLAUDE.md, 31/10).
