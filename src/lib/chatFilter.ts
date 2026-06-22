// Filtre anti-contournement : bloque échange de tel/email/adresse hors plateforme

const PHONE_RE = /(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/g
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const DIGITS_RE = /(?:\d[\s.-]*){9,}/g  // 9+ chiffres = probable numéro

const KEYWORDS = [
  'whatsapp', 'whats app', 'telegram', 'signal', 'snap', 'instagram', 'insta',
  'paypal', 'lydia', 'virement', 'espèce', 'especes', 'cash', 'liquide',
  'hors plateforme', 'hors site', 'sans passer par', 'directement', 'mon numéro',
  'mon adresse', 'rue ', 'avenue ', 'boulevard ',
]

export interface FilterResult {
  clean: string
  blocked: boolean
  reasons: string[]
}

export function filterMessage(text: string): FilterResult {
  const reasons: string[] = []
  let clean = text

  if (PHONE_RE.test(text)) { reasons.push('numéro de téléphone'); clean = clean.replace(PHONE_RE, '•••••••') }
  if (EMAIL_RE.test(text)) { reasons.push('adresse email'); clean = clean.replace(EMAIL_RE, '•••••••') }
  if (DIGITS_RE.test(clean)) { reasons.push('suite de chiffres'); clean = clean.replace(DIGITS_RE, '•••••••') }

  const lower = text.toLowerCase()
  for (const kw of KEYWORDS) {
    if (lower.includes(kw)) { reasons.push('coordonnées hors plateforme'); break }
  }

  return { clean, blocked: reasons.length > 0, reasons: [...new Set(reasons)] }
}
