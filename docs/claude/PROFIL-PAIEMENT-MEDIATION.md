# Paiement et médiation (session ouverte le 26/11/2026, rien codé)
Session « PING · Paiement et médiation ». Renvois : `REGLES-METIER.md` (Litige, argent), `A-TRANCHER.md` (D-19, litige en offre), `RUBRIQUE-FACTURATION.md`. Numérotation des factures, références de transaction, CRM : session Facturation, pas ici.

## 1. Moyen de paiement (D-19, choix à faire par Romain)

### Ce qui existe dans le code (lu, ÉTEINT)
`src/lib/payments/` : un contrat commun (`types.ts`) et trois adaptateurs (`stripe.ts`, `mangopay.ts`, `lemonway.ts`). Parcours identique : le pro ouvre son compte chez le prestataire (identité + IBAN contrôlés par lui) ; le client paie par carte, l'argent est bloqué ; 24 h après le scan de fin sans litige, versement au pro (prestation moins sa commission) ; PING garde ses commissions ; annulation ou litige : remboursement. Allumage : variable Vercel `PAYMENT_PROVIDER` + clés du prestataire + clé service Supabase + `CRON_SECRET`. Tant qu'une manque, l'app garde le virement sur facture.
Pas de code pour « carte enregistrée pour plus tard » : seul le paiement à la réservation est écrit. À ajouter une fois le prestataire choisi (chez Stripe : « SetupIntent », chez les autres : « CardRegistration »). La carte reste chez le prestataire ; PING ne garde qu'un identifiant.

### Comparatif (ordres de grandeur de mémoire, NON VÉRIFIÉ : tarifs et délais à confirmer par devis écrit)
| | Stripe Connect | Mangopay | Lemonway |
|---|---|---|---|
| Nature | Plateforme de paiement américaine/irlandaise, comptes « Express » | Établissement de monnaie électronique (Luxembourg), pensé pour places de marché | Établissement de paiement français (ACPR), pensé pour places de marché |
| Frais | Carte européenne autour de 1,5 % + 0,25 € ; Connect : en plus un petit frais par compte actif et par virement | Frais par opération + frais fixes mensuels selon contrat | Frais par opération + abonnement, souvent un minimum selon contrat |
| Mise en route | Compte en ligne, test immédiat, production en quelques jours après validation de l'activité | Dossier commercial, contrat, quelques semaines | Dossier commercial, conformité, plusieurs semaines |
| Identité du pro | Page Stripe hébergée : pièce, IBAN, contrôle par Stripe (rien de stocké chez PING) | Dossier KYC à transmettre par l'API (PING manipule les pièces, cf. `submitKycDocument`) | KYC par le prestataire, PING transmet aussi |
| Séquestre | Pas de « séquestre » juridique : l'argent reste sur le solde de la plateforme, transfert au pro après délai | Porte-monnaie par utilisateur : fonds bloqués nativement | Compte de paiement par utilisateur : fonds bloqués nativement |
| Carte enregistrée | Oui, natif | Oui, natif | Oui, selon contrat |
| Code déjà écrit | Oui | Oui | Oui |

### Recommandation
**Stripe Connect**, pour démarrer : pas de contrat commercial, test en mode d'essai tout de suite, identité du pro entièrement chez Stripe (moins de données chez PING, bon pour le RGPD), carte enregistrée native. Réserve à lever avant de promettre quoi que ce soit : demander à Stripe par écrit que le modèle « services à domicile, versement 24 h après la prestation » est accepté, et demander au juriste si « l'argent est gardé » peut s'écrire (règle 5 : jamais « garanti »). Si Romain veut un vrai séquestre juridique et un acteur français, Mangopay ou Lemonway sont à chiffrer en devis, avec un délai de plusieurs semaines.

### Ce que Romain doit fournir
1. Le choix (ou l'accord pour ouvrir un compte d'essai Stripe).
2. Documents de la société BAITA EURL : Kbis, statuts, pièce d'identité du gérant, déclaration des bénéficiaires effectifs, IBAN de la société.
3. Adresse du site, description de l'activité, CGV : le prestataire de paiement les relit avant d'ouvrir la production.
4. Saisir lui-même, dans Vercel (Settings, Environment Variables), les clés que le prestataire lui donne. Jamais dans un fichier, jamais dans le chat (règle 1). Je peux demander la clé par le formulaire sécurisé.
5. Mode d'essai d'abord : test avec des comptes « QA » et cartes de test, puis production.
6. Avis de l'expert-comptable : TVA sur les commissions, passage des fonds par PING, déclaration annuelle des plateformes (DAC7).
Le séquestre reste ÉTEINT et non annoncé comme actif (A-TRANCHER d) jusqu'au premier paiement réel vu en production.

## 2. Médiateur

### Constat dans le code (corrige la lecture de départ)
Aucun médiateur de la consommation externe n'apparaît dans l'application. Le mot « médiateur » dans `src/app/litiges/[id]/page.tsx` (l. 16) désigne PING lui-même : « PING (admin) peut répondre en médiateur ». L'audit (AUDIT-ANNONCE-CARTE, point 4) avait donc raison de dire « le mot n'apparaît que dans la page litiges », mais ce n'est pas le médiateur légal.

### Deux choses à ne jamais confondre
| | Médiation de PING / Décision PING | Médiateur de la consommation |
|---|---|---|
| Qui | PING, par un admin | Organisme externe et indépendant, référencé auprès de la Commission d'évaluation et de contrôle de la médiation de la consommation |
| Où | `request_ping_mediation` (040 arrangement amiable, 054 `ping_decide_dispute`), carte « PING · médiation » dans le chat | Nulle part aujourd'hui |
| Rôle | Premier niveau : arrangement, avoir, décision de clôture | Dernier recours gratuit pour le particulier, après échec de la réclamation écrite |
| Texte à afficher | « Médiation PING » | Nom, adresse et site du médiateur, dans les CGV, sur le site et à côté du litige |

### À confirmer avec Romain (question ouverte)
Par « négociateur, conciliateur », Romain entend-il : (a) un rôle de PING dans le litige (déjà là), (b) le médiateur légal externe, (c) un vrai tiers humain intermédiaire entre le client et le pro, à ajouter ? Sans réponse, rien n'est codé.

### Proposition d'intégration si (b) (à faire relire par l'expert-comptable ou un juriste ; je ne suis pas juriste)
1. Choisir un médiateur référencé et adhérer (frais d'adhésion à demander). Qui doit adhérer, PING ou chaque prestataire, et les cas d'exemption des très petites entreprises : question au juriste.
2. Réglage en base (pas en dur) : nom, adresse postale, site, dans `app_settings`, par exemple `consumer_mediator`.
3. Afficher ce réglage : CGV, bas de la facture et du reçu envers un particulier (point 4 d'AUDIT-ANNONCE-CARTE, session Facturation pour le PDF), page `litiges/[id]` après une décision non retenue ou un désaccord (« Vous pouvez saisir gratuitement le médiateur : … »).
4. Langage déclaratif : « Médiateur de la consommation proposé par PING », jamais « garanti ».
5. Le litige en offre (24 h, silence = payé) reste A-TRANCHER v, session Règles métier : non touché ici.

## État
Rien codé, rien poussé. Fichier créé pour la reprise. Prochaine étape : réponse de Romain (choix du prestataire de paiement ; sens de « négociateur »).

## Décisions de Romain (25/11/2026)
1. **Câblages gardés** : Mangopay, Stripe, virement SEPA, virement sur RIB, Wero. Dans le code il y a Stripe, Mangopay et Lemonway ; **Wero n'est pas écrit** (seule mention : `docs/checklist-2026-11-18.md`). Wero passe en général par un prestataire de paiement : à demander à Stripe et Mangopay (non vérifié).
2. **Frais du mode de paiement** : afficher le coût de chaque mode à celui qui le choisit ; paiement en une fois possible. Point d'interrogation de Romain : inclure ou non le coût dans le prix. Conseil ci-dessous.
3. **Séquestre** : doit être solide ; besoin du coût réel pour calculer la marge.
4. **Commission** : 8 % (client) + 17 % (prestataire) en base (`app_settings`, `/admin/commission`). Romain parle de « 20 % sur la totalité » : 8 + 17 = 25 % du prix de la prestation. À confirmer.
5. **Maintenance** : Claude à 200 € par mois (plus API Anthropic) à intégrer aux coûts fixes.
6. **Médiateur** : juridique mis de côté, CGV inchangées. On garde le chat de gestion du conflit (médiation et arbitrage par PING). PING est une place de marché : il règle un différend sur la base de l'échange entre les deux parties, il ne juge pas la qualité. Recherche du médiateur légal : voir le rapport de session (liste CECMC).

## Calcul de marge (exemple, prestation 100 €, taux 8 % + 17 %)
Client paie 108 €, prestataire reçoit 83 €, PING garde 25 € (23 % de ce que paie le client).
Coût carte (Stripe, carte européenne, tarif public relevé par un blog le 17/11/2026, NON VÉRIFIÉ) : 1,5 % + 0,25 € sur 108 € = 1,87 €. Carte professionnelle : environ 2,8 % + 0,25 € = 3,27 €. Frais Connect (compte actif, versement) : non trouvés, à demander.
Reste pour PING avant coûts fixes : environ 23 €. Avec 200 € de maintenance Claude seule, il faut environ 9 missions de 100 € par mois pour couvrir cette ligne. Coûts fixes à compléter par Romain : hébergement (Vercel, Supabase), e-mails (Resend), comptable, adhésion médiateur, abonnement du prestataire de paiement (Mangopay : environ 249 € par mois selon un tiers, non vérifié).

## Mise à jour du 25/11/2026 (suite des décisions de Romain)
**Commission : 25 % confirmés** (8 % client + 17 % prestataire).

### Conciliateur (proposition, rien codé)
Besoin de Romain : une personne de confiance, inscrite dans une liste, que PING contacte seulement en cas de besoin. Ce n'est pas le médiateur légal. Proposition : table `conciliators` gérée par l'admin (nom, spécialité, e-mail, disponibilité), bouton « Proposer un conciliateur » dans le litige côté admin ; le chat de litige actuel reste le canal. Recherche des personnes : à faire par Romain (réseau, associations de médiateurs). À valider : rémunération et responsabilité, avec le juriste plus tard.

### Wero
Wero est un virement instantané de compte à compte. Entre particuliers, il passe par les applications Wero et PING n'y est pas : aucun séquestre possible. Pour payer une mission, il faut que l'argent arrive sur le compte séquestre : Wero est donc un moyen d'alimenter ce compte, via un prestataire de paiement. Le paiement e-commerce en France est annoncé pour fin 2026, par des acquéreurs (Worldline, BNP Axepta, Nuvei). Aucun tarif trouvé. Non vérifié. Sources : Worldline (fr-fr/blogs/2026/wero-en-france-ce-que-les-commercants-doivent-savoir), E-Commerce Nation.

### Benchmark des comptes séquestre (publié, NON VÉRIFIÉ : sources de blogs, devis écrits à obtenir)
« Sescrow » : aucun résultat trouvé. À confirmer avec Romain (nom exact ou lien).
| Acteur | Statut | Tarif public relevé | Remarque |
|---|---|---|---|
| Lemonway | Établissement de paiement français (ACPR) | carte à partir de 1,10 % + 0,25 € (page tarifs) | KYC et séquestre intégrés ; le moins cher des trois sur le papier |
| Mangopay | Monnaie électronique, Luxembourg (CSSF) | à partir de 1,4 % + 0,25 € et environ 249 € par mois (Sharetribe) ; tarifs sur devis | Séquestre natif, très utilisé par les places de marché |
| Stripe Connect | Monnaie électronique, Irlande | 1,5 % + 0,25 € carte européenne ; frais Connect non trouvés | Pas de compte séquestre à proprement parler |
| Mollie, Adyen pour plateformes, Swan, Treezor | Cités ou non documentés | rien de fiable | à chiffrer par devis si Romain veut les comparer |
Un séquestre indépendant exige en général un agrément : passer par un établissement agréé (les trois ci-dessus) est la voie normale. À faire valider par le juriste.
Recommandation provisoire : demander un devis écrit à Lemonway et à Mangopay, avec le volume attendu et le versement 24 h après la prestation ; Stripe en complément pour la carte. Le choix se fait sur devis, pas sur ce tableau.

## Facturation (onglet à part : ce qui existe déjà)
Rubrique de référence : `RUBRIQUE-FACTURATION.md` (session Facturation). Ici seulement l'état lu dans le code.
**Où** : onglet « Factures » de l'agenda et page `/documents` (`FacturesList.tsx`). Au premier plan les documents du prestataire ; repliés en bas, « Frais PING ». Chaque partie ne voit que sa commission (filtre par nature de document).
**Les quatre modèles** (`src/lib/invoice-pdf.ts`) :
| Document | Émetteur | Destinataire | Numéro | Contenu |
|---|---|---|---|---|
| Facture (pro immatriculé) | le prestataire, sous son en-tête | le client | FACT-… | prestation, date, durée, taux ; PING n'y figure pas |
| Récapitulatif (pro particulier non immatriculé) | PING pour son compte | le client | RECAP-… | pas une facture, phrase de déclaration |
| Frais de service | PING | le particulier | PING-C-… | sa part de 8 % uniquement |
| Commission | PING | le prestataire | PING-V-… | sa part de 17 % uniquement |
Sur la facture du prestataire, aucune ligne de commission : c'est déjà conforme à la règle de Romain.

### Constat à traiter (NON vérifié en base : je n'ai pas interrogé Supabase)
Le filtre « chaque partie ne voit que sa commission » est fait dans l'écran, pas dans la base. Dans la migration 056, le document PING-C a pour `issuer_id` le prestataire et `client_id` le particulier ; PING-V l'inverse. La règle de lecture (006) laisse lire un document à celui qui est `issuer_id` ou `client_id`. Résultat probable : le prestataire pourrait lire en base le document de frais du particulier, et inversement, en contournant l'écran. À faire vérifier par la session Données SQL (agent securite-donnees) avant toute correction. Rien modifié ici.
