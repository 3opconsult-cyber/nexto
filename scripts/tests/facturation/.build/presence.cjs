"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rowHasPresence = exports.PRESENCE_PHOTO_BUCKET = exports.requestEndCode = exports.clientSendPresenceCode = exports.setClientPresence = exports.durLabel = exports.PRESENCE_WARNING = exports.hasProcess = void 0;
exports.isMissingFunction = isMissingFunction;
exports.presenceAvailable = presenceAvailable;
exports.getPresenceState = getPresenceState;
exports.getMissionProof = getMissionProof;
exports.validatePresence = validatePresence;
exports.clientConfirmPresence = clientConfirmPresence;
exports.clientDeclinePresence = clientDeclinePresence;
exports.requestRemotePresence = requestRemotePresence;
exports.proofLabel = proofLabel;
exports.presenceSentence = presenceSentence;
exports.billedLabel = billedLabel;
exports.parseScanned = parseScanned;
exports.uploadPresencePhoto = uploadPresencePhoto;
exports.presencePhotoUrl = presencePhotoUrl;
exports.presenceTagLabel = presenceTagLabel;
const netError_1 = require("@/lib/netError");
/** Process de commande (migration 048) : présence annoncée, photo d'arrivée, codes envoyés par le client. */
const hasProcess = (st) => !!st && Number(st.v) >= 48;
exports.hasProcess = hasProcess;
// Fonction absente (migration pas encore appliquée) : PostgREST répond PGRST202, Postgres 42883.
function isMissingFunction(error) {
    if (!error)
        return false;
    return error.code === 'PGRST202' || error.code === '42883' || /could not find the function|does not exist/i.test(error.message || '');
}
let available = null;
/** La migration 038 est-elle en base ? (mémorisé pour la session de la page ; un échec réseau n'est pas mémorisé). */
function presenceAvailable(supabase) {
    if (available)
        return available;
    available = (async () => {
        // Colonne posée par la même migration que les fonctions (038). L'ancienne sonde (presence_state sur un
        // identifiant nul) répondait toujours 400 « Mission introuvable » : une erreur réseau dans la console à
        // chaque page (barre du bas, chat, agenda), relevée par le parcours e2e du 19/11.
        const { error } = await supabase.from('transactions').select('completion_proof').limit(1);
        if (!error)
            return true;
        if (error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist|could not find .* column/i.test(error.message || ''))
            return false;
        available = null;
        return false;
    })();
    return available;
}
// Lectures simultanées de la même mission : une seule requête partagée (la barre du bas, le menu et la page
// l'interrogeaient chacun, audit 21/11). Rien n'est gardé une fois la réponse reçue : un rechargement après
// une action relit toujours la base.
const presenceInFlight = new Map();
function getPresenceState(supabase, txId) {
    const hit = presenceInFlight.get(txId);
    if (hit)
        return hit;
    const p = (async () => {
        const { data, error } = await supabase.rpc('presence_state', { p_transaction: txId });
        if (error || !data)
            return null;
        return data;
    })().finally(() => { if (presenceInFlight.get(txId) === p)
        presenceInFlight.delete(txId); });
    presenceInFlight.set(txId, p);
    return p;
}
// Deux demandes simultanées du QR d'une même mission créeraient deux codes (le dernier écrase le premier : l'écran
// afficherait un code périmé). Une seule requête partagée tant qu'elle n'a pas répondu.
const proofInFlight = new Map();
function getMissionProof(supabase, txId, phase) {
    const key = txId + ':' + (phase ?? '');
    const hit = proofInFlight.get(key);
    if (hit)
        return hit;
    const p = (async () => {
        const { data, error } = await supabase.rpc('get_mission_proof', { p_transaction: txId, p_phase: phase ?? null });
        if (error)
            return { proof: null, error: error.message };
        return { proof: data };
    })().finally(() => { if (proofInFlight.get(key) === p)
        proofInFlight.delete(key); });
    proofInFlight.set(key, p);
    return p;
}
async function validatePresence(supabase, txId, phase, proof) {
    const { data, error } = await supabase.rpc('validate_presence', { p_transaction: txId, p_phase: phase, p_proof: proof });
    if (error)
        return { ok: false, reason: isMissingFunction(error) ? 'unavailable' : 'error', message: error.message };
    return data;
}
async function clientConfirmPresence(supabase, txId, phase) {
    const { data, error } = await supabase.rpc('client_confirm_presence', { p_transaction: txId, p_phase: phase });
    if (error)
        return { ok: false, reason: 'error', message: error.message };
    return data;
}
async function clientDeclinePresence(supabase, txId, phase) {
    const { data, error } = await supabase.rpc('client_decline_presence', { p_transaction: txId, p_phase: phase });
    if (error)
        return { ok: false, reason: 'error', message: error.message };
    return data;
}
/**
 * Client absent : le prestataire (consentement donné) envoie sa position ; /api/arrival compare et prévient le client.
 * Migration 048 : `photoPath` (photo prise sur place, obligatoire à l'arrivée) part avec, dans un seul message.
 * `dryRun` : la route ne fait QUE les contrôles (mission, état, distance) et ne pose rien. Appelé AVANT le téléversement
 * de la photo : une position éloignée ou une mission non prête ne laisse plus de photo orpheline au stockage.
 * Panne réseau : `error: 'network'` (renvoi possible) ; erreur du serveur : `error: 'server'`.
 */
async function requestRemotePresence(txId, phase, pos, photoPath, dryRun = false) {
    try {
        const r = await fetch('/api/arrival', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactionId: txId, phase, lat: pos.lat, lng: pos.lng, accuracy: pos.accuracyM ?? null, consent: true, photoPath: photoPath ?? null, dryRun }),
        });
        return await r.json();
    }
    catch {
        return { ok: false, error: 'network', message: netError_1.OFFLINE_TEXT };
    }
}
// Libellés (facture, récapitulatif, frise). Ancien arrival_method (033) accepté en repli. La phase précise le mode
// réel à distance (048) : photo et position à l'arrivée, code de fin envoyé par le client à la fin.
function proofLabel(p, phase) {
    switch (p) {
        case 'qr':
        case 'qr_client': return 'QR du client scanné sur place';
        case 'code': return 'code du client saisi sur place';
        case 'qr_sur_place': return 'QR laissé sur place par le client';
        case 'distance_code':
        case 'geoloc_code':
            return phase === 'fin' ? 'client absent, code de fin envoyé par le client et saisi par le prestataire'
                : 'client absent, code de validation du client';
        case 'distance_confirmation':
            return phase === 'fin' ? 'client absent, fin confirmée par le client' : 'client absent, arrivée confirmée par le client';
        case 'admin': return 'heure fixée par PING';
        case 'photo_gps': return 'photo et position du prestataire (ancien mode)';
        default: return null;
    }
}
/** Phrase de la facture : « 10:02 — 12:14, arrivée : QR…, fin : confirmée… ». */
function presenceSentence(arrivee, depart, pa, pd, photo) {
    if (!arrivee || !depart)
        return null;
    let a = proofLabel(pa, 'arrivee');
    const d = proofLabel(pd, 'fin');
    // Migration 048 : photo d'arrivée envoyée dans la messagerie (client absent).
    if (photo && a?.startsWith('client absent, '))
        a = a.replace('client absent, ', 'client absent, photo et position envoyées, ');
    if (!a && !d)
        return `${arrivee} — ${depart}, horodatés dans l'application`;
    if (a && d && a === d)
        return `${arrivee} — ${depart}, ${a}`;
    return `${arrivee} — ${depart} (arrivée : ${a || 'horodatée'} ; fin : ${d || 'horodatée'})`;
}
exports.PRESENCE_WARNING = {
    en_avance: 'Plus de 30 min avant l’heure du rendez-vous.',
    en_retard: 'Plus de 3 h après l’heure du rendez-vous.',
    sans_rdv: 'Aucune heure de rendez-vous n’a été fixée.',
    tres_court: 'Moins de 5 min sur place.',
    tres_long: 'Plus de 12 h sur place.',
};
/**
 * Heures facturées d'un aperçu de fin, au bon sens : pour un forfait avec heures incluses, `billed_hours` compte
 * les heures AU-DELÀ du forfait (le parcours e2e du 19/11 affichait « → 0 h facturée, 90,00 € » pour un forfait).
 * Renvoie le fragment à placer après la durée (« → 2 h facturées », « forfait, sans dépassement »…), ou ''.
 */
function billedLabel(a, forfait) {
    if (!a)
        return '';
    if (!a.recalcule || a.billed_hours == null)
        return forfait ? ' (forfait, prix inchangé)' : '';
    const n = Number(a.billed_hours);
    const h = `${String(a.billed_hours).replace('.', ',')} h`;
    if (forfait)
        return n > 0 ? ` → forfait + ${h} au-delà des heures incluses` : ' → forfait, sans dépassement';
    return ` → ${h} facturée${n > 1 ? 's' : ''}`;
}
const durLabel = (mins) => {
    const h = Math.floor(mins / 60), m = mins % 60;
    return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
};
exports.durLabel = durLabel;
/** Extrait la preuve d'un QR scanné : URL /mission/<id>/scan/<phase>?token=… ou jeton brut. */
function parseScanned(raw) {
    const s = raw.trim();
    try {
        const u = new URL(s);
        const m = u.pathname.match(/\/mission\/([0-9a-f-]{36})\/scan\/([a-z]+)/i);
        return { txId: m?.[1], phase: m?.[2], token: u.searchParams.get('token') || '' };
    }
    catch {
        return { token: s };
    }
}
async function rpcResult(p) {
    const { data, error } = await p;
    if (error)
        return { ok: false, reason: isMissingFunction(error) ? 'unavailable' : 'error', message: error.message };
    return (data ?? { ok: false, reason: 'error', message: 'Réponse vide.' });
}
/** Le client annonce « Je serai sur place » / « Je ne serai pas sur place » (modifiable jusqu'à l'arrivée). */
const setClientPresence = (supabase, txId, presence) => rpcResult(supabase.rpc('set_client_presence', { p_transaction: txId, p_presence: presence }));
exports.setClientPresence = setClientPresence;
/** Client absent : le client envoie son code (validation d'arrivée ou code de fin), affiché et posté dans le fil. */
const clientSendPresenceCode = (supabase, txId, phase) => rpcResult(supabase.rpc('client_send_presence_code', { p_transaction: txId, p_phase: phase }));
exports.clientSendPresenceCode = clientSendPresenceCode;
/** Client absent, fin : le prestataire demande le code de fin (aucune position). */
const requestEndCode = (supabase, txId) => rpcResult(supabase.rpc('request_end_code', { p_transaction: txId }));
exports.requestEndCode = requestEndCode;
exports.PRESENCE_PHOTO_BUCKET = 'presence-photos';
/** Photo d'arrivée (client absent) : bucket privé, `<uid>/<mission>/<horodatage>.<ext>`. */
async function uploadPresencePhoto(supabase, uid, txId, file) {
    if (file.size > 10 * 1024 * 1024)
        return { error: 'Photo trop lourde (10 Mo au plus).' };
    const ext = ((file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '')) || 'jpg';
    const path = `${uid}/${txId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(exports.PRESENCE_PHOTO_BUCKET).upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' });
    if (error)
        return { error: (0, netError_1.isNetworkMessage)(error.message) ? netError_1.OFFLINE_TEXT : 'Photo non envoyée : réessayez.', network: (0, netError_1.isNetworkMessage)(error.message) };
    return { path };
}
async function presencePhotoUrl(supabase, path) {
    if (!path)
        return null;
    const { data } = await supabase.storage.from(exports.PRESENCE_PHOTO_BUCKET).createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
}
/** Pastille de présence : « Client sur place » / « Client absent » côté pro, « Vous serez… » côté client. */
function presenceTagLabel(p, asSeller) {
    if (p === 'sur_place')
        return { text: asSeller ? 'Client sur place' : 'Vous serez sur place', warn: false, none: false };
    if (p === 'absent')
        return { text: asSeller ? 'Client absent' : 'Vous serez absent', warn: true, none: false };
    return { text: asSeller ? 'Présence non indiquée' : 'Serez-vous sur place ?', warn: false, none: true };
}
/** Colonne présente sur une ligne lue avec `select('*')` : la migration 048 est appliquée. */
const rowHasPresence = (tx) => !!tx && Object.prototype.hasOwnProperty.call(tx, 'client_presence');
exports.rowHasPresence = rowHasPresence;
