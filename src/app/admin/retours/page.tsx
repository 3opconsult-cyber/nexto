"use client"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Row = {
  id: string
  created_at: string
  role: 'particulier' | 'pro' | 'les_deux'
  simplicite: number
  ergonomie: number
  utilite: number
  recommanderait: boolean
  utiliserait: boolean
  commentaire: string | null
}

const ROLE_LABEL: Record<Row['role'], string> = { particulier: 'Particulier', pro: 'Pro', les_deux: 'Les deux' }

function avg(rows: Row[], key: 'simplicite' | 'ergonomie' | 'utilite') {
  if (!rows.length) return 0
  return rows.reduce((s, r) => s + r[key], 0) / rows.length
}
function pct(rows: Row[], key: 'recommanderait' | 'utiliserait') {
  if (!rows.length) return 0
  return Math.round((rows.filter(r => r[key]).length / rows.length) * 100)
}

/**
 * Reception des retours du carrousel testeurs (/essai/avis). Protegee par
 * le middleware /admin/:path* (is_admin=true ou cle de secours) ET par une
 * policy RLS SELECT dediee (beta_feedback n'avait jusque-la qu'une policy
 * d'insertion : meme un compte admin ne pouvait rien relire via le client,
 * seul un acces SQL direct le pouvait — d'ou l'absence totale d'ecran de
 * reception). La cle de secours ne suffit pas a elle seule : la RLS exige
 * une vraie session is_admin=true (se connecter sur /auth/login).
 */
export default function AdminRetours() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setAuthed(!!user)
      const { data } = await supabase.from('beta_feedback').select('*').order('created_at', { ascending: false })
      setRows((data as Row[]) ?? [])
    })
  }, [])

  if (rows === null) {
    return <div style={{ padding: 40, fontFamily: 'Inter, sans-serif', color: '#6E8592' }}>Chargement…</div>
  }

  if (!authed) {
    return (
      <div style={{ padding: 40, fontFamily: 'Inter, sans-serif', maxWidth: 480 }}>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 20, color: '#123644' }}>Connexion admin requise</h1>
        <p style={{ fontSize: 14, color: '#6E8592', marginTop: 10, lineHeight: 1.6 }}>
          La clé d'accès partagée suffit pour voir le tableau de bord de démonstration, mais pas pour lire les
          retours réels (protégés par une règle de sécurité en base). Connectez-vous avec le compte admin
          (<code>3op.consult@gmail.com</code>) sur <a href="/auth/login">/auth/login</a>, puis revenez sur cette page.
        </p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ padding: '28px 24px', maxWidth: 900, margin: '0 auto' }}>
        <a href="/admin" style={{ fontSize: 13, fontWeight: 700, color: '#6E8592', textDecoration: 'none' }}>← Retour à l'admin</a>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 24, color: '#123644', marginTop: 10 }}>
          Retours testeurs — carrousel de partage
        </h1>
        <p style={{ fontSize: 13.5, color: '#6E8592', marginTop: 4 }}>
          {rows.length} avis reçu{rows.length > 1 ? 's' : ''} via <code>/essai/avis</code>
        </p>

        {rows.length === 0 ? (
          <p style={{ marginTop: 30, fontSize: 14, color: '#6E8592' }}>Aucun avis pour l'instant.</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 24 }}>
              {[
                { l: 'Simplicité', v: avg(rows, 'simplicite').toFixed(1) + ' / 5' },
                { l: 'Ergonomie', v: avg(rows, 'ergonomie').toFixed(1) + ' / 5' },
                { l: 'Utilité', v: avg(rows, 'utilite').toFixed(1) + ' / 5' },
                { l: 'Recommanderaient', v: pct(rows, 'recommanderait') + ' %' },
                { l: 'Utiliseraient', v: pct(rows, 'utiliserait') + ' %' },
              ].map(k => (
                <div key={k.l} style={{ background: '#fff', borderRadius: 14, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: '.03em' }}>{k.l}</div>
                  <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#123644', marginTop: 6 }}>{k.v}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rows.map(r => (
                <div key={r.id} style={{ background: '#fff', borderRadius: 14, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0C8F7E', background: 'rgba(18,179,156,.1)', padding: '3px 10px', borderRadius: 999 }}>
                      {ROLE_LABEL[r.role]}
                    </span>
                    <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>{new Date(r.created_at).toLocaleString('fr-FR')}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12.5, color: '#6E8592' }}>
                    <span>Simplicité <b style={{ color: '#123644' }}>{r.simplicite}/5</b></span>
                    <span>Ergonomie <b style={{ color: '#123644' }}>{r.ergonomie}/5</b></span>
                    <span>Utilité <b style={{ color: '#123644' }}>{r.utilite}/5</b></span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12.5, color: '#6E8592' }}>
                    <span>Recommande : <b style={{ color: r.recommanderait ? '#0C8F7E' : '#c0503a' }}>{r.recommanderait ? 'Oui' : 'Non'}</b></span>
                    <span>Utiliserait : <b style={{ color: r.utiliserait ? '#0C8F7E' : '#c0503a' }}>{r.utiliserait ? 'Oui' : 'Non'}</b></span>
                  </div>
                  {r.commentaire && (
                    <p style={{ fontSize: 13.5, color: '#123644', marginTop: 10, lineHeight: 1.5, fontStyle: 'italic' }}>« {r.commentaire} »</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
