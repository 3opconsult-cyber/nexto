"use strict";
// Erreurs réseau : une seule phrase française claire, partout (audit GPS et hors connexion du 23/11/2026, correction 3).
// Le navigateur dit « Failed to fetch » (Chrome), « Load failed » (Safari) ou « NetworkError… » (Firefox) quand le
// réseau est coupé : ces textes bruts ne s'affichent plus jamais.
Object.defineProperty(exports, "__esModule", { value: true });
exports.pingFetch = exports.isNetworkMessage = exports.NET_EVENT = exports.ERR_MS = exports.SLOW_TEXT = exports.OFFLINE_TEXT = void 0;
exports.friendlyError = friendlyError;
exports.OFFLINE_TEXT = 'Pas de connexion. Vérifiez votre réseau, puis réessayez.';
exports.SLOW_TEXT = 'La connexion est trop lente. Réessayez dans un instant.';
/** Durée d'affichage d'un message d'erreur (avant : 4 s, trop court pour lire sur un téléphone). */
exports.ERR_MS = 9000;
exports.NET_EVENT = 'ping:net';
const NET_RE = /failed to fetch|networkerror|network request failed|load failed|fetch failed|network error|err_internet|err_network|err_connection/i;
const isNetworkMessage = (m) => !!m && (NET_RE.test(m) || m === exports.OFFLINE_TEXT);
exports.isNetworkMessage = isNetworkMessage;
/** Phrase française pour une erreur quelconque (Error, texte, erreur Supabase). Jamais de texte anglais brut du navigateur. */
function friendlyError(e, fallback = 'Une erreur est survenue. Réessayez dans un instant.') {
    const m = typeof e === 'string' ? e : e?.message;
    if (!m)
        return fallback;
    if ((0, exports.isNetworkMessage)(m))
        return exports.OFFLINE_TEXT;
    if (/abort|timeout|timed out/i.test(m))
        return exports.SLOW_TEXT;
    return m;
}
function emit(kind) {
    try {
        if (typeof window !== 'undefined')
            window.dispatchEvent(new CustomEvent(exports.NET_EVENT, { detail: kind }));
    }
    catch { /* sans objet */ }
}
/**
 * `fetch` du client Supabase : une coupure réseau ne lève plus « TypeError: Failed to fetch » mais devient une réponse
 * 503 portant la phrase française. Toutes les erreurs affichées par l'application (lectures, écritures, stockage)
 * sont ainsi lisibles sans toucher chaque écran. Annulation (abort) : relancée telle quelle. La bannière globale
 * écoute NET_EVENT.
 */
const pingFetch = async (input, init) => {
    try {
        const r = await fetch(input, init);
        emit('ok');
        return r;
    }
    catch (e) {
        if (e?.name === 'AbortError')
            throw e;
        emit('fail');
        return new Response(JSON.stringify({ code: 'PING_OFFLINE', message: exports.OFFLINE_TEXT, msg: exports.OFFLINE_TEXT, error: exports.OFFLINE_TEXT, error_description: exports.OFFLINE_TEXT }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
};
exports.pingFetch = pingFetch;
