// Messages « PING » et miroir du litige dans la conversation d'une mission (migration 059b).
// Aucun import : utilisable côté page de chat, tests et admin.
export type ChatMsgLike = { sender_id: string | null; kind?: string | null; dispute_id?: string | null }
export type ChatTxLike = { buyer_id?: string | null; seller_id?: string | null } | null | undefined

/**
 * Message de PING (médiation) : kind 'mediation', ou expéditeur qui n'est ni l'acheteur ni le vendeur
 * (un compte admin ; repli quand la base refuse le kind 'mediation').
 */
export function isPingMessage(m: ChatMsgLike, tx: ChatTxLike): boolean {
  if (m.kind === 'mediation') return true
  if (!tx || !m.sender_id || m.kind === 'system' || m.kind === 'offer') return false
  return !!tx.buyer_id && !!tx.seller_id && m.sender_id !== tx.buyer_id && m.sender_id !== tx.seller_id
}

/** Message recopié du fil d'un litige (colonne messages.dispute_id, migration 059b). */
export const isDisputeMirror = (m: ChatMsgLike): boolean => !!m.dispute_id && m.kind !== 'system'

/** Quelle carte spéciale afficher dans le chat : 'litige' (miroir), 'ping' (message de PING), ou null (bulle ordinaire). */
export function specialChatKind(m: ChatMsgLike, tx: ChatTxLike): 'litige' | 'ping' | null {
  if (m.kind === 'offer') return null
  if (isDisputeMirror(m)) return 'litige'
  if (isPingMessage(m, tx)) return 'ping'
  return null
}
