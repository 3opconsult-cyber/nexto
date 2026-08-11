/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/admin', destination: '/admin.html' },
        { source: '/presentation', destination: '/presentation.html' },
        { source: '/:path((?!_next/|api/|auth/|map$|admin\\.html|app\\.html|presentation\\.html).*)', destination: '/app.html' },
      ],
    }
  },
}
module.exports = nextConfig
