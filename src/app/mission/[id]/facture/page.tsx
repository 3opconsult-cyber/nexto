"use client"
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function FacturePage() {
  const params = useParams()
  const router = useRouter()
  const [invoice, setInvoice] = useState<any>(null)
  const [mission, setMission] = useState<any>(null)
  const [pro, setPro] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: inv } = await supabase.from('invoices').select('*').eq('mission_id', params.id).single()
      const { data: m } = await supabase.from('missions').select('*').eq('id', params.id).single()
      if (inv) setInvoice(inv)
      if (m) {
        setMission(m)
        const { data: p } = await supabase.from('pro_profiles').select('*').eq('id', m.pro_id).single()
        setPro(p)
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{background:'var(--cream)'}}><span className="font-fredoka text-navy">Chargement...</span></div>

  if (!invoice) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{background:'var(--cream)'}}>
      <div className="text-4xl mb-3">🧾</div>
      <div className="font-fredoka text-lg text-navy mb-2">Facture non disponible</div>
      <div className="text-sm text-gray-400 font-bold text-center mb-4">La facture est générée après paiement et purge de tout litige.</div>
      <button onClick={()=>router.back()} className="px-6 py-3 rounded-full font-black text-white" style={{background:'var(--accent)'}}>Retour</button>
    </div>
  )

  const ml = invoice.legal_mentions || {}

  return (
    <div className="min-h-screen" style={{background:'var(--cream)'}}>
      <div className="px-5 pt-5 pb-3 flex items-center gap-3" style={{background:'var(--navy)'}}>
        <button onClick={()=>router.back()} className="text-white font-black">←</button>
        <div className="font-fredoka text-xl text-white">Facture {invoice.ref}</div>
      </div>

      <div className="p-4">
        <div className="bg-white rounded-3xl p-6 shadow-sm">
          {/* En-tête */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="font-fredoka text-2xl" style={{color:'var(--accent)'}}>Nexto</div>
              <div className="text-xs font-bold text-gray-400">Plateforme de mise en relation</div>
            </div>
            <div className="text-right">
              <div className="font-black text-sm text-navy">{invoice.ref}</div>
              <div className="text-xs font-bold text-gray-400">{new Date(invoice.issued_at).toLocaleDateString('fr-FR')}</div>
            </div>
          </div>

          {/* Prestataire */}
          <div className="mb-4 p-3 rounded-xl" style={{background:'var(--cream)'}}>
            <div className="text-xs font-black uppercase tracking-wider text-gray-400 mb-1">Prestataire</div>
            <div className="font-black text-sm text-navy">{pro?.company_name}</div>
            {pro?.siret && <div className="text-xs font-bold text-gray-500">SIRET : {pro.siret}</div>}
            {ml.tva && <div className="text-xs font-bold text-gray-500">{ml.tva}</div>}
          </div>

          {/* Détail */}
          <div className="border-t border-b border-gray-100 py-4 mb-4">
            <div className="flex justify-between text-sm font-bold mb-2">
              <span className="text-gray-600">{mission?.description?.slice(0,40) || 'Prestation'}</span>
              <span className="text-navy">{invoice.total_ht} €</span>
            </div>
            {invoice.vat_rate > 0 && (
              <div className="flex justify-between text-xs font-bold text-gray-400">
                <span>TVA {invoice.vat_rate}%</span>
                <span>{(invoice.total_ttc - invoice.total_ht).toFixed(2)} €</span>
              </div>
            )}
          </div>

          {/* Total */}
          <div className="flex justify-between items-center mb-4">
            <span className="font-fredoka text-lg text-navy">Total TTC</span>
            <span className="font-fredoka text-2xl" style={{color:'var(--accent)'}}>{invoice.total_ttc} €</span>
          </div>

          {/* Commission Nexto */}
          <div className="p-3 rounded-xl mb-4" style={{background:'var(--accent-l)'}}>
            <div className="flex justify-between text-xs font-black" style={{color:'var(--accent-d)'}}>
              <span>Commission Nexto</span><span>{invoice.nexto_commission} €</span>
            </div>
            <div className="flex justify-between text-xs font-black mt-1" style={{color:'var(--accent-d)'}}>
              <span>Net prestataire</span><span>{invoice.net_pro} €</span>
            </div>
          </div>

          {/* Crédit impôt CESU */}
          {invoice.cesu_eligible && (
            <div className="p-3 rounded-xl mb-4" style={{background:'#DCFCE7'}}>
              <div className="text-xs font-black" style={{color:'#15803D'}}>
                ✓ Service à la personne — Crédit d'impôt 50% (code 7DB). Vous pouvez déduire {(invoice.total_ttc*0.5).toFixed(2)} €.
              </div>
            </div>
          )}

          {/* Mentions légales */}
          <div className="text-xs font-bold text-gray-400 space-y-1 border-t border-gray-100 pt-4">
            {ml.penalites && <div>{ml.penalites}</div>}
            {ml.mediation && <div>{ml.mediation}</div>}
            {ml.rc_pro && <div>{ml.rc_pro}</div>}
            <div>Nexto est une plateforme de mise en relation. Elle n'achète ni ne revend aucun service et ne garantit pas l'authenticité des documents fournis par les prestataires.</div>
          </div>
        </div>

        <button className="w-full mt-4 py-4 rounded-full text-white font-fredoka text-lg" style={{background:'var(--accent)'}}>
          📥 Télécharger PDF
        </button>
      </div>
    </div>
  )
}
