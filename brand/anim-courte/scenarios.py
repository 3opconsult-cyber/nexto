"""Scénarios des 2 vidéos courtes (23/11/2026) : /animation-courte-client et /animation-courte-prestataire
(/animation-courte = page de choix entre les deux). Une source unique : build.py en tire les pages, les sous-titres (voix/*.srt),
et docs/animations-nouvelles-2026-11-23.md reprend les mêmes tableaux.

############################################################################################################
# À DIFFUSER APRÈS LE BRANCHEMENT DU SÉQUESTRE ; avant : version sans séquestre (SEQUESTRE = False).        #
# Le séquestre est ÉTEINT dans l'application aujourd'hui (virement SEPA sur facture). Romain veut « compte    #
# sous séquestre » dans les vidéos de présentation : elles sont écrites ainsi, et un seul paramètre suffit     #
# pour publier la version honnête tant que le séquestre n'est pas branché.                                    #
############################################################################################################
"""

SEQUESTRE = False   # True = « compte sous séquestre » (à diffuser APRÈS le branchement) ; False = « Paiement par virement, prix validé »

# --- Règles de lecture (brief de Romain du 23/11/2026 : le défaut n°1 est la vitesse) ---------------------------------------
#   seuil de lecture d'un texte = 1 s + max(mots / 2,5 ; signes / 17) ;  0,6 s de respiration entre deux messages ;
#   une démonstration de clic montre le doigt 0,8 s AVANT l'action et laisse 1,2 s APRÈS ; aucune scène sous 3,5 s ; scène « en route » >= 7 s.
READ_BASE, READ_WPS, READ_CPS, BREATH = 1.0, 2.5, 17.0, 0.6
FADE = 0.3                # un message est lisible (50 % d'opacité) à at + FADE / 2
DIP = 0.125               # le voile de jonction (0,25 s de part et d'autre) cache le texte pendant les 0,125 s qui touchent la coupure
PRE_TAP, POST_TAP = 0.8, 1.2
MIN_SCENE, MIN_ROUTE = 3.5, 7.0
MAXW_LINE, MAXLINES = 8, 2

SEQ_A = "Paiement sous séquestre"
SEQ_B = "Prix validé, paiement sous séquestre"
VIR_A = "Paiement par virement,"
VIR_B = "prix validé"

SERVICES = "Ménage, repassage, nettoyage, fin de chantier, remise en état"   # voix seulement : fin de chantier et remise en état = exemples de nettoyage (brief de Romain)


def _seq(a, b):
    return a if SEQUESTRE else b


# Champs d'une scène
#   id, kind (constructeur dans parts/e_courte.js), d (durée), lib/desc (liste des scènes), v (voix off), v0 (début de la voix, 0,35 s par défaut)
#   msgs : textes à l'écran [dict(id, lines=[1 à 2 lignes de 8 mots au plus], at, until=None, style, hl)] ; hl = ligne mise en couleur
#   taps : [(t, x, y)] touchers montrés (doigt visible PRE_TAP avant, résultat laissé POST_TAP après) ; x, y en unités du dessin 540 x 960
CLIENT = dict(
    out="animation-courte-client.html", voice="voix-courte-client.mp3", title="PING pour les clients, en bref", code="ins", who="client",
    lead="Vidéo courte pour un particulier : la tagline sur la carte, la crainte (« et si c'est un inconnu ? ») levée, les 4 appuis pour trouver et réserver, "
         "l'exemple de suivi « en route », l'arrivée, le départ et les notes, le paiement, puis « Activer PING ».",
    scenes=[
        dict(id="accroche", kind="hook", d=5.9, lib="Accroche", desc="Logo PING, la tagline sur la carte, les prestataires qui apparaissent autour de vous.",
             msgs=[dict(id="m1", lines=["Et si ce que vous cherchiez", "se trouvait juste à côté ?"], at=0.2, style="tag", hl=1)],
             v="Avant d’aller chercher plus loin, regardez autour de vous."),
        dict(id="crainte", kind="trust", d=6.5, lib="La crainte", desc="« Un inconnu chez vous ? » puis le profil vérifié par PING, les avis.",
             msgs=[dict(id="m1", lines=["Un inconnu chez vous ?"], at=0.2, until=3.1, style="q"),
                   dict(id="m2", lines=["Profil vérifié par PING"], at=3.55, style="a")],
             v="Chez vous, la confiance compte : profils contrôlés, avis d’autres clients."),
        dict(id="appuis", kind="find", d=10.3, lib="4 appuis", desc="Trouver un prestataire, Ménage, Voir les prestataires, Réserver : le prix validé s'affiche.",
             msgs=[dict(id="m1", lines=["Je trouve en 4 appuis"], at=0.2, style="cap")],
             taps=[(1.2, 270, 868), (3.2, 106, 670), (5.6, 270, 880), (8.0, 270, 850)],
             v=SERVICES + " : quatre gestes."),
        dict(id="route", kind="route", d=7.4, lib="En route", desc="Exemple de suivi : carte aux routes jaunes, camionnette qui roule, « En route · 14:32 », notification « d'ici 1 h ».",
             msgs=[dict(id="m1", lines=["En route · 14:32"], at=0.3, style="chip"),
                   dict(id="m2", lines=["Votre rendez-vous sera là", "d’ici 1 h"], at=3.25, style="notif")],
             v="Le jour du rendez-vous, vous savez à quelle heure il arrive."),
        dict(id="traces", kind="times", d=5.0, lib="Arrivée, départ, notes", desc="Heure d'arrivée, heure de départ, notes croisées : pas de place pour les fausses notes.",
             msgs=[dict(id="m1", lines=["Pas de place pour", "les fausses notes"], at=0.2, style="cap")],
             v="Arrivée et départ sont horodatés ; chacun note l’autre."),
        dict(id="paiement", kind="pay", d=3.5, lib="Paiement", desc=("Compte sous séquestre : prix validé, 60 € en exemple." if SEQUESTRE else "Paiement par virement : prix validé, 60 € en exemple."),
             msgs=[dict(id="m1", lines=[SEQ_A], at=0.2, style="cap")] if SEQUESTRE else [dict(id="m1", lines=[VIR_A, VIR_B], at=0.2, style="cap")],
             v="Votre argent reste sous séquestre." if SEQUESTRE else "Prix validé d’avance, réglé par virement."),
        dict(id="final", kind="final", d=6.1, lib="Activer PING", desc="Logo PING, « Activer PING », « Ils sont juste à côté. », QR /l/ins et bouton « Je m'inscris » (page web seulement).",
             msgs=[dict(id="m1", lines=["Activer PING"], at=0.2, style="big"),
                   dict(id="m2", lines=["Ils sont juste à côté."], at=2.8, style="tag2", hl=0)],
             v="Vous cherchez un prestataire ? Activez PING : ils sont juste à côté.", v0=0.5),
    ],
)

PRO = dict(
    out="animation-courte-prestataire.html", voice="voix-courte-prestataire.mp3", title="PING pour les prestataires, en bref", code="insp", who="pro",
    lead="Vidéo courte pour un prestataire : l'accroche sur la carte, la crainte des impayés et des rendez-vous perdus, le QR d'arrivée et de départ, "
         "les demandes autour de moi, « Disponible maintenant », être payé et noté, puis « Inscrivez-vous ».",
    scenes=[
        dict(id="accroche", kind="hook", d=5.5, lib="Accroche", desc="Logo PING, la question sur la carte, les demandes qui apparaissent autour de vous.",
             msgs=[dict(id="m1", lines=["Et si vos prochains clients", "se trouvaient juste à côté ?"], at=0.2, style="tag", hl=1)],
             v="Regardez autour de vous : vos prochains clients sont peut-être tout près."),
        dict(id="crainte", kind="mission", d=7.2, lib="La crainte", desc="« Impayés, rendez-vous perdus ? » puis prix validé et paiement sous séquestre (ou virement).",
             msgs=[dict(id="m1", lines=["Impayés, rendez-vous", "perdus ?"], at=0.2, until=3.3, style="q"),
                   dict(id="m2", lines=(["Prix validé, paiement", "sous séquestre"] if SEQUESTRE else ["Prix validé, paiement", "par virement"]), at=3.75, style="a")],
             v="Pour éviter impayés et rendez-vous perdus, le prix est validé avant la mission."),
        dict(id="qr", kind="scan", d=6.0, lib="QR arrivée et départ", desc="Le QR code enregistre l'arrivée puis le départ.",
             msgs=[dict(id="m1", lines=["QR à l’arrivée", "et au départ"], at=0.2, style="cap")],
             v="Un QR code enregistre vos heures, à l’arrivée et au départ."),
        dict(id="demandes", kind="demands", d=7.4, lib="Demandes autour de moi", desc="La carte des demandes autour de moi ; on touche une demande (ménage, repassage, nettoyage).",
             msgs=[dict(id="m1", lines=["Demandes autour de moi"], at=0.2, style="cap")],
             taps=[(2.7, 328, 550)],
             v="Voyez les demandes autour de vous et répondez à celles qui vous conviennent."),
        dict(id="dispo", kind="online", d=4.8, lib="Disponible maintenant", desc="Un geste sur « Disponible » et vous apparaissez sur la carte des clients.",
             msgs=[dict(id="m1", lines=["Passez Disponible"], at=0.2, style="cap")],
             taps=[(2.0, 436, 777)],
             v="Un geste, et vous apparaissez sur la carte des clients."),
        dict(id="paye", kind="paid", d=5.6, lib="Payé et noté", desc="Paiement reçu (exemple 60 €) et note du client.",
             msgs=[dict(id="m1", lines=["Vous êtes payé", "et noté"], at=0.2, style="cap")],
             v="La mission terminée, vous êtes payé et noté par votre client."),
        dict(id="final", kind="final", d=6.1, lib="Inscrivez-vous", desc="Logo PING, « Inscrivez-vous », « Ils sont juste à côté. », QR /l/insp et bouton « Je m'inscris » (page web seulement).",
             msgs=[dict(id="m1", lines=["Inscrivez-vous"], at=0.2, style="big"),
                   dict(id="m2", lines=["Ils sont juste à côté."], at=2.8, style="tag2", hl=0)],
             v="Vous êtes prestataire ? Inscrivez-vous : vos clients sont juste à côté.", v0=0.5),
    ],
)

VIDEOS = {"client": CLIENT, "pro": PRO}

MAXC = 42   # signes par ligne de sous-titre (norme de sous-titrage : 42 au plus)


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


def threshold(text):
    """Seuil de lecture : 1 s + max(mots / 2,5 ; signes / 17)."""
    return READ_BASE + max(words(text) / READ_WPS, len(text) / READ_CPS)


def check():
    """Contrôle des règles de lecture sur les données du scénario ; renvoie les lignes du tableau (liste de dict)."""
    rep, errs = [], []
    for key, v in VIDEOS.items():
        tot = 0.0
        for s in v["scenes"]:
            tot += s["d"]
            if s["d"] < MIN_SCENE:
                errs.append(f"{key}/{s['id']} : scène sous {MIN_SCENE} s")
            if s["kind"] == "route" and s["d"] < MIN_ROUTE:
                errs.append(f"{key}/{s['id']} : scène en route sous {MIN_ROUTE} s")
            prev = None
            for m in s["msgs"]:
                if len(m["lines"]) > MAXLINES or any(words(L) > MAXW_LINE for L in m["lines"]):
                    errs.append(f"{key}/{s['id']}/{m['id']} : plus de {MAXLINES} lignes ou de {MAXW_LINE} mots par ligne")
                text = " ".join(m["lines"])
                thr = threshold(text)
                vis0 = m["at"] + FADE / 2
                end = (m["until"] if m.get("until") else s["d"]) - DIP
                vis = end - vis0
                gap = None
                if prev is not None:
                    gap = m["at"] - (prev["at"] + FADE / 2 + prev["thr"])
                    if gap < BREATH - 1e-6:
                        errs.append(f"{key}/{s['id']}/{m['id']} : moins de {BREATH} s de respiration après le texte précédent ({gap:.2f} s)")
                if vis < thr - 1e-6:
                    errs.append(f"{key}/{s['id']}/{m['id']} : lisible {vis:.2f} s pour un seuil de {thr:.2f} s")
                rep.append(dict(video=key, scene=s["id"], msg=m["id"], text=text, words=words(text), chars=len(text), thr=thr, vis=vis, d=s["d"]))
                m["thr"] = thr
                prev = m
            taps = s.get("taps", [])
            for i, (t, x, y) in enumerate(taps):
                if t < PRE_TAP + 0.4 - 1e-6:
                    errs.append(f"{key}/{s['id']} : toucher {i + 1} trop tôt (doigt visible {PRE_TAP} s avant)")
                if i and t - taps[i - 1][0] < PRE_TAP + POST_TAP - 1e-6:
                    errs.append(f"{key}/{s['id']} : touchers {i} et {i + 1} trop proches")
            if taps and s["d"] - taps[-1][0] < POST_TAP + 1.0 - 1e-6:
                errs.append(f"{key}/{s['id']} : pas assez de temps après le dernier toucher")
            vs = s.get("v0", 0.35)
            ve = s["d"] - (0.25 if s["kind"] != "final" else 0.1)
            wps, cps = words(s["v"]) / (ve - vs), len(s["v"]) / (ve - vs)
            if wps > 2.7 or cps > 17:
                errs.append(f"{key}/{s['id']} : voix trop dense ({wps:.2f} mots/s, {cps:.1f} signes/s)")
            split_sub(s["v"])
            s["_wps"], s["_cps"] = round(wps, 2), round(cps, 1)
        if not 35 <= tot <= 45:
            errs.append(f"{key} : durée totale {tot:.1f} s hors de 35 à 45 s")
        if not 6 <= len(v["scenes"]) <= 8:
            errs.append(f"{key} : {len(v['scenes'])} scènes (6 à 8 attendues)")
    return rep, errs


if __name__ == "__main__":
    rep, errs = check()
    for r in rep:
        print(r["video"], r["scene"], r["msg"], f"{r['vis']:.2f} / {r['thr']:.2f}", r["text"])
    for v in VIDEOS.values():
        print(v["out"], round(sum(s["d"] for s in v["scenes"]), 1), "s")
    print("ERREURS" if errs else "OK", *errs, sep="\n")
