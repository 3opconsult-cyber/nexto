/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path(admin|demo|client|demo-parcours|presentation|parcours-navigable|landing-particulier|landing-pro|planche-de-marque|maquette-inscription-telephone).html',
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
      ],
      // Tout le reste tombe sur le prototype : l'app EST /demo.
      fallback: [
        { source: '/:path*', destination: '/client.html' },
      ],
    }
  },
}
module.exports = nextConfig
