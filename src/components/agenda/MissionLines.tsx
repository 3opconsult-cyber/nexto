"use client"
import { useRouter } from 'next/navigation'
import Modal from '@/components/Modal'

/**
 * Lignes de mission de l'historique (24/11, remarque de Romain) : l'agenda est un point d'entrée de recherche.
 * Une ligne = heure, autre partie, service, état + actions d'un appui (Conversation, QR et code le jour même, Facture si elle existe, Mission).
 * Utilisé par la feuille « jour » du calendrier et par l'onglet « Terminées » de /agenda.
 * Aucun calcul : tout vient de la page (états, noms, factures déjà lues dans le mode courant).
 */
export type MissionLine = {
  id: string
  time: string        // « 09:00 » ou date courte pour l'historique
  name: string        // nom de l'autre partie
  service: string     // « Ménage »
  state: string       // « À accepter », « Confirmée », « Terminée », « Litige »…
  tone?: 'warn' | 'ok' | 'muted' | 'alert'
  hasInvoice: boolean
  /** Mission du jour : ajoute l'accès direct au QR et au code (audit 27/11). */
  today?: boolean
  extra?: React.ReactNode
}

const TONE: Record<string, { bg: string; fg: string }> = {
  warn: { bg: '#FFF7ED', fg: '#7A5717' }, ok: { bg: 'rgba(18,179,156,.12)', fg: '#0B8374' },
  muted: { bg: '#EEF2F1', fg: '#4E6470' }, alert: { bg: '#FDECEC', fg: '#9B2C2C' },
}

function Action({ label, href, primary }: { label: string; href: string; primary?: boolean }) {
  const router = useRouter()
  return (
    <button type="button" onClick={() => router.push(href)}
      style={{ flex: '1 1 0', minWidth: 0, minHeight: 44, padding: '0 6px', borderRadius: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15,
        border: primary ? 'none' : '1.5px solid #DCE5E3', background: primary ? '#0B8374' : '#fff', color: primary ? '#fff' : '#123644' }}>
      {label}
    </button>
  )
}

export function MissionLineRow({ m, first }: { m: MissionLine; first?: boolean }) {
  const tone = TONE[m.tone || 'ok']
  return (
    <div data-mission-line={m.id} style={{ padding: '20px 0', borderTop: first ? 'none' : '1px solid #E3EAE8' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <b style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 17, color: '#123644', minWidth: 52, flexShrink: 0, lineHeight: 1.4 }}>{m.time}</b>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div data-line-name style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, lineHeight: 1.4, color: '#123644' }}>{m.name}</div>
          <div style={{ fontSize: 15, lineHeight: 1.5, color: '#4E6470', marginTop: 2 }}>{m.service}</div>
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, padding: '2px 10px', borderRadius: 999, background: tone.bg, color: tone.fg, flexShrink: 0, lineHeight: 1.5 }}>{m.state}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Action label="Conversation" href={`/mission/${m.id}/chat`} primary />
        {m.today && <Action label="QR et code" href={`/mission/${m.id}/jour`} primary />}
        {m.hasInvoice && <Action label="Facture" href={`/mission/${m.id}/facture`} />}
        {!m.today && <Action label="Mission" href={`/mission/${m.id}/commande`} />}
      </div>
      {m.extra && <div style={{ marginTop: 12 }}>{m.extra}</div>}
    </div>
  )
}

/** Feuille « jour » : toutes les missions du jour, une ligne chacune, jamais tronquées. */
export function DaySheet({ day, lines, onClose }: { day: Date | null; lines: MissionLine[]; onClose: () => void }) {
  const title = day ? day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''
  return (
    <Modal open={!!day} onClose={onClose} title={title ? title.charAt(0).toUpperCase() + title.slice(1) : undefined}
      footer={<button type="button" onClick={onClose} style={{ width: '100%', minHeight: 48, borderRadius: 999, border: '1.5px solid #DCE5E3', background: '#fff', color: '#123644', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>Fermer</button>}>
      <div data-day-detail>
        {lines.length === 0
          ? <p style={{ fontSize: 16, lineHeight: 1.55, color: '#4E6470', margin: '8px 0 16px' }}>Aucune mission ce jour-là.</p>
          : <>
              <p style={{ fontSize: 15, lineHeight: 1.5, color: '#4E6470', margin: '4px 0 8px' }}>{lines.length} mission{lines.length > 1 ? 's' : ''}</p>
              {lines.map((m, i) => <MissionLineRow key={m.id} m={m} first={i === 0} />)}
            </>}
      </div>
    </Modal>
  )
}
