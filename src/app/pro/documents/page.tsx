"use client"
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/tracking'
import NavDrawer from '@/components/NavDrawer'
import Modal from '@/components/Modal'

/**
 * Mes pièces — rangées par rubrique, plusieurs pièces par rubrique (demande Romain 30/10) :
 * identité (carte recto/verso ou passeport), assurances (RC Pro, décennale…), statut, diplômes et
 * qualifications, SAP, RIB. Chaque pièce se dépose par photo (appareil du téléphone) ou par fichier.
 *
 * Stockage : un fichier par pièce dans le bucket `documents`, sous `<uid>/<rubrique>--<type>-<horodatage>`
 * (les anciens fichiers `<uid>/<rubrique>-<horodatage>` restent reconnus). La table `documents` garde une
 * ligne par rubrique (contrainte owner_id + kind) : elle porte le statut de traitement de la rubrique et
 * pointe vers la dernière pièce déposée.
 */
type Kind = 'identite' | 'rcpro' | 'kbis' | 'diplome' | 'sap' | 'rib'
type Rubrique = { kind: Kind; title: string; help: string; types: { key: string; label: string }[]; optional?: boolean }

const RUBRIQUES: Rubrique[] = [
  { kind: 'identite', title: 'Identité', help: 'Carte d’identité (recto et verso) ou passeport en cours de validité.',
    types: [{ key: 'cni-recto', label: 'Carte d’identité — recto' }, { key: 'cni-verso', label: 'Carte d’identité — verso' }, { key: 'passeport', label: 'Passeport' }] },
  { kind: 'rcpro', title: 'Assurances', help: 'Attestations en cours de validité.',
    types: [{ key: 'rcpro', label: 'Responsabilité civile professionnelle' }, { key: 'decennale', label: 'Garantie décennale' }, { key: 'autre', label: 'Autre attestation' }] },
  { kind: 'kbis', title: 'Statut de l’entreprise', help: 'Kbis, avis de situation Insee ou attestation SIRET.',
    types: [{ key: 'kbis', label: 'Kbis' }, { key: 'insee', label: 'Avis de situation Insee / SIRET' }] },
  { kind: 'diplome', title: 'Diplômes et qualifications', help: 'Facultatif : un vrai plus pour rassurer les clients.', optional: true,
    types: [{ key: 'diplome', label: 'Diplôme' }, { key: 'qualification', label: 'Qualification / formation' }, { key: 'certificat', label: 'Attestation de formation' }] },
  { kind: 'sap', title: 'Services à la personne (SAP)', help: 'Récépissé de déclaration NOVA : vos clients peuvent ne payer que 50 % grâce au crédit d’impôt.', optional: true,
    types: [{ key: 'sap', label: 'Récépissé SAP' }] },
  { kind: 'rib', title: 'RIB professionnel', help: 'Pour les versements, dès l’ouverture du paiement en ligne.', optional: true,
    types: [{ key: 'rib', label: 'RIB' }] },
]

const ICON: Record<Kind, JSX.Element> = {
  identite: <><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8" cy="12" r="2.2" /><path d="M13 10.5h6M13 13.5h4" /></>,
  rcpro: <><path d="M12 2l8 4v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" /></>,
  kbis: <><path d="M4 4h10l6 6v10H4z" /><path d="M14 4v6h6" /><path d="M8 13h8M8 16.5h5" /></>,
  diplome: <><path d="M12 2l9 5-9 5-9-5 9-5z" /><path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5" /></>,
  sap: <><path d="M3 11l9-7 9 7v9H3z" /><path d="M9 20v-5h6v5" /></>,
  rib: <><path d="M3 10l9-6 9 6" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" /><path d="M3 20h18" /></>,
}

type Piece = { path: string; kind: Kind; type: string | null; at: number }
type DocRow = { kind: Kind; status: 'pending' | 'valid' | 'expired' | 'rejected'; storage_path: string | null }

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  valid: { label: 'Fourni', bg: 'rgba(18,179,156,.14)', fg: '#0C8F7E' },
  pending: { label: 'Reçu — en cours de traitement', bg: 'rgba(242,169,59,.16)', fg: '#9A6712' },
  rejected: { label: 'Refusé — à redéposer', bg: 'rgba(255,122,102,.14)', fg: '#C2432F' },
  expired: { label: 'Expiré — à renouveler', bg: 'rgba(255,122,102,.14)', fg: '#C2432F' },
}

// `identite--passeport-1730…pdf` (nouveau) ou `identite-1730…pdf` (ancien format, sans type).
function parse(name: string): { kind: Kind; type: string | null; at: number } | null {
  const m = name.match(/^(identite|rcpro|kbis|diplome|sap|rib)(?:--([a-z-]+?))?-(\d{10,})\./)
  return m ? { kind: m[1] as Kind, type: m[2] || null, at: Number(m[3]) } : null
}
const isImage = (p: string) => /\.(jpe?g|png|gif|webp|heic)$/i.test(p)

export default function ProDocumentsPage() {
  const router = useRouter()
  const [uid, setUid] = useState<string | null>(null)
  const [pieces, setPieces] = useState<Piece[]>([])
  const [rows, setRows] = useState<Partial<Record<Kind, DocRow>>>({})
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState<{ kind: Kind; type: string } | null>(null)
  const [viewing, setViewing] = useState<{ piece: Piece; url: string } | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login?next=/pro/documents'); return }
    setUid(user.id)
    const [{ data: files }, { data: docs }] = await Promise.all([
      supabase.storage.from('documents').list(user.id, { limit: 200, sortBy: { column: 'name', order: 'desc' } }),
      supabase.from('documents').select('kind, status, storage_path').eq('owner_id', user.id),
    ])
    const list: Piece[] = []
    ;(files ?? []).forEach(f => { const p = parse(f.name); if (p) list.push({ path: `${user.id}/${f.name}`, ...p }) })
    list.sort((a, b) => b.at - a.at)
    setPieces(list)
    const map: Partial<Record<Kind, DocRow>> = {}
    ;(docs ?? []).forEach((d: any) => { map[d.kind as Kind] = d })
    // Ligne en base mais fichier hors du dossier listé (très ancien dépôt) : on l'affiche quand même.
    ;(docs ?? []).forEach((d: any) => {
      if (d.storage_path && !list.some(x => x.path === d.storage_path)) list.push({ path: d.storage_path, kind: d.kind, type: null, at: 0 })
    })
    setReady(true)
    setRows(map)
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function choose(kind: Kind, type: string, how: 'photo' | 'file') {
    setAdding({ kind, type })
    setError('')
    ;(how === 'photo' ? photoRef : fileRef).current?.click()
  }

  async function upload(file: File) {
    if (!adding || !uid) return
    if (file.size > 10 * 1024 * 1024) { setError('Fichier trop lourd : 10 Mo maximum.'); return }
    const { kind, type } = adding
    setBusy(kind)
    const supabase = createClient()
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${uid}/${kind}--${type}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file)
    if (upErr) { setBusy(null); setError("L'envoi a échoué. Vérifiez votre connexion et réessayez."); return }
    // La rubrique repasse « reçue — en cours de traitement » à chaque nouvelle pièce.
    const { error: rowErr } = await supabase.from('documents').upsert(
      { owner_id: uid, kind, storage_path: path, status: 'pending' }, { onConflict: 'owner_id,kind' })
    if (rowErr) setError("La pièce est envoyée mais la rubrique n'a pas pu être mise à jour. Réessayez.")
    trackEvent('document_uploaded', { kind, type })
    await load()
    setBusy(null)
  }

  async function open(piece: Piece) {
    const { data, error } = await createClient().storage.from('documents').createSignedUrl(piece.path, 120)
    if (error || !data) { setError("Impossible d'ouvrir cette pièce pour le moment."); return }
    setViewing({ piece, url: data.signedUrl })
  }

  async function remove(piece: Piece) {
    if (!confirm('Supprimer cette pièce ?')) return
    const supabase = createClient()
    const { error } = await supabase.storage.from('documents').remove([piece.path])
    if (error) { setError('Suppression impossible pour le moment.'); return }
    const left = pieces.filter(p => p.kind === piece.kind && p.path !== piece.path)
    if (rows[piece.kind]?.storage_path === piece.path) {
      if (left.length) await supabase.from('documents').update({ storage_path: left[0].path }).eq('owner_id', uid!).eq('kind', piece.kind)
      else await supabase.from('documents').delete().eq('owner_id', uid!).eq('kind', piece.kind)
    }
    setViewing(null)
    await load()
  }

  const typeLabel = (r: Rubrique, p: Piece) => r.types.find(t => t.key === p.type)?.label || r.title

  if (!ready) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3F6F5', color: '#6E8592', fontFamily: 'Inter, sans-serif' }}>Chargement…</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: 40 }}>
      <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />

      <div style={{ background: '#123644', padding: '16px 20px 22px' }}>
        <NavDrawer />
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'rgba(255,255,255,.45)', margin: '18px 0 4px' }}>Mon entreprise</div>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff' }}>Mes pièces</div>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', marginTop: 6, maxWidth: '46ch', lineHeight: 1.5 }}>
          Visibles uniquement par vous et l&apos;équipe PING, jamais par les clients. Elles rassurent vos clients (« pièce fournie »,
          « assurance renseignée » sur votre profil). Photo ou fichier PDF, JPG, PNG — 10 Mo maximum.
        </p>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && <div style={{ background: '#fff', borderRadius: 12, padding: '10px 14px', color: '#c0503a', fontSize: 12.5, fontWeight: 600 }}>{error}</div>}

        {RUBRIQUES.map(r => {
          const mine = pieces.filter(p => p.kind === r.kind)
          const row = rows[r.kind]
          const st = row ? STATUS[row.status] : null
          return (
            <div key={r.kind} style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F3F6F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">{ICON[r.kind]}</svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14.5, color: '#123644' }}>{r.title}</span>
                    {st
                      ? <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: st.bg, color: st.fg }}>{st.label}</span>
                      : <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF' }}>{r.optional ? 'Facultatif' : 'À fournir'}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#6E8592', marginTop: 3, lineHeight: 1.45 }}>{r.help}</div>
                </div>
              </div>

              {mine.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                  {mine.map(p => (
                    <div key={p.path} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 11, background: '#F7F9F8' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth={2} style={{ flexShrink: 0 }}>
                        {isImage(p.path) ? <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M21 17l-5-5-9 9" /></> : <><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6" /></>}
                      </svg>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#123644' }}>{typeLabel(r, p)}</div>
                        {p.at > 0 && <div style={{ fontSize: 11, color: '#9CA3AF' }}>Déposée le {new Date(p.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>}
                      </div>
                      <button onClick={() => open(p)} style={{ border: 'none', background: 'none', color: '#0C8F7E', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Voir</button>
                      <button onClick={() => remove(p)} aria-label="Supprimer" style={{ border: 'none', background: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 2, display: 'flex' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Ajouter une pièce : choisir son type, puis photo ou fichier. */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 6 }}>Ajouter une pièce</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {r.types.map(t => (
                    <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ flex: '1 1 160px', fontSize: 12.5, color: '#123644', fontWeight: 600 }}>{t.label}</span>
                      <button disabled={busy === r.kind} onClick={() => choose(r.kind, t.key, 'photo')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 999, padding: '7px 12px', background: '#123644', color: '#fff', fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                        Photo
                      </button>
                      <button disabled={busy === r.kind} onClick={() => choose(r.kind, t.key, 'file')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #DCE5E3', borderRadius: 999, padding: '6px 12px', background: '#fff', color: '#123644', fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
                        Fichier
                      </button>
                    </div>
                  ))}
                </div>
                {busy === r.kind && <div style={{ fontSize: 12, color: '#0C8F7E', fontWeight: 600, marginTop: 8 }}>Envoi en cours…</div>}
              </div>
            </div>
          )
        })}
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? (RUBRIQUES.find(r => r.kind === viewing.piece.kind) ? typeLabel(RUBRIQUES.find(r => r.kind === viewing.piece.kind)!, viewing.piece) : 'Pièce') : undefined}>
        {viewing && (
          <div>
            <p style={{ fontSize: 12, color: '#6E8592', margin: '0 0 12px' }}>Visible uniquement par vous et l&apos;équipe PING — jamais par les clients.</p>
            {isImage(viewing.piece.path)
              ? <img src={viewing.url} alt="Pièce" style={{ width: '100%', borderRadius: 12, border: '1px solid #E7EDEB', display: 'block' }} />
              : <iframe src={viewing.url} style={{ width: '100%', height: 420, border: '1px solid #E7EDEB', borderRadius: 12 }} />}
            <a href={viewing.url} download target="_blank" rel="noreferrer"
              style={{ display: 'block', textAlign: 'center', marginTop: 14, padding: 13, borderRadius: 999, background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, textDecoration: 'none' }}>
              Télécharger
            </a>
          </div>
        )}
      </Modal>
    </div>
  )
}
