"""Modèles d'e-mails PING -> public/brand/emails/<nom>.html + <nom>.txt (servis sur /brand/emails/...).

Une seule source par modèle (ce fichier) pour la version HTML et la version texte : elles disent la même chose.
HTML « messagerie » : tableaux, styles en ligne, aucune image ni police web, aucun script (Gmail, Outlook et les
applications mobiles les ignorent ou les bloquent). Liens tracés = codes /l/<code> de src/app/l/[code]/route.ts
(epr, epr2, ecl, ecl2, eap, eac, eent). Plan d'utilisation : docs/plan-marketing-outils.md.

Règles (CLAUDE.md) : aucune marque tierce, pas d'emoji, langage déclaratif (« pièce fournie », « assurance
renseignée » ; jamais certifié ni garanti), séquestre jamais présenté comme actif (règlement par virement, sur
facture ; avant-première : paiements pas encore réels). Les champs [Prénom], [Ville], [Votre prénom] sont à
remplacer à la main avant l'envoi.

Régénérer : python3 brand/emails/build.py
"""
import html
import re
import pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent.parent / "public" / "brand" / "emails"
SITE = "https://nexto-eta.vercel.app"
CONTACT = "info@opconsult.co"  # orthographe dictée par Romain, à confirmer (voir CLAUDE.md, plaquettes)

TEAL, NAVY, SLATE, PAPER, LINE = "#12B39C", "#123644", "#4E6470", "#F3F6F5", "#E7EDEB"
FONT = "Arial, Helvetica, sans-serif"

# Chaque bloc : ("p", texte) | ("ul", [items]) | ("cta", libellé, url) | ("link", texte avant, libellé, url)
# | ("note", texte) | ("sign",)
EMAILS = {
    "prospection-prestataire": {
        "titre": "Prospection prestataires (premier contact)",
        "objet": "Des clients près de chez vous, sans démarchage",
        "preheader": "Inscription gratuite à PING, l'application de services de proximité de la Côte d'Azur.",
        "blocs": [
            ("p", "Bonjour [Prénom],"),
            ("p", "Je lance PING sur la Côte d'Azur : une application qui met en relation les particuliers et les "
                  "prestataires de ménage, de repassage et de nettoyage installés juste à côté de chez eux."),
            ("p", "Pour vous, concrètement :"),
            ("ul", [
                "vous fixez vos tarifs (forfait, à l'heure ou sur devis) et vos disponibilités ;",
                "les demandes des clients autour de vous s'affichent sur votre carte, les urgentes en orange ;",
                "le prix est validé avec le client dans le chat, avant l'intervention ;",
                "l'arrivée et le départ sont validés par QR code, la facture est éditée automatiquement à votre nom ;",
                "l'inscription est gratuite et sans abonnement : PING ne prend une commission que sur les missions réalisées.",
            ]),
            ("cta", "Découvrir PING en 1 minute", "/l/epr"),
            ("link", "Vous préférez la vidéo ? ", "PING pour les prestataires, 45 secondes", "/animation-prestataire"),
            ("p", "Je serais ravi d'en parler dix minutes au téléphone : il suffit de répondre à ce message."),
            ("note", "PING est en avant-première : vous pouvez créer votre profil et tester l'application dès "
                     "maintenant. Les paiements en ligne ne sont pas encore ouverts."),
            ("sign",),
        ],
    },
    "relance-prestataire": {
        "titre": "Relance prestataires (J+4, une seule fois)",
        "objet": "PING : votre place à [Ville]",
        "preheader": "Cinq minutes pour créer votre profil de prestataire, gratuitement.",
        "blocs": [
            ("p", "Bonjour [Prénom],"),
            ("p", "Je me permets une courte relance de mon message de la semaine dernière. Les premiers prestataires "
                  "inscrits à [Ville] sont les premiers que les clients voient sur la carte."),
            ("p", "L'inscription prend environ cinq minutes :"),
            ("ul", [
                "votre métier et votre zone d'intervention ;",
                "vos tarifs, service par service ;",
                "vos pièces : pièce d'identité, assurance, et SIRET si vous êtes immatriculé.",
            ]),
            ("cta", "Créer mon profil de prestataire", "/l/epr2"),
            ("p", "Si ce n'est pas pour vous, répondez simplement « non merci » : je ne vous relancerai pas."),
            ("sign",),
        ],
    },
    "invitation-client": {
        "titre": "Invitation clients (avant-première)",
        "objet": "Je vous invite à tester PING en avant-première",
        "preheader": "Les prestataires de ménage et de repassage autour de chez vous, sur une seule carte.",
        "blocs": [
            ("p", "Bonjour [Prénom],"),
            ("p", "Vous cherchez parfois quelqu'un pour le ménage, le repassage ou un nettoyage ? PING montre sur une "
                  "carte les prestataires disponibles juste à côté de chez vous."),
            ("ul", [
                "vous voyez leur profil, leurs tarifs et leurs avis avant de choisir ;",
                "vous fixez le prix avec eux dans le chat, avant l'intervention ;",
                "l'arrivée et le départ sont validés par QR code, la facture arrive automatiquement ;",
                "un souci ? Tout est centralisé dans l'application, avec un service litige.",
            ]),
            ("p", "Nous ouvrons l'application à quelques personnes de [Ville] avant le lancement. Votre avis compte : "
                  "une bulle verte, dans l'application, vous permet de nous écrire à tout moment."),
            ("cta", "Découvrir PING", "/l/ecl"),
            ("link", "Ou en vidéo : ", "PING pour les particuliers, 35 secondes", "/animation-client"),
            ("note", "Version d'avant-première : l'inscription est gratuite, les paiements ne sont pas encore réels."),
            ("sign",),
        ],
    },
    "relance-client": {
        "titre": "Relance clients (J+5, une seule fois)",
        "objet": "Votre accès à PING vous attend",
        "preheader": "Deux étapes pour créer votre compte, gratuitement.",
        "blocs": [
            ("p", "Bonjour [Prénom],"),
            ("p", "Petit rappel : votre accès à l'avant-première de PING est toujours ouvert. Le compte se crée en deux "
                  "étapes, puis vous voyez la carte des prestataires autour de chez vous."),
            ("cta", "Créer mon compte", "/l/ecl2"),
            ("p", "Un retour, même court, nous aide beaucoup : ce qui vous manque, ce qui vous gêne, ce qui vous plaît."),
            ("p", "Si vous ne souhaitez plus recevoir de message, répondez « stop »."),
            ("sign",),
        ],
    },
    "apres-inscription-prestataire": {
        "titre": "Après l'inscription : prestataire",
        "objet": "Bienvenue sur PING : trois réglages pour être visible",
        "preheader": "Tarifs, disponibilités, pièces : votre profil complet en quelques minutes.",
        "blocs": [
            ("p", "Bonjour [Prénom],"),
            ("p", "Merci pour votre inscription. Pour que les clients vous trouvent et vous réservent, trois réglages "
                  "suffisent :"),
            ("ul", [
                "Mes tarifs : un prix par service (forfait, à l'heure ou sur devis) — " + SITE + "/pro/tarifs ;",
                "Mes disponibilités : les créneaux où l'on peut vous réserver — " + SITE + "/pro/disponibilites ;",
                "Mes pièces : pièce d'identité, assurance, SIRET si vous en avez un — " + SITE + "/pro/documents.",
            ]),
            ("p", "Une fois vos pièces contrôlées par l'équipe PING, votre profil affiche « profil vérifié par PING ». "
                  "Passez ensuite « Disponible » sur la carte : les demandes autour de vous apparaissent."),
            ("cta", "Ouvrir Mon entreprise", "/l/eap"),
            ("link", "Besoin d'un coup de main ? ", "Comment ça marche, en vidéos courtes", "/aide"),
            ("note", "Avant-première : les paiements en ligne ne sont pas encore ouverts. Vos remarques sont "
                     "précieuses : la bulle verte, dans l'application, nous les transmet directement."),
            ("sign",),
        ],
    },
    "apres-inscription-client": {
        "titre": "Après l'inscription : client",
        "objet": "Bienvenue sur PING : votre première demande",
        "preheader": "Contactez un prestataire sur la carte, ou déposez une demande.",
        "blocs": [
            ("p", "Bonjour [Prénom],"),
            ("p", "Merci pour votre inscription. Deux façons de commencer :"),
            ("ul", [
                "sur la carte, ouvrez le profil d'un prestataire proche et touchez « Contacter » ;",
                "ou déposez une demande (date, durée, budget) : les prestataires autour de vous y répondent — "
                + SITE + "/client/demandes/new.",
            ]),
            ("p", "Le prix se fixe dans le chat avant l'intervention. Votre adresse n'est transmise au prestataire "
                  "qu'une fois le rendez-vous confirmé."),
            ("cta", "Ouvrir la carte", "/l/eac"),
            ("link", "Pour tout comprendre en une minute : ", "Comment ça marche", "/aide"),
            ("note", "Avant-première : les paiements ne sont pas encore réels. Dites-nous ce que vous en pensez avec "
                     "la bulle verte, dans l'application."),
            ("sign",),
        ],
    },
    "entreprises": {
        "titre": "Entreprises de ménage et nettoyage (B2B)",
        "objet": "Vos équipes visibles auprès des clients de [Ville]",
        "preheader": "Un compte par salarié, votre planning ne change pas.",
        "blocs": [
            ("p", "Bonjour [Prénom],"),
            ("p", "Je lance PING sur la Côte d'Azur, une application qui met en relation les particuliers avec les "
                  "prestataires de ménage, de repassage et de nettoyage les plus proches."),
            ("ul", [
                "chaque salarié actif sur le terrain a son compte et apparaît dans sa zone d'intervention ;",
                "votre planning reste le vôtre : PING s'ajoute, sans réorganisation ;",
                "arrivée et départ validés par QR code, chaque mission tracée et facturée automatiquement ;",
                "inscription gratuite, commission seulement sur les missions réalisées.",
            ]),
            ("cta", "Voir la plaquette entreprises", "/l/eent"),
            ("p", "Je vous propose un échange de quinze minutes pour voir si cela correspond à votre organisation : "
                  "répondez à ce message ou écrivez à " + CONTACT + "."),
            ("note", "PING est en avant-première : les paiements en ligne ne sont pas encore ouverts."),
            ("sign",),
        ],
    },
}

SIGN_HTML = "Bien cordialement,<br>[Votre prénom]<br><span style=\"color:%s\">PING · services de proximité · Côte d'Azur</span>" % SLATE
SIGN_TXT = "Bien cordialement,\n[Votre prénom]\nPING · services de proximité · Côte d'Azur"
FOOT = ("PING, ménage, repassage et nettoyage à proximité, sur la Côte d'Azur. Contact : " + CONTACT +
        ". Vous recevez ce message parce que nous pensons qu'il peut vous intéresser ; pour ne plus rien recevoir, "
        "répondez simplement « stop ».")


def url(u):
    return u if u.startswith("http") else SITE + u


def fr(s):
    """Espaces insécables de la typographie française : jamais de « : » ou de « ; » seul en début de ligne."""
    for a, b in ((" :", "\u00a0:"), (" ;", "\u00a0;"), (" ?", "\u00a0?"), (" !", "\u00a0!"), ("« ", "«\u00a0"), (" »", "\u00a0»")):
        s = s.replace(a, b)
    return s


def e(s):
    return html.escape(fr(s), quote=True)


def linkify(s):
    """Texte échappé, URLs du site rendues cliquables (le texte affiché reste l'URL, lisible en version texte)."""
    return re.sub(r"(https://[^\s;,]+[^\s;,.])", r'<a href="\1" target="_blank" style="color:#0B8374">\1</a>', e(s))


def bloc_html(b):
    k = b[0]
    p = 'style="margin:0 0 16px;font-family:%s;font-size:15px;line-height:1.6;color:%s"' % (FONT, NAVY)
    if k == "p":
        return "<p %s>%s</p>" % (p, linkify(b[1]))
    if k == "ul":
        lis = "".join('<li style="margin:0 0 8px">%s</li>' % linkify(i) for i in b[1])
        return ('<ul style="margin:0 0 18px;padding-left:20px;font-family:%s;font-size:15px;line-height:1.55;'
                'color:%s">%s</ul>' % (FONT, NAVY, lis))
    if k == "cta":
        return (
            '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 22px">'
            '<tr><td align="center" bgcolor="%s" style="border-radius:999px">'
            '<a href="%s" target="_blank" style="display:inline-block;padding:13px 26px;font-family:%s;'
            'font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px">%s</a>'
            '</td></tr></table>' % (TEAL, e(url(b[2])), FONT, e(b[1])))
    if k == "link":
        return ('<p %s>%s<a href="%s" target="_blank" style="color:#0B8374;font-weight:bold">%s</a></p>'
                % (p, e(b[1]), e(url(b[3])), e(b[2])))
    if k == "note":
        return ('<p style="margin:0 0 18px;padding:12px 14px;background:%s;border-radius:10px;font-family:%s;'
                'font-size:13px;line-height:1.55;color:%s">%s</p>' % (PAPER, FONT, SLATE, e(b[1])))
    if k == "sign":
        return "<p %s>%s</p>" % (p, SIGN_HTML)
    raise ValueError(k)


def bloc_txt(b):
    k = b[0]
    if k == "p":
        return b[1]
    if k == "ul":
        return "\n".join("- " + i for i in b[1])
    if k == "cta":
        return "%s : %s" % (b[1], url(b[2]))
    if k == "link":
        return "%s%s : %s" % (b[1], b[2], url(b[3]))
    if k == "note":
        return b[1]
    if k == "sign":
        return SIGN_TXT
    raise ValueError(k)


PAGE = """<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>%(objet)s</title>
<!-- Modèle PING « %(titre)s ». Objet : %(objet)s. Généré par brand/emails/build.py : ne pas modifier à la main. -->
</head>
<body style="margin:0;padding:0;background:%(paper)s">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">%(preheader)s</div>
<table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" bgcolor="%(paper)s" style="background:%(paper)s">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px">
<tr><td style="padding:0 6px 14px;font-family:%(font)s;font-size:24px;font-weight:bold;letter-spacing:-0.5px;color:%(navy)s">ping<span style="color:%(teal)s">.</span></td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;border:1px solid %(line)s;border-radius:16px;padding:28px 26px 10px">
%(corps)s
</td></tr>
<tr><td style="padding:16px 8px 0;font-family:%(font)s;font-size:11.5px;line-height:1.55;color:%(slate)s">%(foot)s</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for nom, m in EMAILS.items():
        corps = "\n".join(bloc_html(b) for b in m["blocs"])
        page = PAGE % dict(objet=e(m["objet"]), titre=e(m["titre"]), preheader=e(m["preheader"]), corps=corps,
                           foot=e(FOOT), paper=PAPER, line=LINE, navy=NAVY, teal=TEAL, slate=SLATE, font=FONT)
        (OUT / (nom + ".html")).write_text(page)
        txt = "Objet : %s\n\n%s\n\n--\n%s\n" % (m["objet"], "\n\n".join(bloc_txt(b) for b in m["blocs"]), FOOT)
        (OUT / (nom + ".txt")).write_text(txt)
        print("écrit", nom)


if __name__ == "__main__":
    main()
