"""Scénarios des 3 animations courtes (22/11/2026) : /animation-courte, /animation-courte-client, /animation-courte-prestataire.

Une source unique : build.py en tire les pages, les sous-titres, les fichiers .srt (voix/) ; le document
docs/animations-nouvelles-2026-11-22.md reprend les mêmes tableaux.

Règles tenues (audit du 22/11/2026, docs/audit-animations-2026-11-22.md) :
  - une idée par écran ; 4 mots maximum de titre par écran ; au moins 2,5 s de titre lisible ;
  - voix off : vouvoiement, environ 2 à 2,5 mots par seconde, ne lit pas le titre ; sous-titres = texte de la voix, 2 lignes de 36 signes au plus ;
  - langage déclaratif : « pièces d'identité et assurance renseignées, contrôlées par PING » ; jamais « certifié » ni « garanti » ;
  - le séquestre est présenté comme dans les animations actuelles (décision de Romain, 03/11) : CONTRADICTION CONNUE, voir A-TRANCHER d.

Champs d'un plan :
  id    identifiant            k   'intro' | 'phone' | 'arg' | 'end'
  d     durée (s) à 1x         src (phone) [début, fin] dans le temps SOURCE de brand/anim-presentation (rejoué à la vitesse d / (fin - début))
  t     titre : 1 à 2 lignes   v   texte de la voix off (sous-titré tel quel)
  i     pictogramme (arg)      v0  début de la voix dans le plan (s, 0,35 par défaut)
"""

QR_CODE = {"teaser": "ins", "client": "ins", "pro": "insp"}

VIDEOS = {
    "teaser": dict(
        out="animation-courte.html", voice="voix-courte.mp3", title="PING en 20 secondes", code="ins",
        short="PING en 20 secondes",
        lead="Le teaser général : la question, la carte, le prix et le paiement, l'arrivée et le départ, puis l'inscription. 20 secondes, vertical, sous-titré. La voix off se joue quand le fichier voix-courte.mp3 existe.",
        shots=[
            dict(id="accroche", k="intro", d=4.0, t=["", "Juste", "à côté ?"], v="PING. Et si c’était juste à côté ?",
                 lib="Accroche", desc="Logo PING et son écho radar, la question « Juste à côté ? »."),
            dict(id="carte", k="phone", d=3.8, src=[4.0, 7.8], t=["Ménage, repassage,", "nettoyage"], v="Découvrez votre futur prestataire en quelques clics.",
                 lib="La carte", desc="Les prestataires disponibles autour de vous, sur la carte."),
            dict(id="commande", k="phone", d=3.6, src=[10.8, 14.6], t=["Vous commandez"], v="Prix validé, paiement sous séquestre.",
                 lib="Vous commandez", desc="Le chat : le prix proposé puis validé, le rendez-vous fixé."),
            dict(id="trace", k="phone", d=4.2, src=[21.15, 23.35], t=["Arrivée, départ,", "notation"], v="Arrivée, départ, profils contrôlés : tout est tracé.",
                 lib="Arrivée, départ", desc="Le QR code à l'arrivée puis au départ."),
            dict(id="final", k="end", d=4.4, v="Client ou prestataire, ils sont juste à côté.", v0=0.5,
                 lib="Final", desc="Logo PING, « PING, l'application de rencontre client-prestataire, en proximité · Côte d'Azur », QR /l/ins et deux boutons (page web seulement)."),
        ],
    ),
    "client": dict(
        out="animation-courte-client.html", voice="voix-courte-client.mp3", title="PING pour les clients, en bref", code="ins",
        short="PING, côté client",
        lead="La vidéo courte à envoyer à un particulier : la question, la carte, le choix, les profils contrôlés, le prix et le paiement, le QR d'arrivée et de départ, la note, puis l'inscription. 34 secondes, vertical, sous-titré.",
        shots=[
            dict(id="accroche", k="intro", d=4.8, t=["", "Prestataire", "juste à côté ?"], v="Et si ce que vous cherchez se trouvait juste à côté ?",
                 lib="Accroche", desc="Logo PING et son écho radar."),
            dict(id="carte", k="phone", d=4.2, src=[4.0, 7.8], t=["Ménage, repassage,", "nettoyage"], v="Les prestataires disponibles près de chez vous.",
                 lib="La carte", desc="Les prestataires disponibles autour de vous."),
            dict(id="choix", k="phone", d=3.6, src=[27.35, 30.9], t=["Vous choisissez"], v="Vous comparez les profils, puis vous choisissez.",
                 lib="Vous choisissez", desc="Le service choisi, la fiche du prestataire, « Contacter »."),
            dict(id="profils", k="arg", d=4.6, i="shield", t=["Profils", "contrôlés"], v="Pièces d’identité et assurance renseignées, contrôlées par PING.",
                 lib="Profils contrôlés", desc="Pièces d'identité et assurance renseignées, contrôlées par PING."),
            dict(id="prix", k="phone", d=4.8, src=[10.8, 14.8], t=["Prix validé", "d’avance"], v="Le paiement reste sous séquestre jusqu’à la fin de la mission.",
                 lib="Prix et paiement", desc="Le chat : prix validé ; paiement sous séquestre (à réaligner, A-TRANCHER d)."),
            dict(id="qr", k="phone", d=4.2, src=[21.15, 23.35], t=["Arrivée et départ"], v="Un QR code enregistre l’arrivée et le départ.",
                 lib="Arrivée et départ", desc="Le QR code à l'arrivée et au départ."),
            dict(id="note", k="arg", d=4.2, i="star", t=["Vous notez"], v="Après la mission, donnez votre avis en quelques clics.",
                 lib="Vous notez", desc="Un avis croisé après chaque mission."),
            dict(id="final", k="end", d=4.6, v="Trouvez-les sur PING : ils sont juste à côté.", v0=0.5,
                 lib="Final", desc="Logo PING, phrase finale, QR /l/ins et bouton « Je m'inscris » (page web seulement)."),
        ],
    ),
    "pro": dict(
        out="animation-courte-prestataire.html", voice="voix-courte-prestataire.mp3", title="PING pour les prestataires, en bref", code="insp",
        short="PING, côté prestataire",
        lead="La vidéo courte à envoyer à un prestataire : la question, les demandes autour de vous, les tarifs, le bouton Disponible, les pièces, le QR, la facture et le paiement, puis l'inscription. 34 secondes, vertical, sous-titré.",
        shots=[
            dict(id="accroche", k="intro", d=4.8, t=["", "Clients", "juste à côté ?"], v="Et si vos prochains clients se trouvaient juste à côté ?",
                 lib="Accroche", desc="Logo PING et son écho radar."),
            dict(id="demandes", k="phone", d=4.4, src=[8.25, 10.8], t=["Demandes", "autour de vous"], v="Les clients proches de vous vous écrivent directement.",
                 lib="Demandes autour de vous", desc="La carte des demandes ouvertes, les urgentes en orange."),
            dict(id="tarifs", k="phone", d=4.0, src=[35.05, 38.75], t=["Vous fixez", "vos tarifs"], v="Forfait ou horaire, le prix est validé d’avance.",
                 lib="Vos tarifs", desc="Un prix par service : forfait, horaire, ou les deux."),
            dict(id="dispo", k="phone", d=4.0, src=[41.45, 45.45], t=["Passez", "Disponible"], v="Un bouton, et vous apparaissez sur la carte.",
                 lib="Disponible", desc="Le bouton Disponible et l'écho radar."),
            dict(id="pieces", k="arg", d=4.6, i="shield", t=["Ajoutez", "vos pièces"], v="Pièces d’identité et assurance renseignées, contrôlées par PING.",
                 lib="Vos pièces", desc="Pièces d'identité et assurance renseignées, contrôlées par PING."),
            dict(id="qr", k="phone", d=3.8, src=[21.15, 23.35], t=["Vos heures", "enregistrées"], v="Un QR code enregistre l’arrivée et le départ.",
                 lib="Arrivée et départ", desc="Le scan du QR code du client."),
            dict(id="paye", k="arg", d=4.4, i="lock", t=["Vous êtes payé"], v="La facture se crée seule, paiement sous séquestre.",
                 lib="Vous êtes payé", desc="Facture automatique ; paiement sous séquestre (à réaligner, A-TRANCHER d)."),
            dict(id="final", k="end", d=4.8, v="Prestataire, inscrivez-vous : vos clients sont juste à côté.", v0=0.5,
                 lib="Final", desc="Logo PING, phrase finale, QR /l/insp et bouton « Je m'inscris » (page web seulement)."),
        ],
    ),
}

MAXC = 36   # signes par ligne de sous-titre (norme de sous-titrage : 42 au plus ; marge pour le téléphone)


def split_sub(text, maxc=MAXC):
    """Coupe le texte de la voix en 1 ou 2 lignes équilibrées."""
    if len(text) <= maxc:
        return [text]
    words = text.split(" ")
    best = None
    for i in range(1, len(words)):
        a, b = " ".join(words[:i]), " ".join(words[i:])
        if len(a) <= maxc and len(b) <= maxc:
            score = abs(len(a) - len(b))
            if best is None or score < best[0]:
                best = (score, [a, b])
    if best is None:
        raise ValueError("sous-titre trop long : " + text)
    return best[1]


def words(s):
    import re
    return len([w for w in re.split(r"\s+", s) if re.search(r"[A-Za-z0-9À-ÿ]", w)])


def check():
    """Contrôle des règles ; renvoie les lignes d'un rapport (erreur levée si une règle dure est violée)."""
    rep = []
    for key, v in VIDEOS.items():
        tot = 0.0
        for s in v["shots"]:
            tot += s["d"]
            tw = words(" ".join(s.get("t", [])))
            if s["k"] != "end" and tw > 4:
                raise ValueError(f"{key}/{s['id']} : {tw} mots de titre")
            if s["d"] < 3.5:
                raise ValueError(f"{key}/{s['id']} : plan trop court")
            lines = split_sub(s["v"])
            vs = s.get("v0", 0.35)
            ve = s["d"] - (0.25 if s["k"] != "end" else 0.1)
            win = ve - vs
            wps = words(s["v"]) / win
            cps = len(s["v"]) / win
            rep.append((key, s["id"], s["d"], tw, words(s["v"]), round(wps, 2), round(cps, 1), len(lines)))
            if wps > 2.7 or cps > 17:
                rep.append(("ERREUR", key, s["id"], "voix trop dense", round(wps, 2), round(cps, 1)))
        rep.append((key, "TOTAL", round(tot, 1), "", "", "", "", ""))
    return rep


if __name__ == "__main__":
    for r in check():
        print(*r)
