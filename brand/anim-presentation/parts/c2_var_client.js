  // ---------- variante : « PING pour les particuliers » (/animation-client) ----------
  // Scénario (Romain, 3/11) : 1 accroche · 2 la carte (les prestataires autour de vous) · 3 vous choisissez votre prestataire ·
  // 4 le chat : vous validez le prix et payez, paiement sous séquestre · 5 à son arrivée, QR de sécurité · 6 vous notez votre
  // prestataire · 7 final (QR /l/ins + « Je m'inscris »). Aucune nouvelle illustration : ce sont des tronçons du temps SOURCE de
  // d_scenes.js, rejoués dans cet ordre (segs, assemblés par e_split.js). Pas de tuto d'inscription, agenda, facture ni litige ici
  // (ils restent dans /animation-ping et /aide). Écrans d'argument (créneaux ARG0 + 3 s × n, n = rang dans `args`) : profils détaillés (43,2), QR arrivée et départ (46,2),
  // avis (49,2), service litige (52,2). Ajouts du 3/11 : « Des profils détaillés » après le choix, « Un service litige » avant le final.
  var VAR = {
    label: function(t){ return 'PING · L’application'; },
    screens: [['sMap', 4.6], ['sChat', 10.8], ['sMapT', 26.9]],
    extra: [
      { i: 'idc', l: [['Des profils'], ['vérifiés par PING.', 'g']], s: ['Photo et pièces contrôlées :', 'vous savez qui vient.'], badges: [{ i: 'idc', t: 'Pièce|d’identité' }, { i: 'shield', t: 'Assurance' }, { i: 'building', t: 'Kbis' }, { i: 'doc', t: 'Attestation|URSSAF' }, { i: 'done', t: 'Missions|réalisées' }] },
      { i: 'scales', l: [['Un service litige,'], ['tout est centralisé.', 'g']], s: ['Historique, factures, échanges et dossier', 'de litige au même endroit.'] }
    ],
    args: [7, 3, 4, 8],   // 7 profils · 3 QR · 4 avis · 8 litige
    argEdit: function(A){
      A[1].l = [['Un QR code à l’arrivée'], ['et au départ :'], ['l’heure fait foi.', 'g']];
      A[1].s = 'Arrivée et départ sont pointés par QR code.';
      A[2].l = [['Vous notez'], ['votre prestataire'], ['en quelques clics.', 'g']];
      A[2].s = 'Un avis croisé après chaque mission.';
    },
    caps: function(C){
      C.length = 0;
      C.push({ a: 4.7,  b: 7.8,  lines: ['Les prestataires disponibles', 'autour de vous.'] },
             { a: 27.6, b: 30.2, lines: ['Vous choisissez', 'votre prestataire.'] },
             { a: 10.9, b: 13.5, lines: ['Vous validez le prix et', 'payez directement dans le chat.'] },
             { a: 13.5, b: 14.75, lines: ['Votre paiement reste sous séquestre', 'jusqu’à la fin de la mission.'] });
    },
    // [début source, fin source, fondu au navy à la jonction, vitesse]
    segs: [[0, 7.8, false], [27.6, 30.2, true, 0.8], [43.3, 46.2, true], [10.9, 14.75, true, 0.6], [46.2, 55.2, true], [64.2, 69.5, true]],
    end: { e1: 'PING, l’application de rencontre', e2: 'client-prestataire, en proximité · Côte d’Azur', e5: 'nexto-eta.vercel.app/l/ins' },
    ui: [   // k = rang du tronçon dans segs
      { k: 0, s: 0,    title: 'Accroche', d: "Logo PING et son écho radar : « Et si ce que vous cherchez se trouvait juste à côté ? »" },
      { k: 0, s: 4.6,  title: 'La carte', d: "Les prestataires disponibles autour de vous, sur la carte." },
      { k: 1, s: 27.6, title: 'Vous choisissez votre prestataire', d: "Le service choisi, la fiche du prestataire sur la carte, puis « Contacter »." },
      { k: 2, s: 43.2, title: 'Des profils détaillés', d: "Pièces fournies, assurance renseignée : vous savez qui vient." },
      { k: 3, s: 10.9, title: 'Le chat, le prix et le paiement', d: "Vous validez le prix et payez directement dans le chat ; le paiement reste sous séquestre jusqu'à la fin de la mission." },
      { k: 4, s: 46.2, title: 'QR de sécurité : arrivée et départ', d: "Un QR code à l'arrivée et au départ : l'heure fait foi." },
      { k: 4, s: 49.2, title: 'Vous notez votre prestataire', d: "Un avis en quelques clics après la mission." },
      { k: 4, s: 52.2, title: 'Un service litige', d: "Historique, factures, échanges et dossier de litige au même endroit." },
      { k: 5, s: 64.2, title: 'Final', d: "Logo PING, QR code d'inscription (/l/ins) et bouton « Je m'inscris » (page web seulement)." }
    ]
  };
