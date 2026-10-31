# Audit marketing ↔ application — 31/10/2026

Demande de Romain : « la présentation n'était pas la bonne ou pas mise à jour ; les UX/UI/design de la
présentation n'étaient pas ceux de l'application ; les features de l'animation étaient mieux que celles de
l'application ». Comparaison support par support avec l'application telle qu'en prod le 31/10 (menu 4 entrées,
tarifs par service en 3 formules, calendrier des disponibilités, récapitulatif de mission, notation du client,
Mes opérations et partage, Paiements et fiscalité, carte pro avec demandes ouvertes et urgentes).

Type **a** = le support montre quelque chose de faux ou de périmé → corrigé dans le support.
Type **b** = le support montre mieux que l'application → porté dans l'application, ou listé.

| Support | Écart | Type | Décision | État |
|---|---|---|---|---|
| /presentation | Logo « avion en papier » au lieu du signe PING (anneaux + point vert) | a | Signe PING, mot « ping » en minuscules comme dans l'app | Fait |
| /presentation | Barre du bas à 5 onglets (Carte, Recherche, Messages, Agenda, Profil) | a | 4 onglets comme l'app (Recherche retiré) | Fait |
| /presentation | « Paiement sécurisé (séquestre) » sur le devis, bouton « Valider » | a | « Tarif fixé avant l'intervention », bouton « Accepter » (libellé de l'app) | Fait |
| /presentation | « Sofia arrive chez vous » + barre de trajet (lecture « suivi GPS ») | a | « Sofia est en route · arrivée vers 14 h », puis « Code d'arrivée scanné » (pas de GPS, invariant) | Fait |
| /presentation | Écran final « Vous payez. C'est réglé. » (paiement en ligne éteint) | a | « Prix fixé. Facture envoyée. Juste à côté de vous. » | Fait |
| /presentation | Gris de texte plus clairs que l'app | a | Même palette que l'app (#4E6470) | Fait |
| /presentation | Fiche avec « Forfait remise à blanc » et spécialité « Remise à blanc » : n'existait pas dans l'app | b | « Remise à blanc » proposée dans « Ajouter un tarif » (/pro/tarifs), prestation libre pré-nommée — reste dans le mono-produit nettoyage | Fait |
| /animation | Notifications « Nouvelle demande à 120 m » : l'app n'avait aucune alerte | b | /pro/carte relit les demandes toutes les 60 s quand le pro est disponible et affiche un bandeau « Nouvelle demande à … » (orange si urgente) qui ouvre la demande | Fait |
| /animation | Écho radar autour du prestataire disponible : l'app montrait un point fixe | b | Anneaux d'écho autour de « Vous êtes ici » sur /pro/carte quand « Disponible » (désactivés si l'utilisateur limite les animations) | Fait |
| /animation | Réservation instantanée (bandeau de jours + créneaux barrés) | b | `mission/new` a déjà un calendrier de créneaux ; mise en page « bandeau de 4 jours + grille 2 colonnes » à reprendre | À faire (fichier hors de ce chantier) |
| /animation | Agenda : le rendez-vous « apparaît » avec une animation | b | Micro-animation d'arrivée dans l'agenda | À faire (petit) |
| /animation | « Paiement sous séquestre », « Crédit d'impôt immédiat » | — | Déjà marqués « bientôt » | Conforme |
| /animation | Gris de texte | a | Palette de l'app, régénéré par `brand/anim/build.py` | Fait |
| /plaquettes #devenir-pro | « Au forfait, à l'heure ou sur devis » | a | « Un prix par service : forfait, à l'heure, ou forfait + heures supplémentaires » | Fait |
| /plaquettes #devenir-pro | « Pièce d'identité et SIRET » | a | « Pièce d'identité, assurance et SIRET » | Fait |
| /plaquettes #annonceurs | Encart montré « sur l'écran Mes demandes » alors que le faux encart a été retiré de l'app le 30/10 | a | Mention « emplacement mis en ligne à la signature » | Fait |
| /plaquettes | Séquestre et crédit d'impôt | — | Déjà marqués « bientôt » | Conforme |
| landing-particulier | « Tarif net, affiché à l'avance » (le client paie aussi 8 % de frais) | a | « Prix fixé avant l'intervention, frais de service compris dans le récapitulatif » | Fait |
| landing-particulier | « en temps réel » | a | « maintenant » | Fait |
| landing-pro | « Payé d'avance, pas de litige : le client règle avant » (paiement éteint) | a | « Prix validé d'avance… Paiement en ligne sous séquestre : bientôt » | Fait |
| landing-pro | « Visible à chaque déplacement… sur la carte, en direct » (pas de GPS) | a | « Visible autour de chez vous : passez Disponible d'un geste » | Fait |
| landing-pro | « moins de factures » | a | « Factures automatiques » | Fait |
| /demo-parcours | Commission 5 % + 11 % | a | 8 % + 17 % (taux en vigueur) | Fait |
| /demo-parcours | « SIRET vérifié », « identité vérifiée » (langage interdit) | a | « SIRET renseigné », « pièce d'identité fournie » | Fait |
| /demo-parcours | Point du prestataire qui se déplace sur la carte + « km restants » (suivi GPS) | a | Carte fixe, « Le prestataire a indiqué son départ » | Fait |
| /demo-parcours | « Paiement bloqué sous séquestre », « Montant sous séquestre » | a | « Réservation confirmée · tarif validé », « Paiement en ligne sous séquestre : bientôt » | Fait |
| /demo-parcours | Menu 6 + 5 entrées | a | Menu de l'app : Carte, Messages, Agenda, Mon profil + Support | Fait |
| /demo (app.html, référence) | Frais 5 %, commission 11 %, « vérifié », « séquestre libéré » | a | Corrections textuelles : 8 %/17 %, montants recalculés, « Fourni », « Net perçu » | Fait |
| /demo (app.html) | Écrans séquestre (v_pay, v_track) | a | Laissés : référence UX historique, écart déjà documenté dans CLAUDE.md | Assumé |
| /demo (app.html) | Litige complet (v_litige, suivi), tableau de bord pro (p_dash), boîte « réservations reçues » | b | Déjà listés « vague 1 / vague 2 » dans CLAUDE.md (audit 28/10) | À faire |

## Ce qui reste et pourquoi
- **Réservation instantanée façon animation** et **micro-animation de l'agenda** : touchent `mission/new` et
  l'agenda, travaillés en parallèle par un autre chantier ce jour-là.
- **Litige complet de la démo** (fil chronologique, montant réclamé, échéance) : demande un schéma Supabase
  (vague 2), décision Romain.
- **Vidéo MP4 de l'animation** (`public/brand/files/ping-animation.mp4`) : le HTML est régénéré, la vidéo
  doit être ré-enregistrée (procédure dans `brand/anim/build.py`, Chromium + ffmpeg).
