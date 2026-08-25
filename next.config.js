/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path(admin|demo|presentation|parcours-navigable).html',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ]
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/map' },
        { source: '/demo', destination: '/app.html' },
        { source: '/admin', destination: '/admin.html' },
        { source: '/presentation', destination: '/presentation.html' },
        { source: '/parcours-navigable', destination: '/parcours-navigable.html' },
        // Pages reelles pas encore compatibles — neutralisees vers la demo.
        { source: '/hub', destination: '/app.html' },
        { source: '/mission/:id/facture', destination: '/app.html' },
        { source: '/mission/:id/litige', destination: '/app.html' },
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
