/** @type {import('next').NextConfig} */
const nextConfig = {
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
        { source: '/client/:path*', destination: '/app.html' },
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
