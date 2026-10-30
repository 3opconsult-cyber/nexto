"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'

type Commune = { nom: string; code: string }

const field: React.CSSProperties = {
  display: 'block', width: '100%', border: '1.5px solid #E7EDEB', borderRadius: 11, marginTop: 5,
  padding: '10px 12px', fontSize: 13.5, fontFamily: 'Inter, sans-serif', background: '#fff', color: '#123644',
}
const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 600, color: '#4E6470', marginBottom: 12 }

// Service public des communes (INSEE), pour éviter de faire saisir des codes au client.
async function communes(q: { codePostal?: string; nom?: string }): Promise<Commune[]> {
  const p = new URLSearchParams({ fields: 'nom,code', limit: '8' })
  if (q.codePostal) p.set('codePostal', q.codePostal)
  if (q.nom) { p.set('nom', q.nom); p.set('boost', 'population') }
  try { const r = await fetch(`https://geo.api.gouv.fr/communes?${p}`); return r.ok ? await r.json() : [] } catch { return [] }
}

export default function AvanceImmediate() {
  const router = useRouter()
  const [dispo, setDispo] = useState<boolean | null>(null)
  const [statut, setStatut] = useState<{ statut: string; message: string | null } | null>(null)
  const [f, setF] = useState({
    civilite: '2', nomNaissance: '', nomUsage: '', prenoms: '', dateNaissance: '',
    etranger: false, paysNaissance: '', villeNaissance: '', inseeNaissance: '',
    numeroVoie: '', libelleVoie: '', complement: '', codePostal: '', inseeCommune: '', libelleCommune: '',
    tel: '', email: '', iban: '', bic: '', titulaire: '',
  })
  const [birthOpts, setBirthOpts] = useState<Commune[]>([])
  const [cpOpts, setCpOpts] = useState<Commune[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f, v: string | boolean) => setF(prev => ({ ...prev, [k]: v }))

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      set('email', user.email || '')
      const { data } = await supabase.from('avance_immediate_clients').select('statut, message').eq('user_id', user.id).maybeSingle()
      if (data) setStatut(data)
    })
    fetch('/api/avance-immediate').then(r => r.json()).then(j => setDispo(!!j.disponible)).catch(() => setDispo(false))
  }, [router])

  useEffect(() => {
    if (f.codePostal.length !== 5) { setCpOpts([]); return }
    communes({ codePostal: f.codePostal }).then(list => { setCpOpts(list); if (list.length === 1) { set('inseeCommune', list[0].code); set('libelleCommune', list[0].nom) } })
  }, [f.codePostal])

  useEffect(() => {
    if (f.etranger || f.villeNaissance.length < 2 || f.inseeNaissance) { setBirthOpts([]); return }
    const id = setTimeout(() => communes({ nom: f.villeNaissance }).then(setBirthOpts), 250)
    return () => clearTimeout(id)
  }, [f.villeNaissance, f.etranger, f.inseeNaissance])

  async function submit() {
    setErr('')
    if (!f.nomNaissance || !f.prenoms || !f.dateNaissance || !f.libelleVoie || !f.inseeCommune || !f.tel || !f.email || !f.iban || !f.bic || !f.titulaire
      || (f.etranger ? !f.paysNaissance : !f.inseeNaissance)) { setErr('Merci de remplir tous les champs.'); return }
    const insee = f.inseeNaissance
    const body = {
      civilite: f.civilite, nomNaissance: f.nomNaissance.trim(), nomUsage: f.nomUsage.trim() || undefined, prenoms: f.prenoms.trim(),
      dateNaissance: f.dateNaissance,
      lieuNaissance: f.etranger
        ? { codePaysNaissance: f.paysNaissance.trim() }
        : { codePaysNaissance: '99100', departementNaissance: insee.startsWith('97') ? insee.slice(0, 3) : '0' + insee.slice(0, 2), communeNaissance: { codeCommune: insee.startsWith('97') ? insee.slice(2) : insee.slice(2), libelleCommune: f.villeNaissance } },
      numeroTelephonePortable: f.tel.replace(/\s/g, ''), adresseMail: f.email.trim(),
      adressePostale: { numeroVoie: f.numeroVoie || undefined, libelleVoie: f.libelleVoie, complement: f.complement || undefined, codeCommune: f.inseeCommune, libelleCommune: f.libelleCommune, codePostal: f.codePostal, codePays: '99100' },
      coordonneeBancaire: { iban: f.iban.replace(/\s/g, '').toUpperCase(), bic: f.bic.replace(/\s/g, '').toUpperCase(), titulaire: f.titulaire.trim() },
    }
    setBusy(true)
    const r = await fetch('/api/avance-immediate/inscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErr(j.error || "L'inscription n'a pas abouti."); return }
    setStatut({ statut: 'inscrit', message: null })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#123644', fontFamily: 'Inter, sans-serif', paddingBottom: 40 }}>
      <div style={{ padding: '16px 20px 0' }}><NavDrawer /></div>
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff' }}>Crédit d&apos;impôt immédiat</div>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.8)', marginTop: 6, maxWidth: '42ch', lineHeight: 1.5 }}>
          Le ménage et le repassage ouvrent droit à un crédit d&apos;impôt de 50 %. Avec l&apos;avance immédiate de l&apos;Urssaf, vous ne payez que la moitié, tout de suite, au lieu d&apos;attendre l&apos;année suivante.
        </p>
      </div>

      <div style={{ background: '#F3F6F5', borderRadius: '20px 20px 0 0', padding: '20px 16px', minHeight: '60vh' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644', marginBottom: 8 }}>Comment ça marche</div>
            {['Vous vous inscrivez une fois, ici.', "L'Urssaf vous envoie un courriel pour activer votre compte.", 'Après chaque prestation, vous validez la demande sur votre espace Urssaf.', "L'Urssaf prélève seulement votre moitié et verse le reste."].map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: '#123644', marginBottom: 6 }}>
                <b style={{ color: '#0C8F7E', width: 14 }}>{i + 1}</b><span>{s}</span>
              </div>
            ))}
            <p style={{ fontSize: 11.5, color: '#6E8592', margin: '8px 0 0', lineHeight: 1.5 }}>
              Conditions de l&apos;Urssaf : avoir déjà fait au moins une déclaration de revenus, et que le prestataire soit déclaré en services à la personne. Plafond : 12 000 € de dépenses par an.
            </p>
          </div>

          {dispo === false && (
            <div style={{ background: 'rgba(18,179,156,.08)', borderRadius: 14, padding: 14, fontSize: 13, color: '#123644', lineHeight: 1.55 }}>
              Ce service arrive bientôt sur PING. Vous serez prévenu dès que l&apos;inscription est ouverte.
            </div>
          )}

          {dispo && statut && statut.statut !== 'refuse' && (
            <div style={{ background: '#fff', border: '1.5px solid #12B39C', borderRadius: 14, padding: 14, fontSize: 13, color: '#123644', lineHeight: 1.55 }}>
              <b>Inscription transmise à l&apos;Urssaf.</b> Activez votre compte depuis le courriel de l&apos;Urssaf : vos prochaines prestations éligibles ne vous coûteront plus que 50 %.
            </div>
          )}

          {dispo && (!statut || statut.statut === 'refuse') && (
            <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 16 }}>
              {statut?.statut === 'refuse' && <p style={{ fontSize: 12.5, color: '#c0503a', marginTop: 0 }}>L&apos;Urssaf n&apos;a pas pu vous inscrire : {statut.message}. Vérifiez vos informations.</p>}
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644', marginBottom: 12 }}>Vos informations</div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 13, color: '#123644' }}>
                <label><input type="radio" checked={f.civilite === '2'} onChange={() => set('civilite', '2')} /> Madame</label>
                <label><input type="radio" checked={f.civilite === '1'} onChange={() => set('civilite', '1')} /> Monsieur</label>
              </div>
              <label style={lbl}>Nom de naissance<input style={field} value={f.nomNaissance} onChange={e => set('nomNaissance', e.target.value)} /></label>
              <label style={lbl}>Nom d&apos;usage (facultatif)<input style={field} value={f.nomUsage} onChange={e => set('nomUsage', e.target.value)} /></label>
              <label style={lbl}>Prénoms<input style={field} value={f.prenoms} onChange={e => set('prenoms', e.target.value)} /></label>
              <label style={lbl}>Date de naissance<input type="date" style={field} value={f.dateNaissance} onChange={e => set('dateNaissance', e.target.value)} /></label>
              <label style={{ ...lbl, display: 'flex', gap: 8, alignItems: 'center', color: '#123644' }}>
                <input type="checkbox" checked={f.etranger} onChange={e => set('etranger', e.target.checked)} /> Né(e) à l&apos;étranger
              </label>
              {f.etranger
                ? <label style={lbl}>Code pays INSEE (ex. 99134 pour l&apos;Espagne)<input style={field} value={f.paysNaissance} onChange={e => set('paysNaissance', e.target.value)} /></label>
                : <label style={lbl}>Commune de naissance
                    <input style={field} value={f.villeNaissance} onChange={e => { set('villeNaissance', e.target.value); set('inseeNaissance', '') }} placeholder="Tapez le nom de la commune" />
                    {birthOpts.length > 0 && (
                      <div style={{ border: '1px solid #E7EDEB', borderRadius: 10, marginTop: 4, background: '#fff' }}>
                        {birthOpts.map(c => <div key={c.code} onClick={() => { set('villeNaissance', c.nom); set('inseeNaissance', c.code); setBirthOpts([]) }} style={{ padding: '8px 12px', fontSize: 13, color: '#123644', cursor: 'pointer' }}>{c.nom} <span style={{ color: '#6E8592' }}>({c.code.slice(0, 2)})</span></div>)}
                      </div>
                    )}
                  </label>}

              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644', margin: '18px 0 10px' }}>Adresse</div>
              <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(0,1fr)', gap: 10 }}>
                <label style={lbl}>N°<input style={field} value={f.numeroVoie} onChange={e => set('numeroVoie', e.target.value)} /></label>
                <label style={lbl}>Voie<input style={field} value={f.libelleVoie} onChange={e => set('libelleVoie', e.target.value)} placeholder="rue de la Paix" /></label>
              </div>
              <label style={lbl}>Complément (facultatif)<input style={field} value={f.complement} onChange={e => set('complement', e.target.value)} /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr)', gap: 10 }}>
                <label style={lbl}>Code postal<input style={field} inputMode="numeric" maxLength={5} value={f.codePostal} onChange={e => { set('codePostal', e.target.value); set('inseeCommune', ''); set('libelleCommune', '') }} /></label>
                <label style={lbl}>Commune
                  <select style={field} value={f.inseeCommune} onChange={e => { const c = cpOpts.find(x => x.code === e.target.value); set('inseeCommune', e.target.value); set('libelleCommune', c?.nom || '') }}>
                    <option value="">{cpOpts.length ? 'Choisir' : '—'}</option>
                    {cpOpts.map(c => <option key={c.code} value={c.code}>{c.nom}</option>)}
                  </select>
                </label>
              </div>

              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644', margin: '18px 0 10px' }}>Contact</div>
              <label style={lbl}>Téléphone portable<input style={field} inputMode="tel" value={f.tel} onChange={e => set('tel', e.target.value)} /></label>
              <label style={lbl}>Courriel<input style={field} type="email" value={f.email} onChange={e => set('email', e.target.value)} /></label>

              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644', margin: '18px 0 4px' }}>Compte bancaire pour le prélèvement Urssaf</div>
              <p style={{ fontSize: 11.5, color: '#6E8592', margin: '0 0 10px' }}>Transmis directement à l&apos;Urssaf, jamais conservé par PING.</p>
              <label style={lbl}>IBAN<input style={field} value={f.iban} onChange={e => set('iban', e.target.value)} /></label>
              <label style={lbl}>BIC<input style={field} value={f.bic} onChange={e => set('bic', e.target.value)} /></label>
              <label style={lbl}>Titulaire du compte<input style={field} value={f.titulaire} onChange={e => set('titulaire', e.target.value)} /></label>

              {err && <p style={{ fontSize: 12.5, color: '#c0503a' }}>{err}</p>}
              <button onClick={submit} disabled={busy} style={{ width: '100%', border: 'none', borderRadius: 999, padding: 14, background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', opacity: busy ? .6 : 1 }}>
                {busy ? 'Envoi à l’Urssaf…' : "M'inscrire à l'avance immédiate"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
