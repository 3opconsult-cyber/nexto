/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path(admin|demo|client|demo-parcours|presentation|parcours-navigable|landing-particulier|landing-pro|planche-de-marque|maquette-inscription-telephone|plaquettes|animation|animation-pro|animation-inscription|animation-ping|animation-client|animation-prestataire|animation-tuto|animation-tuto-absent|bienvenue|plan-marketing).html',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
      {
        source: '/:path(icon-64|icon-192|icon-512|apple-touch-icon|favicon).:ext(png|ico)',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ]
  },
  async redirects() {
    return [
      // '/' pointait vers le fallback statique client.html "tant que la home React
      // n'etait pas portee" (commentaire historique) : /map EST la vraie app depuis
      // longtemps, mais la racine du site continuait a servir la maquette figee,
      // avec sa propre navigation limitee (elle ne bouge jamais l'URL, ce qui la
      // fait passer pour un bug de la vraie app). Direction sans ambiguite vers /map.
      { source: '/', destination: '/map', permanent: false },
      // L'ancienne vidéo enchaînait client puis prestataire : chaque rôle a désormais sa vidéo.
      { source: '/animation-ping', has: [{ type: 'query', key: 'role', value: 'pro' }], destination: '/animation-prestataire?role=pro', permanent: false },
      { source: '/animation-ping', destination: '/animation-client', permanent: false },
    ]
  },
  async rewrites() {
    return {
      beforeFiles: [
        // Fichiers de reference intacts (presentation, admin, marketing).
        { source: '/demo', destination: '/app.html' },
        { source: '/admin', destination: '/admin.html' },
        { source: '/presentation', destination: '/presentation.html' },
        { source: '/parcours-navigable', destination: '/parcours-navigable.html' },
        { source: '/demo-parcours', destination: '/demo-parcours.html' },
        { source: '/landing-particulier', destination: '/landing-particulier.html' },
        { source: '/landing-pro', destination: '/landing-pro.html' },
        { source: '/planche-de-marque', destination: '/planche-de-marque.html' },
        { source: '/maquette-inscription-telephone', destination: '/maquette-inscription-telephone.html' },
        { source: '/plaquettes', destination: '/plaquettes.html' },
        { source: '/animation', destination: '/animation.html' },
        { source: '/animation-pro', destination: '/animation-pro.html' },
        { source: '/animation-inscription', destination: '/animation-inscription.html' },
        { source: '/animation-ping', destination: '/animation-ping.html' },
        { source: '/animation-client', destination: '/animation-client.html' },
        { source: '/animation-prestataire', destination: '/animation-prestataire.html' },
        { source: '/animation-tuto', destination: '/animation-tuto.html' },
        { source: '/animation-tuto-absent', destination: '/animation-tuto-absent.html' },
        { source: '/bienvenue', destination: '/bienvenue.html' },
        { source: '/plan-marketing', destination: '/plan-marketing.html' },
      ],
      // Tout le reste tombe sur le prototype : l'app EST /demo.
      fallback: [
        { source: '/:path*', destination: '/client.html' },
      ],
    }
  },
}
module.exports = nextConfig
