/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/admin', destination: '/admin.html' },
        { source: '/presentation', destination: '/presentation.html' },
        { source: '/:path((?!_next/|app\\.html|admin\\.html|presentation\\.html).*)', destination: '/app.html' },
      ],
    }
  },
}
module.exports = nextConfig
