"use client"
import { useState } from 'react'
import Link from 'next/link'
import { isPingMessage, type ChatMsgLike, type ChatTxLike } from '@/lib/chatPing'

/**
 * Cartes spéciales de la conversation d'une mission (migration 059b) :
 *  - message de PING (médiation) : carte marine « PING », visible des deux parties ;
 *  - message du fil d'un litige recopié dans la conversation : carte « Litige » repliable, avec le lien vers
 *    le dossier (/litiges/[id]), où la discussion continue.
 */
const C = { navy: '#123644', slate: '#4E6470', teal: '#0B8374', amber: '#8A6520' }

export default function ChatSpecialCard({ m, tx, userId, kind }: {
  m: ChatMsgLike & { id: string; body: string; created_at: string }
  tx: ChatTxLike; userId: string | null; kind: 'litige' | 'ping'
}) {
  const [open, setOpen] = useState(false)
  const hhmm = new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const ping = isPingMessage(m, tx)
  const who = ping ? 'PING' : m.sender_id === userId ? 'Vous' : m.sender_id === tx?.buyer_id ? 'Le client' : 'Le prestataire'

  if (kind === 'ping') {
    return (
      <div style={{ alignSelf: 'center', width: '92%', maxWidth: 420, background: C.navy, color: '#fff', borderRadius: 16, padding: '12px 16px' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#7FE0D0' }}>PING · médiation · {hhmm}</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 4, whiteSpace: 'pre-wrap' }}>{m.body}</div>
      </div>
    )
  }
  return (
    <div style={{ alignSelf: 'center', width: '92%', maxWidth: 420, background: '#FFFBF2', border: '1.5px solid #F5D9A6', borderRadius: 16, padding: '10px 14px' }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, border: 'none', background: 'none', padding: 0, minHeight: 44, cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif' }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.amber, flexShrink: 0 }}>Litige</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.navy, flexShrink: 0 }}>{who}</span>
        {!open && <span style={{ fontSize: 12.5, color: C.slate, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{m.body}</span>}
        <span style={{ fontSize: 11, color: C.slate, marginLeft: 'auto', flexShrink: 0 }}>{hhmm} {open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div style={{ paddingBottom: 6 }}>
          <div style={{ fontSize: 13.5, color: C.navy, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.body}</div>
          {m.dispute_id && (
            <Link href={`/litiges/${m.dispute_id}`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 12.5, fontWeight: 700, color: C.teal }}>
              Ouvrir le dossier du litige →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
