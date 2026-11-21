# Mémoire creation-materiel (vérifié le 21/11/2026)
## Générateurs (la page est le produit : modifier un fichier met à jour ce que voient tous ceux qui ouvrent le lien)
- `/plaquettes` : `brand/plaquettes/build.py` depuis `src.html` ; 5 publics (particulier, pro, devenir-pro, entreprises, annonceurs).
- `/bienvenue` : `brand/plaquettes/build_bienvenue.py` (reprend les slides particulier/pro) ; régénérer : `cd brand/plaquettes && python3 build_bienvenue.py`.
- Animations : `brand/anim` (/animation), `anim-pro`, `anim-inscription`, `anim-presentation` (animation-client, animation-prestataire, animation-ping), `anim-tuto` ; lecteur partagé `brand/anim/player.{py,js,css}`.
- Lecteur : `PING_ANIM.seek(t)` déterministe ; `?admin=1` affiche scénario et vitesse ; `?embed=1`, `?scene=N`, `?autoplay=0`, `?speed=` ; `#record` force vitesse 1.
- MP4 1080x1920 : procédure en tête des build.py ; les MP4 des animations client/prestataire du 03/11 NE SONT PAS générés.
- E-mails : `brand/emails/build.py` -> `public/brand/emails/<nom>.html` et `.txt` (7 modèles).
- Kit : `brand/build.py`, `kit.py` (codes `/l/<code>` : synchroniser avec `src/app/l/[code]/route.ts`), `shoot.py` (PNG ; `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` dans ce bac à sable).
## Règles de contenu
- Aucune marque tierce (Airbnb, Uber, Booking, Wecasa) dans plaquettes, /bienvenue, animations (décision 02/11, juridique). Documents internes : permis.
- Langage : « pièce fournie », « assurance renseignée », « profil vérifié par PING » seulement pour pièces validées ; jamais « certifié » ni « garanti ».
- Pas d'emoji : pictogrammes. Signature visuelle : point d'interrogation dont le point est l'anneau radar (`device()` dans `brand/kit.py`).
- Accroche en cours : « Simple. Rapide. Juste à côté. » ; fin des vidéos : « PING, l'application de rencontre client-prestataire, en proximité, Côte d'Azur ».
- Contact : info@opconsult.co (orthographe à confirmer, A-TRANCHER t).
## Points de vigilance
- Séquestre montré actif dans les vidéos et /bienvenue alors que le paiement en ligne est éteint : décision à prendre (A-TRANCHER d). Plaquettes : « Règlement par virement, sur facture ».
- `src/lib/aide.ts` pointe sur les rangs de scène des animations : le mettre à jour si l'ordre change (demande de passage au principal : src/ est hors périmètre).
- Rendu de vidéo non vérifié en production par cet agent : écrire « non vérifié » tant qu'un lien n'a pas été ouvert.

## Rappels communs
- Règles : docs/claude/REGLES-METIER.md et REGLES-TECH.md. Contradictions : A-TRANCHER.md. Erreurs passées : ERREURS.md.
- Aucun secret, aucune suppression sans accord, aucun accès admin créé, aucune donnée inventée ([à compléter]).
- Seul l'agent principal écrit dans les fichiers de docs/claude ; proposer des lignes de mémoire dans le rapport.
