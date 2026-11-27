"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sign } from '@/components/Brand'
import NavDrawer from '@/components/NavDrawer'
import { useMode, roleColumn } from '@/lib/mode'
import ModeHint from '@/components/ModeHint'
import { EUR } from '@/lib/invoice-pdf'
import FacturesList from '@/components/FacturesList'
import { annualTotals, annualCsv, annualPdf, downloadBlob, type InvoiceRow, type AnnualTotals } from '@/lib/invoiceShare'

/**
 * Mes documents — côté client comme côté prestataire.
 *
 * Un seul écran pour les trois natures de document, parce qu'un utilisateur ne
 * pense pas « facture de prestation » ou « facture de commission » : il pense
 * « mes papiers ». La RLS fait le tri toute seule — chacun ne voit que les
 * documents dont il est l'émetteur ou le destinataire.
 *
 * Tout se récupère ici, en PDF, et se transmet en deux gestes : au comptable (e-mail), sur WhatsApp,
 * par SMS, ou en relevé annuel pour l'Urssaf et les impôts (Romain 30/10).
 */
type Row = InvoiceRow

export default function DocumentsPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [svc, setSvc] = useState<Record<string, string>>({})
  const [me, setMe] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [txRole, setTxRole] = useState<Record<string, { buyer_id: string; seller_id: string }>>({})
  const [isPro, setIsPro] = useState<boolean | null>(null)
  const [mode] = useMode(isPro)
  const [year, setYear] = useState(new Date().getFullYear())
  const [annualBusy, setAnnualBusy] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      setMe(user.id)
      const { data: pp } = await supabase.from('provider_profiles').select('id').eq('id', user.id).maybeSingle()
      setIsPro(!!pp)
      const { data } = await supabase.from('invoices').select('*').order('issued_at', { ascending: false })
      const list = ((data ?? []) as Row[]).sort((a, b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime())
      setRows(list)
      const txIds = Array.from(new Set(list.map(r => r.transaction_id).filter(Boolean)))
      if (txIds.length) {
        const { data: txs } = await supabase.from('transactions').select('id, buyer_id, seller_id, requests(category)').in('id', txIds)
        const m: Record<string, string> = {}
        const roles: Record<string, { buyer_id: string; seller_id: string }> = {}
        ;(txs ?? []).forEach((t: any) => { if (t.requests?.category) m[t.id] = t.requests.category; roles[t.id] = { buyer_id: t.buyer_id, seller_id: t.seller_id } })
        setSvc(m); setTxRole(roles)
      }
      setLoading(false)
    })
  }, [router])

  const TRAD: Record<string, string> = { menage: 'Ménage', repassage: 'Repassage', nettoyage: 'Nettoyage', vitres: 'Vitres' }
  // Comme Airbnb : en mode particulier, les factures reçues et SES frais de service ; en mode pro,
  // les factures émises et SA commission. Jamais la commission de l'autre partie.
  const MODE_KINDS = { particulier: ['prestation', 'commission_client'], pro: ['prestation', 'commission_pro'] }
  const inMode = (r: Row, m: 'particulier' | 'pro') => txRole[r.transaction_id]?.[roleColumn(m)] === me && MODE_KINDS[m].includes(r.kind)
  const shown = mode ? rows.filter(r => inMode(r, mode)) : []
  const otherCount = mode ? rows.filter(r => inMode(r, mode === 'pro' ? 'particulier' : 'pro') && txRole[r.transaction_id]?.buyer_id !== txRole[r.transaction_id]?.seller_id).length : 0
  // Relevé annuel, pour l'Urssaf et les impôts : uniquement ce qui est passé par PING, déclaratif
  // (mêmes postes qu'avant, calcul partagé avec l'onglet Factures : annualTotals, src/lib/invoiceShare.ts).
  const years = Array.from(new Set([new Date().getFullYear(), ...shown.map(r => new Date(r.issued_at).getFullYear())])).sort((a, b) => b - a)
  const annual: AnnualTotals | null = mode ? annualTotals(shown, mode, year, me) : null
  const services = Object.fromEntries(Object.entries(svc).map(([k, v]) => [k, TRAD[v] || v]))

  async function downloadAnnual(kind: 'pdf' | 'csv') {
    if (!annual) return
    setAnnualBusy(true)
    try {
      if (kind === 'csv') downloadBlob(annualCsv(annual), `PING-releve-${annual.year}.csv`)
      else downloadBlob(await annualPdf(annual), `PING-releve-${annual.year}.pdf`)
    } catch { }
    setAnnualBusy(false)
  }
  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', color: '#123644', paddingBottom: 40 }}>
      <div style={{ padding: '28px 16px 14px', background: '#123644', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} aria-label="Retour"
          style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', width: 44, height: 44, borderRadius: 12, cursor: 'pointer', fontSize: 22 }}>‹</button>
        <NavDrawer />
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 18, color: '#fff' }}>Mes opérations</span>
      </div>

      <div style={{ padding: 16, maxWidth: 760, margin: '0 auto' }}>
        {!loading && isPro && mode && <ModeHint mode={mode} otherCount={otherCount} what={otherCount > 1 ? 'documents' : 'document'} />}
        {!loading && annual && shown.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17 }}>Pour l&apos;Urssaf et les impôts</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {years.map(y => (
                  <button key={y} type="button" onClick={() => setYear(y)} aria-pressed={y === year}
                    style={{ minHeight: 44, minWidth: 64, padding: '0 14px', borderRadius: 999, border: y === year ? 'none' : '1px solid #DCE5E3', background: y === year ? '#123644' : '#fff', color: y === year ? '#fff' : '#123644', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>{y}</button>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              {annual.rows.map((x, i) => (
                <div key={x.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderTop: i ? '1px solid #F0F3F2' : 'none', fontSize: 15 }}>
                  <span style={{ color: i === annual.rows.length - 1 ? '#123644' : '#4E6470', fontWeight: i === annual.rows.length - 1 ? 700 : 500 }}>{x.label}</span>
                  <b style={{ fontFamily: 'Quicksand, sans-serif', whiteSpace: 'nowrap' }}>{EUR(x.cents)}</b>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 15, color: '#4E6470', lineHeight: 1.55, margin: '12px 0 16px' }}>{annual.note}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" disabled={annualBusy} onClick={() => downloadAnnual('pdf')}
                style={{ flex: 1.4, minHeight: 48, padding: 11, borderRadius: 999, border: 'none', background: '#0B8374', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: annualBusy ? .6 : 1 }}>
                Télécharger le relevé annuel
              </button>
              <button type="button" disabled={annualBusy} onClick={() => downloadAnnual('csv')}
                style={{ flex: 1, minHeight: 48, padding: 11, borderRadius: 999, border: '1.5px solid #12B39C', background: '#fff', color: '#0B8374', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                CSV
              </button>
            </div>
          </div>
        )}
        {loading ? (
          <p style={{ color: '#4E6470', fontSize: 13 }}>Chargement…</p>
        ) : shown.length === 0 ? (
          <>
            <div style={{ background: '#fff', borderRadius: 16, padding: 18, textAlign: 'center', marginBottom: 14 }}>
              <Sign size={32} />
              <h2 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, marginTop: 10 }}>
                Aucune opération pour l&apos;instant
              </h2>
              <p style={{ fontSize: 12.5, color: '#4E6470', marginTop: 6, lineHeight: 1.55 }}>
                Factures et reçus sont émis à la fin de chaque mission, dès que le code de fin est scanné.
                Voici à quoi ressemblera cette page{mode === 'pro' ? ' côté prestataire' : ''} :
              </p>
            </div>
            {/* Exemples fictifs, clairement marqués : jamais cliquables, jamais confondus avec de vraies pièces. */}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8A6520', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 10px 2px' }}>Exemple fictif</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, opacity: .75 }}>
              {(mode === 'pro' ? [
                { t: 'Facture · Ménage', n: 'FACT-2026-00012 · émise à Julie R.', a: 9000 },
                { t: 'Relevé de commission PING · Ménage', n: 'PING-V-2026-00012 · reçu de PING', a: 1530 },
                { t: 'Facture · Repassage', n: 'FACT-2026-00011 · émise à Marc D.', a: 6000 },
              ] : [
                { t: 'Facture · Ménage', n: 'FACT-2026-00012 · reçue de Sophie L.', a: 9000 },
                { t: 'Frais de service PING · Ménage', n: 'PING-C-2026-00012 · reçu de PING', a: 720 },
                { t: 'Facture · Repassage', n: 'FACT-2026-00011 · reçue de Karim B.', a: 6000 },
              ]).map(x => (
                <div key={x.n} style={{ background: '#fff', border: '1px dashed #DCE5E3', borderRadius: 14, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5 }}>{x.t}</span>
                    <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#0B8374' }}>{EUR(x.a)}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 3 }}>{x.n} · exemple</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          // Facture du prestataire au premier plan, frais PING repliés en bas ; Voir, Imprimer, Envoyer (24/11/2026).
          me && mode && <FacturesList mode={mode} uid={me} rows={shown} services={services} annual={false} monthTools pageSize={20} />
        )}
      </div>
    </div>
  )
}
