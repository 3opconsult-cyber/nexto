"use client"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { whatsappUrl } from '@/lib/invoiceShare'
import { HUB_FLAG } from '@/components/HubReturn'

// Hub de Romain : un seul écran, téléphone et ordinateur, pour entrer dans chaque espace et inviter quelqu'un.
// Aucun mot de passe ici : les comptes de test s'ouvrent par l'adresse pré-remplie (le gestionnaire de mots
// de passe de l'appareil fait le reste). Aucun compte administrateur de test n'existe : « Admin » demande
// le vrai compte administrateur.
const ICONS: Record<string, JSX.Element> = {
  admin: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  client: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  pro: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></>,
  map: <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>,
  play: <path d="M8 5v14l11-7z" />,
  doc: <><path d="M6 2h9l3 3v17H6z" /><path d="M9 9h6M9 13h6M9 17h4" /></>,
  swap: <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
}

type Tile = { icon: string; label: string; sub: string; href?: string; account?: { email: string; next: string }; tag?: string; tone?: 'dark' | 'green' | 'teal' | 'light'; wide?: boolean }

const ESPACES: Tile[] = [
  { icon: 'admin', label: 'Admin', sub: 'Compte administrateur réel', href: '/admin', tag: 'Admin', tone: 'dark', wide: true },
  { icon: 'client', label: 'Client test', sub: 'Particulier : carte, agenda, messages', account: { email: 'audit.client.claude@ping-demo.invalid', next: '/map' }, tag: 'Compte test', tone: 'green' },
  { icon: 'pro', label: 'Prestataire test', sub: 'Demandes, agenda, Mon entreprise', account: { email: 'audit.pro.claude@ping-demo.invalid', next: '/pro/carte' }, tag: 'Compte test', tone: 'teal' },
  { icon: 'map', label: 'Carte', sub: 'Avec le compte connecté', href: '/map', tone: 'light', wide: true },
]

const SUPPORTS: Tile[] = [
  { icon: 'play', label: 'Animation client', sub: 'Vidéo particulier', href: '/animation-client' },
  { icon: 'play', label: 'Animation prestataire', sub: 'Vidéo professionnel', href: '/animation-prestataire' },
  { icon: 'doc', label: 'Plaquettes', sub: 'Supports imprimables', href: '/plaquettes' },
  { icon: 'doc', label: 'Présentation', sub: 'Pitch complet', href: '/presentation' },
]

type Cible = 'les-deux' | 'particulier' | 'pro'
const CIBLES: { id: Cible; label: string; path: string; texte: string }[] = [
  { id: 'les-deux', label: 'Particulier ou pro', path: '/essai', texte: 'Découvrez PING en quelques secondes, puis inscrivez-vous :' },
  { id: 'particulier', label: 'Particulier', path: '/auth/signup?role=client', texte: 'PING vous met en relation avec un prestataire de ménage ou de repassage près de chez vous. Inscription :' },
  { id: 'pro', label: 'Professionnel', path: '/auth/signup?role=pro', texte: 'PING vous met en relation avec des clients près de chez vous. Inscription prestataire :' },
]

export default function Hub() {
  const [origin, setOrigin] = useState('')
  const [cible, setCible] = useState<Cible>('les-deux')
  const [copie, setCopie] = useState(false)
  const [bouton, setBouton] = useState(false)
  const [enCours, setEnCours] = useState<string | null>(null)
  const [courant, setCourant] = useState<string | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
    try { localStorage.setItem(HUB_FLAG, localStorage.getItem(HUB_FLAG) ?? '1'); setBouton(localStorage.getItem(HUB_FLAG) === '1') } catch { }
    try { createClient().auth.getSession().then(({ data }) => setCourant(data.session?.user.email ?? null)).catch(() => { }) } catch { }
  }, [])

  const c = CIBLES.find(x => x.id === cible)!
  const lien = origin ? `${origin}${c.path}${c.path.includes('?') ? '&' : '?'}utm_source=whatsapp&utm_medium=invitation` : ''
  const message = `${c.texte} ${lien}`

  function reglerBouton(v: boolean) {
    setBouton(v)
    try { localStorage.setItem(HUB_FLAG, v ? '1' : '0') } catch { }
  }

  async function copier() {
    try { await navigator.clipboard.writeText(lien); setCopie(true); setTimeout(() => setCopie(false), 2000) } catch { }
  }

  async function partager() {
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }
    if (nav.share) { try { await nav.share({ text: message }) } catch { } } else copier()
  }

  // Compte de test : déjà connecté avec cette adresse -> on y va ; sinon on se déconnecte et on ouvre la connexion pré-remplie.
  async function ouvrirCompte(t: Tile) {
    if (!t.account) return
    setEnCours(t.label)
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    if (data.session?.user.email?.toLowerCase() === t.account.email) { window.location.href = t.account.next; return }
    if (data.session) await supabase.auth.signOut()
    window.location.href = `/auth/login?email=${encodeURIComponent(t.account.email)}&next=${encodeURIComponent(t.account.next)}`
  }

  const TONES = {
    dark: { bg: 'linear-gradient(135deg,#123644,#1D5568)', fg: '#fff', sub: 'rgba(255,255,255,.78)', ico: 'rgba(255,255,255,.16)', st: '#fff', tag: 'rgba(255,255,255,.18)', tagfg: '#fff', bd: 'transparent' },
    green: { bg: 'linear-gradient(135deg,#12B39C,#0E9A86)', fg: '#fff', sub: 'rgba(255,255,255,.88)', ico: 'rgba(255,255,255,.2)', st: '#fff', tag: 'rgba(255,255,255,.22)', tagfg: '#fff', bd: 'transparent' },
    teal: { bg: 'linear-gradient(135deg,#2FD06E,#1FAE58)', fg: '#fff', sub: 'rgba(255,255,255,.9)', ico: 'rgba(255,255,255,.22)', st: '#fff', tag: 'rgba(255,255,255,.22)', tagfg: '#fff', bd: 'transparent' },
    light: { bg: '#fff', fg: '#123644', sub: '#4E6470', ico: '#E6F7F4', st: '#0B8374', tag: 'rgba(18,179,156,.14)', tagfg: '#0B8374', bd: '#E7EDEB' },
  }
  const carte = (t: Tile) => {
    const k = TONES[t.tone ?? 'light']
    const contenu = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: k.ico, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={k.st} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{ICONS[t.icon]}</svg>
          </div>
          {t.tag && <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: k.tag, color: k.tagfg }}>{t.tag}</span>}
        </div>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: k.fg, marginTop: 14 }}>{t.label}</div>
        <div style={{ fontSize: 12.5, color: k.sub, marginTop: 3, lineHeight: 1.4 }}>{enCours === t.label ? 'Ouverture…' : t.sub}</div>
      </>
    )
    const style: React.CSSProperties = { gridColumn: t.wide ? '1 / -1' : undefined, display: 'block', textAlign: 'left', minHeight: t.wide ? 110 : 132, boxSizing: 'border-box', padding: 16, background: k.bg, border: `1px solid ${k.bd}`, borderRadius: 20, textDecoration: 'none', cursor: 'pointer', font: 'inherit', boxShadow: t.tone && t.tone !== 'light' ? '0 8px 20px rgba(18,54,68,.16)' : '0 2px 8px rgba(18,54,68,.05)' }
    return t.href
      ? <a key={t.label} href={t.href} style={style}>{contenu}</a>
      : <button key={t.label} type="button" onClick={() => ouvrirCompte(t)} style={style}>{contenu}</button>
  }

  const titre: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.04em', margin: '26px 0 10px 2px' }
  const grille: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 14 }
  const bouton48: React.CSSProperties = { minHeight: 48, borderRadius: 14, border: '1.5px solid #CFDAD7', background: '#fff', color: '#123644', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: '0 14px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#123644', color: '#fff', padding: '40px 20px 34px', borderRadius: '0 0 28px 28px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 30 }}>PING</div>
          <div style={{ fontSize: 14, opacity: .85, marginTop: 4 }}>Hub : tous les accès, sur téléphone et ordinateur</div>
          <div style={{ fontSize: 12.5, marginTop: 10, opacity: .8 }}>{courant ? `Connecté : ${courant}` : 'Aucun compte connecté sur cet appareil'}</div>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '4px 16px 40px' }}>
        <div style={titre}>Entrer dans un espace</div>
        <div style={grille}>{ESPACES.map(carte)}</div>
        <p style={{ fontSize: 12, color: '#4E6470', margin: '10px 2px 0', lineHeight: 1.5 }}>
          Les comptes de test pré-remplissent l’adresse : le mot de passe est celui de votre gestionnaire de mots de passe. Le bouton rond « Hub » vous ramène ici depuis chaque écran.
        </p>

        <div style={titre}>Inviter quelqu’un</div>
        <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 16 }}>
          <div role="group" aria-label="Pour qui" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CIBLES.map(x => (
              <button key={x.id} type="button" onClick={() => setCible(x.id)} aria-pressed={cible === x.id}
                style={{ ...bouton48, flex: '1 1 120px', borderColor: cible === x.id ? '#12B39C' : '#CFDAD7', background: cible === x.id ? '#E6F7F4' : '#fff', color: cible === x.id ? '#0B8374' : '#123644' }}>
                {x.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12.5, color: '#4E6470', margin: '12px 0 6px' }}>
            {cible === 'les-deux' ? 'Animation courte avec le choix « Je suis un particulier / Je suis un professionnel », qui mène à l’inscription.' : 'Lien direct vers l’inscription.'}
          </div>
          <div style={{ fontSize: 13, color: '#123644', background: '#F3F6F5', borderRadius: 12, padding: 12, wordBreak: 'break-all', lineHeight: 1.45 }}>{message}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8, marginTop: 12 }}>
            <a href={lien ? whatsappUrl(message) : '#'} target="_blank" rel="noopener noreferrer"
              style={{ ...bouton48, background: '#12B39C', borderColor: '#12B39C', color: '#fff' }}>Envoyer sur WhatsApp</a>
            <button type="button" onClick={partager} style={bouton48}>Partager…</button>
            <button type="button" onClick={copier} style={bouton48}>{copie ? 'Lien copié' : 'Copier le lien'}</button>
            <a href={c.path} style={bouton48}>Voir ce que le destinataire voit</a>
          </div>
        </div>

        <div style={titre}>Animations et supports</div>
        <div style={grille}>{SUPPORTS.map(carte)}</div>

        <div style={titre}>Réglage de cet appareil</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: '10px 14px', cursor: 'pointer' }}>
          <input type="checkbox" checked={bouton} onChange={e => reglerBouton(e.target.checked)} style={{ width: 22, height: 22, accentColor: '#12B39C' }} />
          <span style={{ fontSize: 13.5, color: '#123644', fontWeight: 600 }}>Afficher le bouton « Hub » dans les écrans</span>
        </label>
      </div>
    </div>
  )
}
