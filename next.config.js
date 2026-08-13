/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/map' },
        { source: '/demo', destination: '/app.html' },
        { source: '/admin', destination: '/admin.html' },
        { source: '/presentation', destination: '/presentation.html' },
        // Pages reelles pas encore compatibles — neutralisees vers la demo.
        { source: '/hub', destination: '/app.html' },
        { source: '/pro/dashboard', destination: '/app.html' },
        { source: '/mission/:path*', destination: '/app.html' },
        { source: '/client/:path*', destination: '/app.html' },
      ],
      fallback: [
        { source: '/:path*', destination: '/app.html' },
      ],
    }
  },
}
module.exports = nextConfig
