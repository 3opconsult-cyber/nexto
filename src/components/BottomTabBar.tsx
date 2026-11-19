"use client"
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { readMode, type Mode } from '@/lib/mode'
import { useUnreadTotal } from '@/lib/unread'
import UnreadBadge from '@/components/UnreadBadge'
import { useTodayMission } from '@/lib/todayMission'

// Barre d'onglets mobile. Suit le mode courant (particulier / prestataire, cf. lib/mode.ts) :
// en mode pro, « Carte » mène aux demandes autour de soi (/pro/carte), jamais à la carte client.
const PRO_ROUTE = /^\/pro\/(carte|dashboard|documents|onboarding|attente|annonce|tarifs|revenus|paiements|disponibilites)(\/|$)/

const ICONS: Record<string, JSX.Element> = {
  map: <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>,
  msg: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  ag: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>,
  prof: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  ent: <><path d="M3 21V9l9-6 9 6v12" /><path d="M9 21v-6h6v6" /></>,
}

export default function BottomTabBar() {
  const router = useRouter()
  const pathname = usePathname() || ''
  const [mode, setMode] = useState<Mode>('particulier')

  useEffect(() => {
    const sync = () => setMode(PRO_ROUTE.test(pathname) ? 'pro' : pathname.startsWith('/client/profil') ? 'particulier' : readMode())
    sync()
    window.addEventListener('ping-mode', sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener('ping-mode', sync); window.removeEventListener('storage', sync) }
  }, [pathname])

  const unread = useUnreadTotal(mode, pathname)
  // Accès rapide « Mission du jour » (audit 18/11) : bouton rond central, seulement quand une mission confirmée
  // est en cours ou prévue aujourd'hui (à partir de 2 h avant). Pastille rouge : le client doit confirmer.
  const today = useTodayMission(mode, pathname)
  const isPro = mode === 'pro'
  // Couleurs de la maquette : onglet actif teal foncé (client) ou or foncé (prestataire), contraste AA ;
  // bouton rond « Mission » en dégradé teal foncé (client) ou or (prestataire).
  const accent = isPro ? '#8A6520' : '#0B8374'
  const missionBg = isPro ? '#F2A93B' : 'linear-gradient(160deg,#0B8374,#08695D)'
  const tabs = [
    { label: isPro ? 'Demandes' : 'Carte', path: isPro ? '/pro/carte' : '/map', icon: 'map' },
    { label: 'Messages', path: '/messages', icon: 'msg' },
    { label: 'Agenda', path: '/agenda', icon: 'ag' },
    isPro
      ? { label: 'Entreprise', path: '/pro/dashboard', icon: 'ent' }
      : { label: 'Profil', path: '/client/profil', icon: 'prof' },
  ]

  // Action attendue (audit ergonomie 19/11, correction 14) : en plus de la pastille rouge sur « Mission », un
  // bandeau d'un appui au-dessus de la barre, sur tous les écrans sauf la mission elle-même (carte comprise) :
  // le client voit que la photo d'arrivée l'attend ou que son code de fin est demandé, sans ouvrir Messages.
  const onMission = !!today && pathname.startsWith(`/mission/${today.id}`)
  const callText = today?.urgent && !onMission
    ? isPro
      ? 'Le client vous a envoyé son code : le saisir'
      : today.action === 'fin' ? 'Votre prestataire demande votre code de fin' : 'Votre prestataire est arrivé : confirmez'
    : null

  return (
    <div className="app-bottom-bar" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1500, display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
      {callText && today && (
        <button type="button" onClick={() => router.push(`/mission/${today.id}/jour`)}
          style={{ pointerEvents: 'auto', width: 'calc(100% - 24px)', maxWidth: 456, minHeight: 48, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', border: 'none', borderRadius: 14, background: '#C0503A', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, textAlign: 'left', cursor: 'pointer', boxShadow: '0 8px 20px rgba(192,80,58,.3)' }}>
          <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: '#fff', flexShrink: 0 }} />
          <span role="status" style={{ flex: 1, minWidth: 0 }}>{callText}</span>
          <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M9 6l6 6-6 6" /></svg>
        </button>
      )}
      <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: 480, display: 'flex', background: '#fff', borderTop: '1px solid #DCE5E3', boxShadow: '0 -4px 16px rgba(18,54,68,.06)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {tabs.map((t, i) => {
          const missionBtn = i === 2 && today ? (
            <button key="mission" onClick={() => router.push(`/mission/${today.id}/jour`)} aria-label={today.urgent ? 'Mission du jour, action attendue' : 'Mission du jour'}
              style={{ flex: 1, border: 'none', background: 'none', padding: '0 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: '#123644', cursor: 'pointer' }}>
              <span style={{ position: 'relative', width: 46, height: 46, marginTop: -16, borderRadius: '50%', background: missionBg, color: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 6px 14px rgba(18,179,156,.4)', border: '2.5px solid #fff' }}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" /></svg>
                {today.urgent && <span aria-label="Action attendue" style={{ position: 'absolute', top: -2, right: -2, width: 13, height: 13, borderRadius: '50%', background: '#E5484D', border: '2px solid #fff' }} />}
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 700 }}>Mission</span>
            </button>
          ) : null
          const on = pathname === t.path || pathname.startsWith(t.path + '/')
          return [missionBtn, (
            <button key={t.path} onClick={() => router.push(t.path)}
              style={{ flex: 1, border: 'none', background: 'none', padding: '10px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: on ? accent : '#4E6470', cursor: 'pointer' }}>
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{ICONS[t.icon]}</svg>
                {t.icon === 'msg' && <UnreadBadge n={unread} absolute />}
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 700 }}>{t.label}</span>
            </button>
          )]
        })}
      </div>
    </div>
  )
}
