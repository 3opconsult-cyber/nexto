"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LegalForm, VatRegime, ServiceType, DocumentType,
  LEGAL_FORM_LABELS, VAT_REGIME_LABELS, SERVICE_LABELS,
  DOCUMENT_LABELS, REQUIRED_DOCS, DEFAULT_VAT
} from '@/types'

const STEPS = ['Statut', 'Société', 'TVA', 'Services', 'Documents', 'Profil', 'IBAN']

export default function ProOnboarding() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    legal_form: '' as LegalForm,
    company_name: '',
    siret: '',
    naf_code: '',
    rcs_number: '',
    vat_regime: 'franchise_base' as VatRegime,
    vat_number: '',
    social_capital: '',
    hq_address: '',
    services: [] as ServiceType[],
    bio: '',
    hourly_rate: '',
    travel_fee: '0',
    radius_km: '10',
    iban: '',
  })

  function upd(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function toggleService(s: ServiceType) {
    setForm(f => ({
      ...f,
      services: f.services.includes(s)
        ? f.services.filter(x => x !== s)
        : [...f.services, s]
    }))
  }

  function selectLegalForm(lf: LegalForm) {
    setForm(f => ({ ...f, legal_form: lf, vat_regime: DEFAULT_VAT[lf] }))
  }

  async function submit() {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Non connecté'); setLoading(false); return }

    const { error: err } = await supabase.from('pro_profiles').insert({
      user_id: user.id,
      legal_form: form.legal_form,
      company_name: form.company_name,
      siret: form.siret || null,
      naf_code: form.naf_code || null,
      rcs_number: form.rcs_number || null,
      vat_regime: form.vat_regime,
      vat_number: form.vat_number || null,
      social_capital: form.social_capital ? parseFloat(form.social_capital) : null,
      hq_address: form.hq_address || null,
      bio: form.bio || null,
      hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null,
      travel_fee: parseFloat(form.travel_fee || '0'),
      radius_km: parseInt(form.radius_km || '10'),
      iban: form.iban || null,
      status: 'pending',
    })

    if (err) { setError(err.message); setLoading(false); return }

    // Mettre à jour le rôle
    await supabase.from('profiles').update({ role: 'pro' }).eq('id', user.id)
    router.push('/pro/onboarding/documents')
  }

  const requiredDocs = form.legal_form ? REQUIRED_DOCS[form.legal_form] : []
  const isLastStep = step === STEPS.length - 1

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--navy)' }}>
      {/* Header */}
      <div className="px-5 pt-8 pb-4">
        <div className="font-fredoka text-2xl text-white mb-1">Nexto Pro</div>
        <div className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Créez votre profil professionnel
        </div>
        {/* Progress */}
        <div className="flex gap-1.5 mt-4">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 h-1 rounded-full transition-all"
              style={{ background: i <= step ? 'var(--accent)' : 'rgba(255,255,255,0.15)' }} />
          ))}
        </div>
        <div className="text-xs font-black mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Étape {step + 1}/{STEPS.length} — {STEPS[step]}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white rounded-t-3xl px-5 py-6 overflow-y-auto">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-600 font-bold">
            {error}
          </div>
        )}

        {/* STEP 0 — Statut juridique */}
        {step === 0 && (
          <div>
            <h2 className="font-fredoka text-2xl text-navy mb-1">Statut juridique</h2>
            <p className="text-sm text-gray-400 font-bold mb-5">
              Votre statut détermine vos obligations fiscales et les documents requis.
            </p>
            <div className="space-y-2">
              {(Object.entries(LEGAL_FORM_LABELS) as [LegalForm, string][]).map(([key, label]) => (
                <button key={key} onClick={() => selectLegalForm(key)}
                  className="w-full text-left p-4 rounded-2xl border-2 transition-all"
                  style={{
                    borderColor: form.legal_form === key ? 'var(--accent)' : '#F0EDE8',
                    background: form.legal_form === key ? 'var(--accent-l)' : 'white',
                  }}
                >
                  <div className="font-black text-sm" style={{ color: form.legal_form === key ? 'var(--accent-d)' : 'var(--navy)' }}>
                    {label}
                  </div>
                  {key === 'auto_entrepreneur' && (
                    <div className="text-xs text-gray-400 font-bold mt-0.5">Franchise TVA · Seuil 77 700€/an</div>
                  )}
                  {key === 'cesu' && (
                    <div className="text-xs text-gray-400 font-bold mt-0.5">Services à domicile · Crédit impôt 50%</div>
                  )}
                  {(key === 'sarl' || key === 'eurl') && (
                    <div className="text-xs text-gray-400 font-bold mt-0.5">Société · TVA réelle · Kbis requis</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 1 — Infos société */}
        {step === 1 && (
          <div>
            <h2 className="font-fredoka text-2xl text-navy mb-1">Informations société</h2>
            <p className="text-sm text-gray-400 font-bold mb-5">Apparaîtront sur vos factures.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">
                  Raison sociale / Nom commercial *
                </label>
                <input type="text" value={form.company_name} onChange={e => upd('company_name', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent"
                  placeholder="Ex : Jean Martin Plomberie" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">
                  SIRET
                </label>
                <input type="text" value={form.siret} onChange={e => upd('siret', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent"
                  placeholder="123 456 789 00012" maxLength={17} />
              </div>
              {['sarl','eurl','sas','sasu','sa'].includes(form.legal_form) && (
                <>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">
                      N° RCS / Immatriculation
                    </label>
                    <input type="text" value={form.rcs_number} onChange={e => upd('rcs_number', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent"
                      placeholder="RCS Nice 847 293 018" />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">
                      Capital social (€)
                    </label>
                    <input type="number" value={form.social_capital} onChange={e => upd('social_capital', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent"
                      placeholder="Ex : 10000" />
                  </div>
                </>
              )}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">
                  Code NAF / APE
                </label>
                <input type="text" value={form.naf_code} onChange={e => upd('naf_code', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent"
                  placeholder="Ex : 4322A" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">
                  Adresse du siège social
                </label>
                <input type="text" value={form.hq_address} onChange={e => upd('hq_address', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent"
                  placeholder="42 rue de la République, 06130 Grasse" />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 — TVA */}
        {step === 2 && (
          <div>
            <h2 className="font-fredoka text-2xl text-navy mb-1">Régime TVA</h2>
            <p className="text-sm text-gray-400 font-bold mb-5">
              Détermine si vos factures incluent la TVA.
            </p>
            <div className="space-y-2 mb-6">
              {(Object.entries(VAT_REGIME_LABELS) as [VatRegime, string][]).map(([key, label]) => (
                <button key={key} onClick={() => upd('vat_regime', key)}
                  className="w-full text-left p-4 rounded-2xl border-2 transition-all"
                  style={{
                    borderColor: form.vat_regime === key ? 'var(--accent)' : '#F0EDE8',
                    background: form.vat_regime === key ? 'var(--accent-l)' : 'white',
                  }}
                >
                  <div className="font-black text-sm" style={{ color: form.vat_regime === key ? 'var(--accent-d)' : 'var(--navy)' }}>
                    {label}
                  </div>
                </button>
              ))}
            </div>
            {form.vat_regime !== 'franchise_base' && form.vat_regime !== 'non_assujetti' && (
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">
                  N° TVA intracommunautaire
                </label>
                <input type="text" value={form.vat_number} onChange={e => upd('vat_number', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent"
                  placeholder="FR12 123456789" />
              </div>
            )}
            <div className="mt-4 p-4 rounded-2xl" style={{ background: 'var(--accent-l)' }}>
              <div className="text-xs font-black" style={{ color: 'var(--accent-d)' }}>
                {form.vat_regime === 'franchise_base'
                  ? '✓ Vos factures ne mentionneront pas de TVA — mention "TVA non applicable, art. 293 B du CGI"'
                  : form.vat_regime === 'non_assujetti'
                  ? '✓ Pas de TVA applicable — CESU ou particulier employeur'
                  : '✓ Vos factures incluront la TVA aux taux applicables (20%, 10%, 5,5%)'}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 — Services */}
        {step === 3 && (
          <div>
            <h2 className="font-fredoka text-2xl text-navy mb-1">Services proposés</h2>
            <p className="text-sm text-gray-400 font-bold mb-5">
              Sélectionnez un ou plusieurs services. Vous apparaîtrez sur la carte pour chacun.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(SERVICE_LABELS) as [ServiceType, { label: string; emoji: string }][]).map(([key, { label, emoji }]) => (
                <button key={key} onClick={() => toggleService(key)}
                  className="p-4 rounded-2xl border-2 text-center transition-all"
                  style={{
                    borderColor: form.services.includes(key) ? 'var(--accent)' : '#F0EDE8',
                    background: form.services.includes(key) ? 'var(--accent-l)' : 'white',
                  }}
                >
                  <div className="text-2xl mb-1">{emoji}</div>
                  <div className="text-xs font-black" style={{ color: form.services.includes(key) ? 'var(--accent-d)' : 'var(--navy)' }}>
                    {label}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4 — Documents requis */}
        {step === 4 && (
          <div>
            <h2 className="font-fredoka text-2xl text-navy mb-1">Documents requis</h2>
            <p className="text-sm text-gray-400 font-bold mb-2">
              Pour <span className="text-navy">{LEGAL_FORM_LABELS[form.legal_form]}</span>
            </p>
            <p className="text-xs text-gray-400 font-bold mb-5">
              Upload après inscription. Vérification sous 24-48h par notre équipe.
            </p>
            <div className="space-y-3">
              {requiredDocs.map(docType => {
                const doc = DOCUMENT_LABELS[docType]
                return (
                  <div key={docType} className="flex items-start gap-3 p-4 rounded-2xl border-2 border-gray-100">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: 'var(--accent-l)' }}>📄</div>
                    <div className="flex-1">
                      <div className="font-black text-sm text-navy">{doc.label}</div>
                      <div className="text-xs text-gray-400 font-bold mt-0.5">{doc.description}</div>
                    </div>
                    {doc.required && (
                      <span className="text-xs font-black px-2 py-1 rounded-full"
                        style={{ background: '#DCFCE7', color: '#15803D' }}>Requis</span>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="mt-4 p-4 rounded-2xl" style={{ background: '#FFF7ED', border: '1px solid #FB923C' }}>
              <div className="text-xs font-black" style={{ color: '#C2410C' }}>
                ⚠️ Nexto ne vérifie pas l'authenticité des documents — elle met à disposition le stockage sécurisé.
                La plateforme est une mise en relation, non un garant de conformité fiscale ou professionnelle.
              </div>
            </div>
          </div>
        )}

        {/* STEP 5 — Profil public */}
        {step === 5 && (
          <div>
            <h2 className="font-fredoka text-2xl text-navy mb-1">Profil public</h2>
            <p className="text-sm text-gray-400 font-bold mb-5">Ce que voient les clients sur votre fiche.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">
                  Bio (160 caractères max)
                </label>
                <textarea value={form.bio} onChange={e => upd('bio', e.target.value)}
                  maxLength={160} rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent resize-none"
                  placeholder="Ex : Plombier professionnel depuis 12 ans. Urgences 7j/7. RC Pro et décennale." />
                <div className="text-right text-xs text-gray-400 font-bold mt-1">{form.bio.length}/160</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">
                    Tarif horaire (€)
                  </label>
                  <input type="number" value={form.hourly_rate} onChange={e => upd('hourly_rate', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent"
                    placeholder="45" />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">
                    Déplacement (€)
                  </label>
                  <input type="number" value={form.travel_fee} onChange={e => upd('travel_fee', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent"
                    placeholder="15" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">
                  Zone d'intervention
                </label>
                <div className="flex gap-2">
                  {['5', '10', '20', '50'].map(r => (
                    <button key={r} onClick={() => upd('radius_km', r)}
                      className="flex-1 py-3 rounded-2xl border-2 text-sm font-black transition-all"
                      style={{
                        borderColor: form.radius_km === r ? 'var(--accent)' : '#F0EDE8',
                        background: form.radius_km === r ? 'var(--accent-l)' : 'white',
                        color: form.radius_km === r ? 'var(--accent-d)' : 'var(--navy)',
                      }}
                    >{r} km</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 6 — IBAN */}
        {step === 6 && (
          <div>
            <h2 className="font-fredoka text-2xl text-navy mb-1">Coordonnées bancaires</h2>
            <p className="text-sm text-gray-400 font-bold mb-5">
              Pour recevoir vos virements. Chiffré et sécurisé.
            </p>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">IBAN</label>
              <input type="text" value={form.iban} onChange={e => upd('iban', e.target.value.toUpperCase())}
                className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent tracking-widest"
                placeholder="FR76 3000 6000 0112 3456 7890 189" />
            </div>
            <div className="mt-4 p-4 rounded-2xl" style={{ background: '#DCFCE7' }}>
              <div className="text-xs font-black" style={{ color: '#15803D' }}>
                💶 Virements SEPA J+2 après chaque intervention validée.
                La commission Nexto est déduite automatiquement avant virement.
              </div>
            </div>
            <div className="mt-3 p-4 rounded-2xl border-2 border-gray-100">
              <div className="text-xs font-black text-gray-500 mb-2 uppercase tracking-wider">Récapitulatif</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Statut</span><span className="font-black">{LEGAL_FORM_LABELS[form.legal_form]}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">TVA</span><span className="font-black">{VAT_REGIME_LABELS[form.vat_regime]}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Services</span><span className="font-black">{form.services.length} sélectionné(s)</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Tarif</span><span className="font-black">{form.hourly_rate || '—'} €/h</span></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="bg-white px-5 pb-8 pt-3 flex gap-3">
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)}
            className="flex-1 py-4 rounded-full border-2 border-gray-100 font-fredoka text-lg text-navy">
            ← Retour
          </button>
        )}
        <button
          onClick={isLastStep ? submit : () => setStep(s => s + 1)}
          disabled={
            loading ||
            (step === 0 && !form.legal_form) ||
            (step === 1 && !form.company_name) ||
            (step === 3 && form.services.length === 0)
          }
          className="flex-1 py-4 rounded-full text-white font-fredoka text-lg disabled:opacity-50"
          style={{ background: 'var(--accent)' }}
        >
          {loading ? 'Enregistrement...' : isLastStep ? 'Soumettre mon profil 🚀' : 'Continuer →'}
        </button>
      </div>
    </div>
  )
}
