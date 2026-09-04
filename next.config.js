/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path(admin|demo|demo-parcours|presentation|parcours-navigable|landing-particulier|landing-pro|planche-de-marque|maquette-inscription-telephone|client-app).html',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
      {
        source: '/:path(icon-64|icon-192|icon-512|apple-touch-icon|favicon).:ext(png|ico)',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ]
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/map' },
        { source: '/demo', destination: '/app.html' },
        { source: '/nouvelle-app', destination: '/client-app.html' },
        { source: '/admin', destination: '/admin.html' },
        { source: '/presentation', destination: '/presentation.html' },
        { source: '/parcours-navigable', destination: '/parcours-navigable.html' },
        { source: '/demo-parcours', destination: '/demo-parcours.html' },
        { source: '/landing-particulier', destination: '/landing-particulier.html' },
        { source: '/landing-pro', destination: '/landing-pro.html' },
        { source: '/planche-de-marque', destination: '/planche-de-marque.html' },
        { source: '/maquette-inscription-telephone', destination: '/maquette-inscription-telephone.html' },
        // Pages reelles pas encore compatibles — neutralisees vers la demo.
        { source: '/hub', destination: '/app.html' },
        { source: '/mission/:id/litige', destination: '/app.html' },
        // /mission/:id/facture N'EST PLUS neutralisee : la page a ete reecrite sur
        // le schema reel (elle interrogeait des tables inexistantes), elle affiche
        // les trois documents et genere le PDF. La laisser ici la renvoyait vers
        // la demo — donc tout le travail de facturation aurait ete invisible.
        // /documents : vraie page, elle passe par le routeur, pas par le fallback.
        // /client/profil : reecrit pour le nouveau schema, reel desormais
        // /pro/dashboard, /mission/:id/chat : reecrites pour le nouveau schema, reelles
        // /mission/new, /mission/:id/qrcodes, /mission/:id/scan/:phase : reelles
      ],
      fallback: [
        { source: '/:path*', destination: '/app.html' },
      ],
    }
  },
}
module.exports = nextConfig
