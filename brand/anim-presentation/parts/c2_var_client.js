  // ---------- variante : « PING pour les particuliers » (/animation-client) ----------
  // Scènes reprises de la présentation, sans doublon : le temps SOURCE est celui de d_scenes.js ; segs (e_split.js) dit
  // quels tronçons se jouent, à la suite. Rien du côté prestataire (carte « Demandes autour de moi », tuto « Je suis
  // prestataire », écrans profil / tarifs / disponibilités). Les arguments (créneaux 43,2 + 3 s × n) : QR, avis, litige, paiement.
  var VAR = {
    label: function(t){ return t < 20.2 ? 'PING · L’application' : 'PING · Je cherche un prestataire'; },
    screens: [['sMap', 4.6], ['sChat', 10.8], ['sAgenda', 14.8], ['sFact', 17.4], ['sQR', 20.7], ['sSign', 23.4], ['sMapT', 26.9]],
    args: [3, 4, 5, 6],
    caps: function(C){
      C.splice(9, 4);                      // légendes prestataire (tuto « Je suis prestataire »)
      C.splice(1, 1);                      // « Côté pro : les demandes à portée »
      C[0].lines = ['Les prestataires disponibles', 'autour de vous.'];
    },
    // [début source, fin source, fondu au navy à la jonction]
    segs: [[0, 7.8, false], [10.85, 30.55, true], [43.3, 55.2, true], [64.2, 69.5, false]],
    end: { e1: 'PING pour les particuliers.', e5: 'nexto-eta.vercel.app/l/ins' },
    ui: [
      { s: 0,    title: 'Accroche', d: "Logo PING et son écho radar : « Et si ce que vous cherchez se trouvait juste à côté ? »" },
      { s: 4.6,  title: 'La carte', d: "Les prestataires disponibles près de chez soi, avec « Contacter » et « Déposer une demande »." },
      { s: 10.8, title: 'Le chat et le prix', d: "Le prestataire propose un devis, le client l'accepte : le tarif est validé et appliqué à la mission. Puis « Fixez le rendez-vous »." },
      { s: 14.8, title: 'Agenda et facture', d: "Le rendez-vous confirmé s'ajoute à l'agenda. À la fin de la mission, la facture est générée automatiquement ; règlement par virement." },
      { s: 20.2, title: 'Je cherche un prestataire', d: "Ouvrir le lien (QR code), créer son compte en deux étapes, choisir le service sur la carte, puis Contacter ou Déposer une demande." },
      { s: 43.2, title: 'QR de sécurité : l’heure fait foi', d: "QR code à l'arrivée et au départ." },
      { s: 46.2, title: 'Prestataires et clients se notent', d: "Avis croisés après chaque mission." },
      { s: 49.2, title: 'Service litige', d: "Un dossier, un médiateur PING." },
      { s: 52.2, title: 'Paiement sécurisé : bientôt', d: "Séquestre et versement sous 48 h : badge BIENTÔT, jamais présenté comme actif. En attendant : règlement par virement sur facture." },
      { s: 64.2, title: 'Final', d: "Logo PING, QR code d'inscription (/l/ins) et bouton « Je m'inscris » (page web seulement)." }
    ]
  };
