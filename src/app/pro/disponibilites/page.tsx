"use client"
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'
import { fetchSlots, dayKey, dayLabel, hhmm, durationLabel, type Slot } from '@/lib/slots'

const TIMES = Array.from({ length: 27 }, (_, i) => { const m = 7 * 60 + i * 30; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` })
const DURATIONS = [60, 90, 120, 150, 180, 240]

const field: React.CSSProperties = {
  display: 'block', width: '100%', border: '1.5px solid #E7EDEB', borderRadius: 11,
  padding: '10px 12px', fontSize: 13.5, fontFamily: 'Inter, sans-serif', background: '#fff', color: '#123644',
}

function todayInput() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Disponibilites() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [slots, setSlots] = useState<Slot[] | null>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(todayInput)
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState(120)
  const [weekly, setWeekly] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  async function reload(uid: string) {
    setSlots(await fetchSlots(createClient(), uid, 60))
    setLoading(false)
  }

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)
      reload(user.id)
    })
  }, [router])

  const groups = useMemo(() => {
    const g: Record<string, Slot[]> = {}
    ;(slots ?? []).forEach(s => { (g[dayKey(s.starts_at)] ||= []).push(s) })
    return Object.entries(g)
  }, [slots])

  async function add() {
    if (!userId) return
    const [h, m] = time.split(':').map(Number)
    const base = new Date(`${date}T00:00:00`)
    base.setHours(h, m, 0, 0)
    if (base.getTime() <= Date.now()) { setMsg({ text: 'Choisissez un créneau à venir.', ok: false }); return }
    setBusy(true); setMsg(null)
    // +7 jours sur la date locale (et non +7×24 h) : le créneau garde la même heure affichée
    // même quand la semaine traverse un changement d'heure été/hiver.
    const rows = Array.from({ length: weekly ? 4 : 1 }, (_, i) => {
      const d = new Date(base)
      d.setDate(d.getDate() + i * 7)
      return { provider_id: userId, starts_at: d.toISOString(), duration_minutes: duration }
    })
    const { error } = await createClient().from('provider_slots').upsert(rows, { onConflict: 'provider_id,starts_at', ignoreDuplicates: true })
    setBusy(false)
    if (error) { setMsg({ text: "Impossible d'ajouter ce créneau. Réessayez.", ok: false }); return }
    setMsg({ text: weekly ? 'Créneau ajouté pour les 4 prochaines semaines.' : 'Créneau ajouté.', ok: true })
    reload(userId)
  }

  async function remove(id: string) {
    if (!userId) return
    const { error } = await createClient().from('provider_slots').delete().eq('id', id)
    if (error) setMsg({ text: "Ce créneau n'a pas pu être retiré (déjà réservé ?).", ok: false })
    reload(userId)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#123644', fontFamily: 'Inter, sans-serif', paddingBottom: 40 }}>
      <div style={{ padding: '16px 20px 0' }}><NavDrawer /></div>
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'rgba(255,255,255,.45)', marginBottom: 4 }}>Espace prestataire</div>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff' }}>Mes disponibilités</div>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.55)', marginTop: 6, maxWidth: '42ch' }}>
          Vos clients choisissent l&apos;un de ces créneaux et la réservation est faite, sans aller-retour.
        </p>
      </div>

      <div style={{ background: '#F3F6F5', borderRadius: '20px 20px 0 0', padding: '20px 16px', minHeight: '60vh' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {loading && <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>Chargement…</div>}

          {!loading && slots === null && (
            <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 18, fontSize: 13, color: '#6E8592', lineHeight: 1.55 }}>
              La réservation par créneau arrive très bientôt. En attendant, vos clients vous contactent et vous convenez de l&apos;heure dans la conversation.
            </div>
          )}

          {!loading && slots !== null && (
            <>
              <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 16, marginBottom: 20 }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644', marginBottom: 12 }}>Ajouter un créneau</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                  <label><span style={{ fontSize: 11.5, fontWeight: 600, color: '#6E8592' }}>Jour</span>
                    <input type="date" value={date} min={todayInput()} onChange={e => setDate(e.target.value)} style={{ ...field, marginTop: 5 }} /></label>
                  <label><span style={{ fontSize: 11.5, fontWeight: 600, color: '#6E8592' }}>Heure</span>
                    <select value={time} onChange={e => setTime(e.target.value)} style={{ ...field, marginTop: 5 }}>
                      {TIMES.map(t => <option key={t} value={t}>{t.replace(':', ' h ')}</option>)}
                    </select></label>
                  <label><span style={{ fontSize: 11.5, fontWeight: 600, color: '#6E8592' }}>Durée</span>
                    <select value={duration} onChange={e => setDuration(Number(e.target.value))} style={{ ...field, marginTop: 5 }}>
                      {DURATIONS.map(d => <option key={d} value={d}>{durationLabel(d)}</option>)}
                    </select></label>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: '#123644', cursor: 'pointer' }}>
                  <input type="checkbox" checked={weekly} onChange={e => setWeekly(e.target.checked)} />
                  Répéter chaque semaine pendant 4 semaines
                </label>
                <button onClick={add} disabled={busy} style={{ marginTop: 14, width: '100%', border: 'none', borderRadius: 999, padding: 13, background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: busy ? .6 : 1 }}>
                  {busy ? 'Ajout…' : 'Ajouter'}
                </button>
                {msg && <p style={{ fontSize: 12, color: msg.ok ? '#0C8F7E' : '#c0503a', margin: '10px 0 0', textAlign: 'center' }}>{msg.text}</p>}
              </div>

              {groups.length === 0 && (
                <p style={{ fontSize: 13, color: '#6E8592', textAlign: 'center' }}>Aucun créneau publié pour l&apos;instant : ajoutez-en un ci-dessus.</p>
              )}

              {groups.map(([key, list]) => (
                <div key={key} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 8px 2px' }}>{dayLabel(list[0].starts_at)}</div>
                  {list.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: s.transaction_id ? '#fff' : 'transparent', border: s.transaction_id ? '1px solid #E7EDEB' : '1.5px dashed #B8C9C5', borderRadius: 13, padding: '11px 14px', marginBottom: 8 }}>
                      <b style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 15, color: '#123644', width: 52, flexShrink: 0 }}>{hhmm(s.starts_at)}</b>
                      <span style={{ flex: 1, fontSize: 12.5, color: '#6E8592' }}>{durationLabel(s.duration_minutes)} · {s.transaction_id ? 'réservé' : 'libre'}</span>
                      {s.transaction_id
                        ? <button onClick={() => router.push(`/mission/${s.transaction_id}/chat`)} style={{ border: 'none', background: 'rgba(18,179,156,.12)', color: '#0C8F7E', fontWeight: 700, fontSize: 11.5, padding: '6px 12px', borderRadius: 999, cursor: 'pointer' }}>Voir</button>
                        : <button onClick={() => remove(s.id)} aria-label="Supprimer ce créneau" style={{ border: 'none', background: 'none', color: '#9CA3AF', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Retirer</button>}
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
