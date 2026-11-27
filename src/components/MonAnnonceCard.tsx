"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { canPublish, loadListingFacts } from '@/lib/listing'

// Carte « Mon annonce » de Mon entreprise : l'état de l'annonce, sa complétude et les actions à un appui.
// Mêmes garde-fous que /pro/annonce (setOnline) : compte suspendu = lecture seule ; remise en ligne seulement avec
// un tarif et une position (canPublish). « Retirer de la carte » = la même mise en pause (provider_profiles.is_active
// = false), réversible : rien n'est supprimé. Avant de passer hors ligne : second appui (jamais confirm()).
// Un « Brouillon » est une annonce hors ligne à laquelle il manque un tarif ou une position (déduit, aucun statut en base).

type Etat = 'ligne' | 'pause' | 'suspendue' | 'brouillon'
const NAVY = '#123644', SLATE = '#4E6470'

export default function MonAnnonceCard({ pro, pct, canPublishNow, onActive }: {
  pro: any; pct: number | null; canPublishNow: boolean | null; onActive: (v: boolean) => void
}) {
  const router = useRouter()
  const suspended = !!pro?.payments_suspended_at
  const active = !!pro?.is_active
  const etat: Etat = suspended ? 'suspendue' : active ? 'ligne' : canPublishNow === false ? 'brouillon' : 'pause'
  const [ask, setAsk] = useState<null | 'pause' | 'retirer'>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const META: Record<Etat, { titre: string; texte: string; dot: string }> = {
    ligne: { titre: 'En ligne · visible sur la carte', texte: '', dot: '#12B39C' },
    pause: { titre: 'En pause', texte: 'Votre annonce n’apparaît pas sur la carte. Vos missions en cours continuent.', dot: '#A5B3B9' },
    suspendue: { titre: 'Suspendue par PING', texte: 'Compte suspendu : contactez le support PING pour régulariser.', dot: '#B3402F' },
    brouillon: { titre: 'Brouillon', texte: 'Il manque un tarif ou votre position pour la mettre en ligne.', dot: '#F2A93B' },
  }
  const m = META[etat]

  async function write(next: boolean) {
    setBusy(true); setMsg('')
    const { error } = await createClient().from('provider_profiles').update({ is_active: next }).eq('id', pro.id)
    setBusy(false); setAsk(null)
    if (error) { setMsg(/suspendu/i.test(error.message) ? 'Compte suspendu : contactez le support PING pour le réactiver.' : 'Le changement n’a pas pu être enregistré. Réessayez dans un instant.'); return }
    onActive(next)
  }
  async function putOnline() {
    if (suspended) { setMsg('Votre compte est suspendu : l’annonce ne peut pas être remise en ligne. Contactez le support PING.'); return }
    setBusy(true); setMsg('')
    try {
      const r = await loadListingFacts(createClient(), pro.id, pro)
      const { ok, missing } = canPublish(r.facts)
      if (!ok) { setBusy(false); setMsg(`Pour mettre votre annonce en ligne, il manque : ${missing.join(' et ')}.`); return }
    } catch { setBusy(false); setMsg('Vérification impossible pour le moment. Réessayez.'); return }
    await write(true)
  }

  const big: React.CSSProperties = { width: '100%', minHeight: 56, borderRadius: 14, border: 'none', background: '#0B8374', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, cursor: 'pointer' }
  const ghost: React.CSSProperties = { flex: 1, minHeight: 52, borderRadius: 14, border: 'none', background: '#F0F4F3', color: NAVY, fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <section data-mon-annonce data-etat={etat} aria-label="Mon annonce" style={{ borderRadius: 18, border: `1.5px solid ${etat === 'ligne' ? 'rgba(18,179,156,.5)' : '#E3EBE9'}`, padding: 20 }}>
      <h2 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 20, lineHeight: 1.3, color: NAVY, margin: 0 }}>Mon annonce</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <span aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', background: m.dot, flexShrink: 0, boxShadow: etat === 'ligne' ? '0 0 0 4px rgba(18,179,156,.18)' : 'none' }} />
        <b data-annonce-etat style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 17, color: NAVY, lineHeight: 1.4 }}>{m.titre}</b>
      </div>
      {m.texte && <p style={{ fontSize: 15, lineHeight: 1.5, color: SLATE, margin: '6px 0 0' }}>{m.texte}</p>}

      {pct != null && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 15, lineHeight: 1.5, color: NAVY, fontWeight: 600 }}>Complète à {pct} %</div>
          <div style={{ height: 8, borderRadius: 999, background: '#E3EBE9', overflow: 'hidden', marginTop: 6 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: '#12B39C', borderRadius: 999 }} />
          </div>
        </div>
      )}

      {msg && <p role="status" style={{ fontSize: 15, lineHeight: 1.5, color: '#B3402F', margin: '14px 0 0' }}>{msg}</p>}

      {ask ? (
        <div data-annonce-confirm style={{ marginTop: 20 }}>
          <b style={{ display: 'block', fontFamily: 'Quicksand, sans-serif', fontSize: 17, color: NAVY, lineHeight: 1.4 }}>{ask === 'pause' ? 'Mettre l’annonce en pause ?' : 'Retirer l’annonce de la carte ?'}</b>
          <p style={{ fontSize: 15, lineHeight: 1.5, color: SLATE, margin: '4px 0 14px' }}>Vous n’apparaîtrez plus sur la carte. Vos missions en cours continuent. Vous pourrez la remettre en ligne à tout moment ; rien n’est supprimé.</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" style={ghost} onClick={() => setAsk(null)}>Annuler</button>
            <button type="button" disabled={busy} style={{ ...ghost, border: 'none', background: '#123644', color: '#fff', opacity: busy ? .6 : 1 }} onClick={() => write(false)}>{busy ? 'Un instant…' : ask === 'pause' ? 'Oui, mettre en pause' : 'Oui, retirer'}</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginTop: 20 }}>
            {etat === 'ligne' && <button type="button" style={{ ...big, background: '#F0F4F3', color: NAVY, border: 'none' }} onClick={() => { setMsg(''); setAsk('pause') }}>Mettre en pause</button>}
            {etat === 'pause' && <button type="button" disabled={busy} style={{ ...big, opacity: busy ? .6 : 1 }} onClick={putOnline}>{busy ? 'Un instant…' : 'Remettre en ligne'}</button>}
            {etat === 'brouillon' && <button type="button" style={big} onClick={() => router.push('/pro/annonce')}>Compléter mon annonce</button>}
            {etat === 'suspendue' && <button type="button" style={big} onClick={() => router.push('/support')}>Contacter le support PING</button>}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button type="button" style={ghost} onClick={() => router.push('/pro/annonce')}>Modifier</button>
            <button type="button" style={ghost} onClick={() => router.push('/pro/annonce?apercu')}>Aperçu</button>
          </div>
          {etat === 'ligne' && (
            <button type="button" onClick={() => { setMsg(''); setAsk('retirer') }}
              style={{ display: 'block', width: '100%', minHeight: 48, marginTop: 8, border: 'none', background: 'none', color: SLATE, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
              Retirer de la carte
            </button>
          )}
        </>
      )}
    </section>
  )
}
