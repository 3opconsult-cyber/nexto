# Vidéos courtes client et prestataire (23/11/2026)

> **À DIFFUSER APRÈS LE BRANCHEMENT DU SÉQUESTRE ; avant : version sans séquestre.**
> Le séquestre est éteint dans l'application (virement SEPA sur facture). Romain veut « compte sous séquestre » dans les vidéos de présentation : elles sont écrites ainsi. Pour publier la version honnête tant que le séquestre n'est pas branché : `SEQUESTRE = False` dans `brand/anim-courte/scenarios.py`, puis `python3 brand/anim-courte/build.py` (la scène « Paiement » devient « Paiement par virement, prix validé » ; côté prestataire, la phrase de la crainte devient « Prix validé, paiement par virement » ; les deux versions passent le contrôle de lecture).

Brief de Romain (23/11) : message court, qui incite ; tagline « Et si ce que vous cherchiez se trouvait juste à côté ? » ; deux vidéos (clients, prestataires) axées sur les bénéfices, qui anticipent les craintes ; logos conservés ; démonstration RALENTIE ; scène de suivi « en route » retrouvée (factice). Cette version remplace le contenu de `/animation-courte` (teaser de 20 s, devenu page de choix), `/animation-courte-client` et `/animation-courte-prestataire`. Les anciennes pages (`/animation`, `/animation-client`, etc.) ne sont pas touchées.

| Page | Fichier généré | Durée | Scènes | Voix brouillon |
|---|---|---|---|---|
| `/animation-courte` | `public/animation-courte.html` (choix entre les deux) | sans objet | sans objet | sans objet |
| `/animation-courte-client` | `public/animation-courte-client.html` | 44,7 s | 7 | `docs/animations-2026-11-23/voix-brouillon/voix-courte-client.mp3` (44,7 s) |
| `/animation-courte-prestataire` | `public/animation-courte-prestataire.html` | 42,6 s | 7 | `.../voix-courte-prestataire.mp3` (42,6 s) |

Source unique : `brand/anim-courte/scenarios.py` (scènes, textes, durées, touchers, voix, `SEQUESTRE`). Dessin : `brand/anim-courte/parts/e_courte.js` (mêmes polices, mêmes couleurs, même logo « ping » que les animations d'origine). Génération : `python3 brand/anim-courte/build.py` (écrit aussi `brand/anim-courte/voix/*.srt`). Contrôle : `node brand/anim-courte/audit.mjs` ; captures : `node brand/anim-courte/captures.mjs`.

## Règles de rythme tenues (et mesurées)

- Seuil de lecture d'un texte : 1 s + max(mots / 2,5 ; signes / 17) ; 0,6 s de respiration entre deux messages ; 8 mots par ligne et 2 lignes au plus.
- Toute démonstration de clic : le doigt est sur sa cible 0,8 s avant l'action, y reste 0,5 s après, et le résultat reste affiché au moins 1,2 s (en pratique 2,0 à 2,4 s).
- Aucune scène sous 3,5 s ; scène « en route » : 7,4 s. Vitesse de lecture 1x par défaut.
- Le voile de jonction cache 0,125 s de part et d'autre de chaque coupure : le contrôle l'exclut du temps de lecture.

## Vidéo client : 44,7 s

| # | Début-fin (s) | Scène | À l'écran | Voix off (sous-titrée, ne relit pas l'écran) |
|---|---|---|---|---|
| 1 | 0,0 - 5,9 | Accroche | Logo, radar, « Et si ce que vous cherchiez / se trouvait juste à côté ? » sur la carte, prestataires à 200 m, 350 m, 450 m, 600 m | Avant d'aller chercher plus loin, regardez autour de vous. |
| 2 | 5,9 - 12,4 | La crainte | « Un inconnu chez vous ? » puis « Profil vérifié par PING » ; profil Exemple : pièce d'identité fournie, assurance renseignée, avis des clients | Chez vous, la confiance compte : profils contrôlés, avis d'autres clients. |
| 3 | 12,4 - 22,7 | 4 appuis | « Je trouve en 4 appuis » ; Trouver un prestataire, Ménage, Voir les prestataires, Réserver · 60 € (prix validé affiché) ; doigt visible avant chaque appui | Ménage, repassage, nettoyage, fin de chantier, remise en état : quatre gestes. |
| 4 | 22,7 - 30,1 | En route | « Exemple de suivi » ; carte aux routes jaunes, camionnette qui roule vers « Chez vous », « En route · 14:32 », notification « Votre rendez-vous sera là d'ici 1 h » | Le jour du rendez-vous, vous savez à quelle heure il arrive. |
| 5 | 30,1 - 35,1 | Arrivée, départ, notes | « Pas de place pour les fausses notes » ; Arrivée 15:00, Départ 17:00 (Exemple), notes croisées Client / Prestataire | Arrivée et départ sont horodatés ; chacun note l'autre. |
| 6 | 35,1 - 38,6 | Paiement | « Paiement sous séquestre » (60 € verrouillés entre Vous et Prestataire) | Votre argent reste sous séquestre. |
| 7 | 38,6 - 44,7 | Activer PING | Logo, « Activer PING », « Ils sont juste à côté. », QR /l/ins, adresse, « Ménage · repassage · nettoyage », bouton « Je m'inscris » (page web seulement) | Vous cherchez un prestataire ? Activez PING : ils sont juste à côté. |

## Vidéo prestataire : 42,6 s

| # | Début-fin (s) | Scène | À l'écran | Voix off |
|---|---|---|---|---|
| 1 | 0,0 - 5,5 | Accroche | Logo, « Et si vos prochains clients / se trouvaient juste à côté ? » ; demandes autour de vous (Ménage, Repassage, Nettoyage, Urgent) | Regardez autour de vous : vos prochains clients sont peut-être tout près. |
| 2 | 5,5 - 12,7 | La crainte | « Impayés, rendez-vous perdus ? » puis « Prix validé, paiement sous séquestre » ; fiche mission Exemple, 60 €, cadenas | Pour éviter impayés et rendez-vous perdus, le prix est validé avant la mission. |
| 3 | 12,7 - 18,7 | QR | « QR à l'arrivée et au départ » ; QR, Arrivée 14:00, Départ 16:00 (Exemple) | Un QR code enregistre vos heures, à l'arrivée et au départ. |
| 4 | 18,7 - 26,1 | Demandes | « Demandes autour de moi » ; carte, doigt sur une demande urgente, fiche « Ménage, À 1,2 km, Répondre » | Voyez les demandes autour de vous et répondez à celles qui vous conviennent. |
| 5 | 26,1 - 30,9 | Disponible | « Passez Disponible » ; doigt sur l'interrupteur, « Disponible maintenant », radar sur la carte | Un geste, et vous apparaissez sur la carte des clients. |
| 6 | 30,9 - 36,5 | Payé et noté | « Vous êtes payé / et noté » ; Paiement reçu 60 € (Exemple), avis du client | La mission terminée, vous êtes payé et noté par votre client. |
| 7 | 36,5 - 42,6 | Inscrivez-vous | Logo, « Inscrivez-vous », « Ils sont juste à côté. », QR /l/insp, bouton « Je m'inscris » | Vous êtes prestataire ? Inscrivez-vous : vos clients sont juste à côté. |

## Mesure de lecture (Chromium 390 x 844, pas de 0,1 s) : zéro texte sous le seuil

Détail complet : `docs/animations-2026-11-23/audit-lecture.md`. Pour chaque message : temps lisible / seuil.

| Vidéo | Scène | Durée (s) | Mots | Lisible / seuil (s) |
|---|---|---|---|---|
| client | 1 Accroche | 5,9 | 11 | 5,40 / 5,40 |
| client | 2 Crainte | 6,5 | 4 + 4 | 2,60 / 2,60 ; 2,70 / 2,60 |
| client | 3 4 appuis | 10,3 | 5 | 9,80 / 3,00 (4 appuis espacés de 2,0 à 2,4 s) |
| client | 4 En route | 7,4 | 3 + 7 | 6,80 / 2,20 ; 3,90 / 3,80 |
| client | 5 Arrivée, départ, notes | 5,0 | 7 | 4,50 / 3,80 |
| client | 6 Paiement | 3,5 | 3 | 3,00 / 2,35 |
| client | 7 Activer PING | 6,1 | 2 + 5 | 5,70 / 1,80 ; 3,10 / 3,00 |
| pro | 1 Accroche | 5,5 | 10 | 5,00 / 5,00 |
| pro | 2 Crainte | 7,2 | 4 + 5 | 2,80 / 2,71 ; 3,20 / 3,12 |
| pro | 3 QR | 6,0 | 6 | 5,50 / 3,40 |
| pro | 4 Demandes | 7,4 | 4 | 6,90 / 2,60 |
| pro | 5 Disponible | 4,8 | 2 | 4,30 / 2,00 |
| pro | 6 Payé et noté | 5,6 | 5 | 5,10 / 3,00 |
| pro | 7 Inscrivez-vous | 6,1 | 1 + 5 | 5,70 / 1,82 ; 3,10 / 3,00 |

Les 91 textes d'étiquettes et d'interface dessinée (client 53, prestataire 38) sont aussi au-dessus de leur seuil et de 11,5 px sur un lecteur de 345 px. Le doigt est sur sa cible à T-0,8 s et T-0,4 s pour les 6 touchers (4 côté client, 1 + 1 côté prestataire). Limite : la lecture par de vraies personnes n'a pas été testée (non vérifié).

## Voix off, sous-titres, accessibilité

- Sous-titres : `brand/anim-courte/voix/voix-courte-client.srt` et `voix-courte-prestataire.srt` (2 lignes de 42 signes au plus, 2,0 mots/s au plus en pratique). Dans la page : bouton « Sous-titres » (désactivés par défaut, `?st=1` les active), transcription dépliable (texte à l'écran et voix).
- Voix : Piper (voix « siwis », licence CC-BY 4.0 à citer) fonctionne ; deux mp3 BROUILLON calés sur le minutage sont dans `docs/animations-2026-11-23/voix-brouillon/` (client 44,7 s, prestataire 42,6 s ; chaque phrase tient dans sa fenêtre). Ils n'ont PAS été écoutés (qualité, prononciation de « PING » : non vérifié) et ne sont pas dans `public/` : la page se joue muette. Pour les publier après écoute : les copier dans `public/brand/files/`.
- `aria-label` du dessin : description des scènes ; `prefers-reduced-motion` : lecture non automatique, image fixe de l'accroche (vérifié en Chromium : playing = false, temps = 3 s) ; pause, scène suivante et barre de position conservées.

## Points à décider (Romain)

1. Séquestre : voir l'encadré en tête. Tant qu'il est éteint, publier `SEQUESTRE = False`.
2. Scène « en route » (suivi de la camionnette) : c'est une ILLUSTRATION marquée « Exemple de suivi ». Elle montre un suivi en temps réel qui n'existe pas : l'application n'a que « Je pars maintenant » (message « En route, arrivée estimée dans X min ») et le GPS est limité à deux usages (règle 8). À confirmer ; si vous préférez, remplacer par la frise réelle (Rendez-vous, En route, Arrivée).
3. « Profil vérifié par PING » : montré comme exemple ; la règle impose « vérifié » seulement si les pièces sont validées. Marqué « Exemple » à l'écran.
4. « Fin de chantier » et « remise en état » : cités dans la voix de la scène 3 comme exemples de nettoyage (brief) ; non affichés à l'écran, car le catalogue n'a que ménage, repassage, nettoyage.
5. `/aide` (src/lib/aide.ts, hors périmètre, non modifié) charge `/animation-courte?embed=1` sous le titre « PING en 20 secondes » : c'est maintenant la page de choix. Les deux rubriques client et prestataire fonctionnent ; le libellé de la première est à revoir par l'agent principal.
6. `brand/anim-courte/voix/voix-courte.srt` (ancien teaser) est conservé mais n'est plus généré.
