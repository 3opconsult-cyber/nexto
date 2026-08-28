/**
 * PING — les deux pièces de l'identité, en un seul endroit.
 *
 * Elles étaient jusqu'ici redessinées à la main dans chaque écran (ou remplacées
 * par le mot « PING » en texte brut), ce qui les faisait diverger. Tout écran qui
 * doit montrer la marque importe désormais d'ici.
 *
 * Le SIGNE (anneaux + point) dit l'action : c'est le geste du bouton qui scanne
 * la carte. Il vit dans le carré — icônes, barre d'onglets, écrans d'attente.
 *
 * Le LOGOTYPE (PIN·G) dit la promesse : le i devient l'épingle plantée sur la
 * carte et son trou est le point vert. Il vit partout où le nom s'écrit.
 *
 * Les deux ne s'empilent jamais l'un sur l'autre dans un même bloc.
 * Référence complète : brand/README.md
 */

export const PING_INK = '#123644'
export const PING_TEAL = '#12B39C'
export const PING_GREEN = '#2FD06E'

/** Le signe seul. `pulse` anime l'anneau extérieur (accueil, attente, scan). */
export function Sign({
  size = 32,
  ring = PING_TEAL,
  dot = PING_GREEN,
  pulse = false,
}: { size?: number; ring?: string; dot?: string; pulse?: boolean }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0 }}>
      {pulse && (
        <>
          <style>{`@keyframes pingSignPulse{0%{transform:scale(.75);opacity:.9}70%,100%{transform:scale(1.7);opacity:0}}`}</style>
          <span style={{
            position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${ring}`,
            animation: 'pingSignPulse 2.6s cubic-bezier(0.2,0.6,0.4,1) infinite',
          }} />
        </>
      )}
      <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block' }} aria-hidden="true">
        <circle cx="32" cy="32" r="30" fill="none" stroke={ring} strokeWidth="2" opacity=".26" />
        <circle cx="32" cy="32" r="19.8" fill="none" stroke={ring} strokeWidth="2.9" opacity=".55" />
        <circle cx="32" cy="32" r="7.7" fill={dot} />
      </svg>
    </span>
  )
}

/**
 * Le logotype PIN·G. `size` est la taille de la police en px ; l'épingle se cale
 * dessus. Rendu accessible : le mot lu par un lecteur d'écran reste « PING ».
 */
export function Wordmark({
  size = 17,
  color = PING_INK,
  dot = PING_GREEN,
}: { size?: number; color?: string; dot?: string }) {
  return (
    <span
      role="img"
      aria-label="PING"
      style={{
        fontFamily: 'var(--font-quicksand), Quicksand, sans-serif', fontWeight: 700, fontSize: size,
        letterSpacing: '-.02em', color, lineHeight: 1, whiteSpace: 'nowrap',
        display: 'inline-flex', alignItems: 'baseline',
      }}
    >
      <span aria-hidden="true">p</span>
      <svg
        viewBox="71 35 38 65" aria-hidden="true"
        style={{ height: '.855em', width: '.5em', transform: 'translateY(.03em)' }}
      >
        <path d="M90 100 C84 84, 71 70, 71 54 a19 19 0 1 1 38 0 c0 16 -13 30 -19 46z" fill="currentColor" />
        <circle cx="90" cy="53" r="8.6" fill={dot} />
      </svg>
      <span aria-hidden="true">ng</span>
    </span>
  )
}
