import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { geocodeAddress } from '@/lib/geocode'
import { judgeProximity } from '@/lib/arrival'
import { systemSender } from '@/lib/systemMessage'
import { isMissingFunction } from '@/lib/presence'

// Voie B « client absent » : le prestataire, sur place, envoie sa position (consentement explicite, un seul
// relevé) ; on la compare à l'adresse de la mission (lat/lng de la demande, sinon géocodage OSM) puis la RPC
// request_arrival_code génère un code à 6 chiffres (hash en base, 15 min, 5 essais) que SEUL le client lit
// dans l'application. Le code n'est jamais renvoyé ici. Les coordonnées de l'adresse ne sortent pas du serveur.
// Migration 038 : même chose pour la FIN (`phase: 'fin'`), via request_remote_presence, qui exige aussi
// « Je pars » avant l'arrivée, contrôle l'heure et pose lui-même le message au client (qui peut alors confirmer
// en un appui). Sans 038 : repli sur request_arrival_code (arrivée seulement).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fail = (error: string, message: string, status: number, extra: object = {}) =>
  NextResponse.json({ ok: false, error, message, ...extra }, { status })

export async function POST(req: Request) {
  try {
    let b: any = {}
    try { b = await req.json() } catch { }
    if (b.consent !== true) return fail('consent', 'Le consentement à l’utilisation de votre position est nécessaire.', 400)
    const phase: 'arrivee' | 'fin' = b.phase === 'fin' ? 'fin' : 'arrivee'
    const lat = Number(b.lat), lng = Number(b.lng)
    const accuracy = b.accuracy == null ? null : Number(b.accuracy)
    if (typeof b.transactionId !== 'string' || !UUID.test(b.transactionId)
      || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return fail('invalid', 'Requête invalide.', 400)
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return fail('auth', 'Connectez-vous avec le compte du prestataire.', 401)

    const { data: tx } = await supabase.from('transactions')
      .select('id, seller_id, status, en_route_at, arrived_at, completed_at, price_confirmed, address_status, requests(lat, lng, address)')
      .eq('id', b.transactionId).maybeSingle()
    if (!tx || tx.seller_id !== user.id) return fail('forbidden', 'Réservé au prestataire de la mission.', 403)
    if (phase === 'arrivee' && (tx.status !== 'pending' || tx.arrived_at)) return fail('not_ready', 'Cette mission est déjà commencée ou annulée.', 409)
    if (phase === 'arrivee' && !tx.en_route_at) return fail('not_ready', 'Annoncez d’abord votre départ (« Je pars »).', 409)
    if (phase === 'fin' && (!tx.arrived_at || tx.completed_at || tx.status === 'cancelled')) return fail('not_ready', 'La mission n’est pas en cours.', 409)
    // Même condition que l'affichage de l'adresse : rendez-vous confirmé et adresse acceptée.
    if (!tx.price_confirmed || !['profil', 'acceptee'].includes(tx.address_status ?? 'profil')) {
      return fail('not_ready', 'Le rendez-vous ou son adresse n’est pas encore confirmé.', 409)
    }

    const rq: any = Array.isArray(tx.requests) ? tx.requests[0] : tx.requests
    let target: { lat: number; lng: number } | null = null
    if (rq?.lat != null && rq?.lng != null) target = { lat: Number(rq.lat), lng: Number(rq.lng) }
    else if (rq?.address) target = await geocodeAddress(String(rq.address))

    const verdict = judgeProximity({ lat, lng, accuracyM: accuracy }, target)
    if (verdict.status === 'trop_loin') {
      return fail('too_far', 'Votre position semble éloignée de l’adresse du rendez-vous. Rapprochez-vous puis réessayez.', 422,
        { distanceM: Math.round(verdict.distanceM / 100) * 100 })
    }
    const geo = verdict.status === 'conforme' ? 'conforme' : 'non_verifiable'

    const distance = verdict.status === 'conforme' ? Math.round(verdict.distanceM) : null
    // Contrôle seul (audit 23/11, correction 4) : le téléphone demande l'avis du serveur AVANT de téléverser la photo.
    // Mêmes contrôles que l'envoi réel (auteur, état de la mission, distance), rien n'est écrit : aucune photo orpheline
    // sur un refus. L'envoi réel refait les mêmes contrôles ; la base reste seule juge de l'heure.
    if (b.dryRun === true) return NextResponse.json({ ok: true, dryRun: true, geo, distanceM: distance })
    // Migration 048 : arrivée avec la photo prise sur place (obligatoire), un seul message avec photo, distance
    // et heure. Fonction absente : repli sur 038 (sans photo), puis 033.
    const photoPath = typeof b.photoPath === 'string' && b.photoPath.length < 300 ? b.photoPath : null
    let v2: any = null
    let e2: any = null
    if (phase === 'arrivee' && photoPath) {
      const r48 = await supabase.rpc('request_absent_arrival', {
        p_transaction: tx.id, p_lat: lat, p_lng: lng, p_distance_m: distance, p_geo_status: geo, p_photo_path: photoPath,
      })
      if (!r48.error || !isMissingFunction(r48.error)) { v2 = r48.data; e2 = r48.error }
    }
    if (!v2 && !e2) {
      const r38 = await supabase.rpc('request_remote_presence', {
        p_transaction: tx.id, p_phase: phase, p_lat: lat, p_lng: lng, p_distance_m: distance, p_geo_status: geo,
      })
      v2 = r38.data; e2 = r38.error
    }
    if (!e2) {
      if (!v2?.ok) {
        const code = v2?.reason === 'too_many' ? 'too_many' : v2?.reason === 'throttled' ? 'throttled' : (v2?.reason || 'not_ready')
        return fail(code, v2?.message || 'Demande refusée.', code === 'too_many' || code === 'throttled' ? 429 : 409)
      }
      // Le message au client est posé par la base (request_remote_presence).
      return NextResponse.json({ ok: true, geo, distanceM: distance, expiresAt: v2.expires_at, confirmUntil: v2.confirm_until })
    }
    if (!isMissingFunction(e2)) return fail('server', e2.message, 400)
    if (phase === 'fin') return fail('unavailable', 'La fin à distance n’est pas encore disponible : utilisez le QR de fin du client.', 409)

    // Repli : migration 038 absente.
    const { data: rpc, error } = await supabase.rpc('request_arrival_code', {
      p_transaction: tx.id, p_lat: lat, p_lng: lng, p_distance_m: distance, p_geo_status: geo,
    })
    if (error) return fail('server', error.message, 400)
    if (!rpc?.ok) {
      return rpc?.reason === 'too_many'
        ? fail('too_many', 'Trop de demandes de code pour cette mission. Contactez le support PING.', 429)
        : fail('throttled', 'Un code vient d’être envoyé au client : patientez une minute avant d’en demander un autre.', 429)
    }

    await supabase.from('messages').insert({
      transaction_id: tx.id, ...(await systemSender(supabase)),
      body: 'Le prestataire indique être sur place et ne pas vous y trouver. Pour confirmer sa présence, ouvrez « Codes QR » de cette mission : un code à 6 chiffres y est affiché (valable 15 minutes). '
        + 'Ne le communiquez que si le prestataire est bien là. '
        + (geo === 'conforme' ? 'Sa position déclarée correspond à l’adresse du rendez-vous.' : 'Sa position n’a pas pu être comparée à l’adresse du rendez-vous.'),
    })

    return NextResponse.json({ ok: true, geo, expiresAt: rpc.expires_at })
  } catch {
    return fail('server', 'Erreur inattendue, réessayez.', 500)
  }
}
