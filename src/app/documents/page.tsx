"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sign } from '@/components/Brand'
import NavDrawer from '@/components/NavDrawer'
import { EUR, TITLE } from '@/lib/invoice-pdf'

/**
 * Mes documents — côté client comme côté prestataire.
 *
 * Un seul écran pour les trois natures de document, parce qu'un utilisateur ne
 * pense pas « facture de prestation » ou « facture de commission » : il pense
 * « mes papiers ». La RLS fait le tri toute seule — chacun ne voit que les
 * documents dont il est l'émetteur ou le destinataire.
 *
 * Le but est d'éviter l'envoi par e-mail : tout se récupère ici, en PDF.
 */
type Row = {
  id: string; number: string; template: keyof typeof TITLE; kind: string
  net_cents: number; issued_at: string; transaction_id: string
  issuer_id: string; client_id: string
  issuer_snapshot: Record<string, any>; client_snapshot: Record<string, any>
}

export default function DocumentsPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [svc, setSvc] = useState<Record<string, string>>({})
  const [me, setMe] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      setMe(user.id)
      const { data } = await supabase.from('invoices').select('*').order('issued_at', { ascending: false })
      const list = (data ?? []) as Row[]
      setRows(list)
      const txIds = Array.from(new Set(list.map(r => r.transaction_id).filter(Boolean)))
      if (txIds.length) {
        const { data: txs } = await supabase.from('transactions').select('id, requests(category)').in('id', txIds)
        const m: Record<string, string> = {}
        ;(txs ?? []).forEach((t: any) => { if (t.requests?.category) m[t.id] = t.requests.category })
        setSvc(m)
      }
      setLoading(false)
    })
  }, [router])

  const TRAD: Record<string, string> = { menage: 'Ménage', repassage: 'Repassage', nettoyage: 'Nettoyage', vitres: 'Vitres' }
  const groups = rows.reduce((acc, r) => {
    const key = new Date(r.issued_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    ;(acc[key] ||= []).push(r); return acc
  }, {} as Record<string, Row[]>)

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', color: '#123644', paddingBottom: 40 }}>
      <div style={{ padding: '28px 16px 14px', background: '#123644', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} aria-label="Retour"
          style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer' }}>‹</button>
        <NavDrawer />
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, color: '#fff' }}>Mes opérations</span>
      </div>

      <div style={{ padding: 16, maxWidth: 760, margin: '0 auto' }}>
        {loading ? (
          <p style={{ color: '#6E8592', fontSize: 13 }}>Chargement…</p>
        ) : rows.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <Sign size={36} />
            <h2 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15.5, marginTop: 12 }}>
              Aucune opération pour l&apos;instant
            </h2>
            <p style={{ fontSize: 12.5, color: '#6E8592', marginTop: 6, lineHeight: 1.55 }}>
              Reçus et factures sont émis à la fin de chaque mission, dès que le code de départ est scanné.
            </p>
          </div>
        ) : (
          Object.entries(groups).map(([mois, list]) => (
            <div key={mois} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 10px 2px' }}>{mois}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {list.map(r => {
                  const emis = r.issuer_id === me
                  const autre = emis ? (r.client_snapshot?.nom) : (r.issuer_snapshot?.enseigne || r.issuer_snapshot?.nom || 'PING')
                  const service = svc[r.transaction_id] ? (TRAD[svc[r.transaction_id]] || svc[r.transaction_id]) : null
                  return (
                    <button key={r.id} onClick={() => router.push(`/mission/${r.transaction_id}/facture`)}
                      style={{ background: '#fff', border: 'none', borderRadius: 14, padding: 14, cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif', color: '#123644', boxShadow: '0 1px 2px rgba(18,54,68,.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5 }}>
                          {TITLE[r.template] ?? 'Document'}{service ? <span style={{ color: 'var(--teal, #0C8F7E)' }}> · {service}</span> : null}
                        </span>
                        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#0C8F7E' }}>{EUR(r.net_cents)}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 3 }}>
                        {r.number} · {emis ? 'émis à' : 'reçu de'} {autre || '—'} · {new Date(r.issued_at).toLocaleDateString('fr-FR')}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
