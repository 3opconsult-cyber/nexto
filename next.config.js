/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/admin', destination: '/admin.html' },
        { source: '/presentation', destination: '/presentation.html' },
        { source: '/:path((?!_next/|api/|auth/|admin\\.html|app\\.html|presentation\\.html).*)', destination: '/app.html' },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
}
module.exports = nextConfig
