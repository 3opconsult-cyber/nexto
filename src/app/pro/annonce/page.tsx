"use client"
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'
import ProListingPreview from '@/components/ProListingPreview'
import { TRADES } from '@/lib/trades'
import { pricingShort } from '@/lib/servicePricing'
import { dayLabel, hhmm } from '@/lib/slots'
import {
  BIO_MIN, GALLERY_MAX, HEADLINE_MAX, HIGHLIGHTS, LISTING_BUCKET, RADIUS_CHOICES,
  canPublish, listingChecks, listingPhotoUrl, listingScore, loadListingFacts, type ListingFacts,
} from '@/lib/listing'

const NAVY = '#123644', TEAL = '#12B39C', TEAL_D = '#0C8F7E', SLATE = '#4E6470', LINE = '#E7EDEB'
const card: React.CSSProperties = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: 16 }
const h3: React.CSSProperties = { fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: NAVY, margin: '0 0 4px' }
const sub: React.CSSProperties = { fontSize: 12.5, color: SLATE, margin: '0 0 10px', lineHeight: 1.45 }
const input: React.CSSProperties = {
  display: 'block', width: '100%', boxSizing: 'border-box', border: `1.5px solid ${LINE}`, borderRadius: 11,
  padding: '10px 12px', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', color: NAVY, background: '#fff',
}
const link: React.CSSProperties = { background: 'none', border: 'none', padding: 0, color: TEAL_D, fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }

/**
 * « Mon annonce » (Romain 31/10) : comme un hôte Airbnb, le prestataire voit son annonce telle que
 * les clients la voient, la complète (photos, accroche, présentation, points forts, zone), suit sa
 * complétude et la met en ligne ou en pause (`provider_profiles.is_active`). Les tarifs et les
 * créneaux restent gérés dans leurs écrans dédiés (/pro/tarifs, /pro/disponibilites), résumés ici.
 */
export default function MonAnnoncePage() {
  const router = useRouter()
  const [uid, setUid] = useState<string | null>(null)
  const [pro, setPro] = useState<any>(null)
  const [name, setName] = useState('')
  const [services, setServices] = useState<any[]>([])
  const [slots, setSlots] = useState<any[]>([])
  const [facts, setFacts] = useState<ListingFacts | null>(null)
  const [hasIdentity, setHasIdentity] = useState(false)
  const [hasRcpro, setHasRcpro] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')

  // Champs éditables (enregistrés ensemble).
  const [headline, setHeadline] = useState('')
  const [bio, setBio] = useState('')
  const [highlights, setHighlights] = useState<string[]>([])
  const [radius, setRadius] = useState(15)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const [uploading, setUploading] = useState<'cover' | 'logo' | 'gallery' | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [view, setView] = useState<'edit' | 'preview'>('edit')

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login?next=/pro/annonce'); return }
      setUid(user.id)
      const [{ data: pp, error }, { data: prof }] = await Promise.all([
        supabase.from('provider_profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('profiles').select('full_name, first_name').eq('id', user.id).maybeSingle(),
      ])
      if (error) { setLoadErr('Votre annonce n’a pas pu être chargée. Rechargez la page.'); setLoading(false); return }
      if (!pp) { router.push('/pro/onboarding'); return }
      setPro(pp)
      setName(prof?.full_name?.trim() || prof?.first_name || pp.company_name || TRADES[pp.trade] || 'Votre nom')
      setHeadline(pp.headline || ''); setBio(pp.bio || '')
      setHighlights(pp.highlights || []); setRadius(pp.service_radius_km || 15)
      const r = await loadListingFacts(supabase, user.id, pp)
      setServices(r.services); setSlots(r.slots); setFacts(r.facts)
      setHasIdentity(r.hasIdentity); setHasRcpro(r.hasRcpro)
      setLoading(false)
    })()
  }, [router])

  // L'aperçu et la jauge suivent la saisie en cours, avant même l'enregistrement.
  const draftPro = useMemo(() => pro && ({ ...pro, headline: headline.trim() || null, bio: bio.trim() || null, highlights, service_radius_km: radius }), [pro, headline, bio, highlights, radius])
  const liveFacts = useMemo(() => facts && draftPro && ({ ...facts, photo: !!(draftPro.photo_url || draftPro.logo_url), bioLength: (draftPro.bio || '').length }), [facts, draftPro])
  const checks = liveFacts ? listingChecks(liveFacts) : []
  const score = listingScore(checks)
  const suspended = !!pro?.payments_suspended_at
  const online = !!pro?.is_active && !suspended

  function edit<T>(set: (v: T) => void) { return (v: T) => { set(v); setDirty(true); setMsg(null) } }

  async function save(): Promise<boolean> {
    if (!uid) return false
    setSaving(true); setMsg(null)
    const supabase = createClient()
    const patch = { headline: headline.trim() || null, bio: bio.trim() || null, highlights, service_radius_km: radius }
    const { error } = await supabase.from('provider_profiles').update(patch).eq('id', uid)
    setSaving(false)
    if (error) { setMsg({ tone: 'err', text: 'L’enregistrement a échoué. Réessayez dans un instant.' }); return false }
    setPro((p: any) => ({ ...p, ...patch })); setDirty(false)
    setMsg({ tone: 'ok', text: 'Annonce enregistrée.' })
    return true
  }

  async function setOnline(next: boolean) {
    if (!uid || !liveFacts) return
    setMsg(null)
    if (next && suspended) {
      setMsg({ tone: 'err', text: 'Votre compte est suspendu (commission impayée ou mandat de prélèvement révoqué) : l’annonce ne peut pas être remise en ligne. Contactez le support PING pour régulariser.' })
      return
    }
    if (next) {
      const { ok, missing } = canPublish(liveFacts)
      if (!ok) { setMsg({ tone: 'err', text: `Pour mettre votre annonce en ligne, il manque : ${missing.join(' et ')}.` }); return }
    }
    setPublishing(true)
    if (dirty && !(await save())) { setPublishing(false); return }
    const supabase = createClient()
    const { error } = await supabase.from('provider_profiles').update({ is_active: next }).eq('id', uid)
    setPublishing(false)
    if (error) {
      setMsg({ tone: 'err', text: /suspendu/i.test(error.message) ? 'Compte suspendu : contactez le support PING pour le réactiver.' : 'Le changement n’a pas pu être enregistré. Réessayez dans un instant.' })
      return
    }
    setPro((p: any) => ({ ...p, is_active: next }))
    setMsg({ tone: 'ok', text: next ? 'Votre annonce est en ligne : les clients proches vous voient sur la carte.' : 'Votre annonce est en pause : vous n’apparaissez plus sur la carte.' })
  }

  const ext = (f: File) => (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const tooBig = (f: File) => f.size > 10 * 1024 * 1024

  async function uploadMain(kind: 'cover' | 'logo', file: File) {
    if (!uid) return
    if (tooBig(file)) { setMsg({ tone: 'err', text: 'Photo trop lourde (10 Mo au maximum).' }); return }
    setUploading(kind); setMsg(null)
    const supabase = createClient()
    const path = `${uid}/${kind}-${Date.now()}.${ext(file)}`
    const { error: upErr } = await supabase.storage.from(LISTING_BUCKET).upload(path, file, { cacheControl: '3600' })
    if (upErr) { setUploading(null); setMsg({ tone: 'err', text: 'La photo n’a pas pu être envoyée. Vérifiez le format (JPG, PNG, WebP).' }); return }
    const col = kind === 'cover' ? 'photo_url' : 'logo_url'
    const url = listingPhotoUrl(path)
    const { error } = await supabase.from('provider_profiles').update({ [col]: url }).eq('id', uid)
    setUploading(null)
    if (error) { setMsg({ tone: 'err', text: 'La photo a été envoyée mais pas enregistrée sur l’annonce. Réessayez.' }); return }
    setPro((p: any) => ({ ...p, [col]: url }))
  }

  async function addGallery(files: FileList) {
    if (!uid || !pro) return
    const current: string[] = pro.gallery_paths || []
    const room = GALLERY_MAX - current.length
    const list = Array.from(files).slice(0, room)
    if (!list.length) return
    if (list.some(tooBig)) { setMsg({ tone: 'err', text: 'Une photo dépasse 10 Mo : elle n’a pas été ajoutée.' }); return }
    setUploading('gallery'); setMsg(null)
    const supabase = createClient()
    const added: string[] = []
    for (const f of list) {
      const path = `${uid}/gallery-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext(f)}`
      const { error } = await supabase.storage.from(LISTING_BUCKET).upload(path, f, { cacheControl: '3600' })
      if (!error) added.push(path)
    }
    const next = [...current, ...added].slice(0, GALLERY_MAX)
    const { error } = await supabase.from('provider_profiles').update({ gallery_paths: next }).eq('id', uid)
    setUploading(null)
    if (error || added.length < list.length) setMsg({ tone: 'err', text: 'Certaines photos n’ont pas pu être ajoutées. Réessayez.' })
    if (!error) setPro((p: any) => ({ ...p, gallery_paths: next }))
  }

  async function removeGallery(path: string) {
    if (!uid || !pro) return
    const supabase = createClient()
    const next = (pro.gallery_paths || []).filter((p: string) => p !== path)
    const { error } = await supabase.from('provider_profiles').update({ gallery_paths: next }).eq('id', uid)
    if (error) { setMsg({ tone: 'err', text: 'La photo n’a pas pu être retirée. Réessayez.' }); return }
    setPro((p: any) => ({ ...p, gallery_paths: next }))
    if (!/^https?:/.test(path)) supabase.storage.from(LISTING_BUCKET).remove([path]).then(() => {})
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: NAVY }}>
      <div style={{ color: '#fff', fontFamily: 'Quicksand, sans-serif', fontSize: 16 }}>{loadErr || 'Chargement…'}</div>
    </div>
  )

  const primaryPrice = pricingShort(pro)
  const priced = [
    { key: 'primary', name: TRADES[pro.trade] || pro.trade, price: primaryPrice },
    ...services.map(s => ({ key: s.id, name: TRADES[s.name] || s.name, price: pricingShort(s) })),
  ]
  const gallery: string[] = pro.gallery_paths || []

  const statusBox = (
    <div style={{ ...card, borderColor: online ? 'rgba(18,179,156,.45)' : LINE }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, background: suspended ? '#C0503A' : online ? TEAL : '#A5B3B9', boxShadow: online ? '0 0 0 4px rgba(18,179,156,.18)' : 'none' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, color: NAVY }}>
            {suspended ? 'Suspendue' : online ? 'En ligne · visible sur la carte' : 'En pause'}
          </div>
          <div style={{ fontSize: 12.5, color: SLATE, marginTop: 2 }}>
            {suspended ? 'Compte suspendu par PING : contactez le support pour régulariser.'
              : online ? 'Les clients proches voient votre annonce et peuvent vous réserver.'
              : 'Votre annonce n’apparaît pas sur la carte. Vos missions en cours continuent.'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {online ? (
          <button className="ping-btn ghost" style={{ flex: 1, minWidth: 160 }} disabled={publishing} onClick={() => setOnline(false)}>
            {publishing ? 'Un instant…' : 'Mettre en pause'}
          </button>
        ) : (
          <button className="ping-btn" style={{ flex: 1, minWidth: 200, opacity: suspended ? .55 : 1 }} disabled={publishing} onClick={() => setOnline(true)}>
            {publishing ? 'Mise en ligne…' : 'Mettre mon annonce en ligne'}
          </button>
        )}
        <button className="ping-btn ghost" style={{ width: 'auto', padding: '12px 16px' }} onClick={() => router.push(`/pro/${pro.id}`)}>Voir comme un client</button>
      </div>
    </div>
  )

  const gauge = (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <div style={h3}>Annonce complète à {score} %</div>
        <span style={{ fontSize: 12, fontWeight: 700, color: score === 100 ? TEAL_D : '#8a6520' }}>{checks.filter(c => c.done).length} / {checks.length}</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: '#EEF3F2', overflow: 'hidden', margin: '8px 0 12px' }}>
        <div style={{ width: `${score}%`, height: '100%', background: TEAL, borderRadius: 999, transition: 'width .3s' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {checks.map(c => (
          <div key={c.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1, display: 'grid', placeItems: 'center', background: c.done ? TEAL : '#fff', border: c.done ? 'none' : '1.5px solid #C9D5D2' }}>
              {c.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><path d="M20 6L9 17l-5-5" /></svg>}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{c.label}</div>
              {!c.done && <div style={{ fontSize: 12, color: SLATE, marginTop: 1 }}>{c.hint}</div>}
            </div>
            {!c.done && c.href && <button style={{ ...link, fontSize: 12.5, flexShrink: 0 }} onClick={() => router.push(c.href!)}>Compléter</button>}
          </div>
        ))}
      </div>
      <p style={{ ...sub, margin: '12px 0 0' }}>Minimum pour être en ligne : un tarif et votre position. Le reste rend l’annonce plus rassurante.</p>
    </div>
  )

  const editor = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={card}>
        <div style={h3}>Photos principales</div>
        <p style={sub}>La photo de couverture et votre logo ou portrait, en tête de l’annonce.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          {(['cover', 'logo'] as const).map(kind => {
            const url = kind === 'cover' ? pro.photo_url : pro.logo_url
            return (
              <label key={kind} style={{ flex: kind === 'cover' ? 2 : 1, height: 96, borderRadius: 12, cursor: 'pointer', position: 'relative', overflow: 'hidden',
                background: url ? `url(${url}) center/cover` : '#F3F6F5', border: url ? 'none' : '1.5px dashed #C9D5D2', display: 'grid', placeItems: 'center' }}>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadMain(kind, f); e.target.value = '' }} />
                <span style={{ background: url ? 'rgba(18,54,68,.6)' : 'transparent', color: url ? '#fff' : SLATE, fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 999 }}>
                  {uploading === kind ? 'Envoi…' : url ? 'Changer' : kind === 'cover' ? '+ Couverture' : '+ Logo ou portrait'}
                </span>
              </label>
            )
          })}
        </div>
      </div>

      <div style={card}>
        <div style={h3}>Accroche</div>
        <p style={sub}>Une phrase courte, affichée en premier. Par exemple : « Ménage soigné et repassage, 10 ans d’expérience à Nice ».</p>
        <input style={input} value={headline} maxLength={HEADLINE_MAX} placeholder="Votre accroche" onChange={e => edit(setHeadline)(e.target.value)} />
        <div style={{ fontSize: 11.5, color: SLATE, textAlign: 'right', marginTop: 4 }}>{headline.length} / {HEADLINE_MAX}</div>
      </div>

      <div style={card}>
        <div style={h3}>Présentation</div>
        <p style={sub}>Qui vous êtes, votre expérience, votre façon de travailler. Au moins {BIO_MIN} caractères.</p>
        <textarea style={{ ...input, minHeight: 120, resize: 'vertical', lineHeight: 1.5 }} value={bio} maxLength={1200}
          placeholder="Bonjour, je m’appelle…" onChange={e => edit(setBio)(e.target.value)} />
        <div style={{ fontSize: 11.5, color: bio.trim().length >= BIO_MIN ? TEAL_D : SLATE, textAlign: 'right', marginTop: 4, fontWeight: 600 }}>
          {bio.trim().length} caractères{bio.trim().length < BIO_MIN ? ` · encore ${BIO_MIN - bio.trim().length}` : ''}
        </div>
      </div>

      <div style={card}>
        <div style={h3}>Points forts</div>
        <p style={sub}>Ce que vous proposez en plus. Ce sont des informations que vous déclarez.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {HIGHLIGHTS.map(h => {
            const on = highlights.includes(h.key)
            return (
              <button key={h.key} type="button" aria-pressed={on}
                onClick={() => edit(setHighlights)(on ? highlights.filter(k => k !== h.key) : [...highlights, h.key])}
                style={{ padding: '7px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  border: on ? 'none' : `1px solid #DCE5E3`, background: on ? TEAL : '#fff', color: on ? '#fff' : NAVY }}>
                {h.label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={card}>
        <div style={h3}>Zone d’intervention</div>
        <p style={sub}>Jusqu’où vous vous déplacez depuis votre adresse.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {RADIUS_CHOICES.map(km => (
            <button key={km} type="button" aria-pressed={radius === km} onClick={() => edit(setRadius)(km)}
              style={{ padding: '8px 14px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                border: radius === km ? 'none' : `1px solid #DCE5E3`, background: radius === km ? TEAL : '#fff', color: radius === km ? '#fff' : NAVY }}>
              {km} km
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 12.5, color: liveFacts?.placed ? TEAL_D : '#8A6520', fontWeight: 700 }}>
          {liveFacts?.placed ? 'Position enregistrée sur la carte' : 'Position manquante : les clients ne peuvent pas vous trouver'}
          <button style={{ ...link, fontSize: 12.5, marginLeft: 'auto' }} onClick={() => router.push('/pro/onboarding')}>{liveFacts?.placed ? 'Modifier l’adresse' : 'Ajouter mon adresse'}</button>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={h3}>Prestations et prix</div>
          <button style={link} onClick={() => router.push('/pro/tarifs')}>Gérer mes tarifs</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          {priced.map(p => (
            <div key={p.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5, padding: '8px 0', borderBottom: `1px solid ${LINE}` }}>
              <span style={{ color: NAVY, fontWeight: 600 }}>{p.name}</span>
              <span style={{ color: p.price ? TEAL_D : '#8A6520', fontWeight: 700 }}>{p.price || 'prix à fixer'}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={h3}>Disponibilités</div>
          <button style={link} onClick={() => router.push('/pro/disponibilites')}>Gérer mes créneaux</button>
        </div>
        {slots.length === 0 ? (
          <p style={{ ...sub, margin: '6px 0 0' }}>Aucun créneau libre publié pour les 60 prochains jours. Les clients peuvent toujours vous contacter, mais ne peuvent pas réserver directement.</p>
        ) : (
          <>
            <p style={{ ...sub, margin: '6px 0 8px' }}>{slots.length} créneau{slots.length > 1 ? 'x' : ''} libre{slots.length > 1 ? 's' : ''} à venir. Les prochains :</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {slots.slice(0, 4).map(s => (
                <span key={s.id} style={{ padding: '6px 10px', borderRadius: 10, background: 'rgba(18,179,156,.1)', color: TEAL_D, fontSize: 12.5, fontWeight: 700, textTransform: 'capitalize' }}>
                  {dayLabel(s.starts_at, { weekday: 'short', day: 'numeric', month: 'short' })} · {hhmm(s.starts_at)}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={h3}>Galerie</div>
          <span style={{ fontSize: 12, color: SLATE, fontWeight: 700 }}>{gallery.length} / {GALLERY_MAX}</span>
        </div>
        <p style={sub}>Jusqu’à {GALLERY_MAX} photos de vos réalisations (avant / après, matériel). Jamais de photo d’un client ni d’une adresse reconnaissable.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {gallery.map(p => (
            <div key={p} style={{ position: 'relative', paddingTop: '75%', borderRadius: 10, background: `#F3F6F5 url(${listingPhotoUrl(p)}) center/cover` }}>
              <button type="button" aria-label="Retirer la photo" onClick={() => removeGallery(p)}
                style={{ position: 'absolute', top: 5, right: 5, width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'rgba(18,54,68,.7)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
          ))}
          {gallery.length < GALLERY_MAX && (
            <label style={{ position: 'relative', paddingTop: '75%', borderRadius: 10, border: '1.5px dashed #C9D5D2', background: '#F8FAF9', cursor: 'pointer' }}>
              <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { if (e.target.files?.length) addGallery(e.target.files); e.target.value = '' }} />
              <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 700, color: SLATE }}>
                {uploading === 'gallery' ? 'Envoi…' : '+ Ajouter'}
              </span>
            </label>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: NAVY, fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        .ann-grid{display:block}
        .ann-seg{display:flex}
        @media (min-width:1000px){
          .ann-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,400px);gap:20px;align-items:start}
          .ann-grid>.ann-col{display:flex !important}
          .ann-preview{position:sticky;top:16px}
          .ann-seg{display:none}
        }
      `}</style>
      <div style={{ padding: '16px 20px 0' }}><NavDrawer /></div>
      <div style={{ padding: '20px 20px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div onClick={() => router.push('/pro/dashboard')} role="button" aria-label="Retour à Mon entreprise"
          style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,.1)', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M15 6l-6 6 6 6" /></svg>
        </div>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 20, color: '#fff' }}>Mon annonce</div>
      </div>

      <div style={{ background: '#F6F9F8', borderRadius: '18px 18px 0 0', padding: '18px 16px', minHeight: '75vh', paddingBottom: dirty ? 110 : 40 }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {statusBox}
          {msg && (
            <div role="status" style={{ padding: '11px 14px', borderRadius: 12, fontSize: 13, fontWeight: 600, lineHeight: 1.45,
              background: msg.tone === 'ok' ? 'rgba(18,179,156,.1)' : '#FEF2F2', color: msg.tone === 'ok' ? TEAL_D : '#C0503A' }}>{msg.text}</div>
          )}
          {gauge}

          <div className="ann-seg" style={{ background: '#E9EFED', borderRadius: 12, padding: 4, gap: 4 }}>
            {(['edit', 'preview'] as const).map(v => (
              <button key={v} type="button" onClick={() => setView(v)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5,
                  background: view === v ? '#fff' : 'transparent', color: view === v ? NAVY : SLATE, boxShadow: view === v ? '0 1px 3px rgba(18,54,68,.12)' : 'none' }}>
                {v === 'edit' ? 'Modifier' : 'Aperçu client'}
              </button>
            ))}
          </div>

          <div className="ann-grid">
            <div className="ann-col" style={{ display: view === 'edit' ? 'flex' : 'none', flexDirection: 'column' }}>{editor}</div>
            <div className="ann-col ann-preview" style={{ display: view === 'preview' ? 'flex' : 'none', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: SLATE, textTransform: 'uppercase', letterSpacing: '.04em' }}>Ce que voient les clients</div>
              <ProListingPreview pro={draftPro} name={name} services={services} hasIdentity={hasIdentity} hasRcpro={hasRcpro} online={online} />
            </div>
          </div>
        </div>
      </div>

      {dirty && (
        <div className="ann-save" style={{ position: 'fixed', left: 0, right: 0, bottom: 'var(--tabbar-h, 0px)', zIndex: 30, background: '#fff', borderTop: `1px solid ${LINE}`, padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))' }}>
          <style>{`@media (min-width:1000px){.ann-save{left:236px !important}}`}</style>
          <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ flex: 1, fontSize: 12.5, color: SLATE, fontWeight: 600 }}>Modifications non enregistrées</span>
            <button className="ping-btn" style={{ width: 'auto', padding: '12px 22px' }} disabled={saving} onClick={save}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
