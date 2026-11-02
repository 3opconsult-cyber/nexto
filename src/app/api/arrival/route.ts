import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { geocodeAddress } from '@/lib/geocode'
import { judgeProximity } from '@/lib/arrival'
import { systemSender } from '@/lib/systemMessage'

// Voie B « client absent » : le prestataire, sur place, envoie sa position (consentement explicite, un seul
// relevé) ; on la compare à l'adresse de la mission (lat/lng de la demande, sinon géocodage OSM) puis la RPC
// request_arrival_code génère un code à 6 chiffres (hash en base, 15 min, 5 essais) que SEUL le client lit
// dans l'application. Le code n'est jamais renvoyé ici. Les coordonnées de l'adresse ne sortent pas du serveur.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fail = (error: string, message: string, status: number, extra: object = {}) =>
  NextResponse.json({ ok: false, error, message, ...extra }, { status })

export async function POST(req: Request) {
  try {
    let b: any = {}
    try { b = await req.json() } catch { }
    if (b.consent !== true) return fail('consent', 'Le consentement à l’utilisation de votre position est nécessaire.', 400)
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
      .select('id, seller_id, status, arrived_at, price_confirmed, address_status, requests(lat, lng, address)')
      .eq('id', b.transactionId).maybeSingle()
    if (!tx || tx.seller_id !== user.id) return fail('forbidden', 'Réservé au prestataire de la mission.', 403)
    if (tx.status !== 'pending' || tx.arrived_at) return fail('not_ready', 'Cette mission est déjà commencée ou annulée.', 409)
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

    const { data: rpc, error } = await supabase.rpc('request_arrival_code', {
      p_transaction: tx.id, p_lat: lat, p_lng: lng,
      p_distance_m: verdict.status === 'conforme' ? verdict.distanceM : null, p_geo_status: geo,
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
