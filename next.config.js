/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/:path((?!_next/|app\\.html).*)',
          destination: '/app.html',
        },
      ],
    }
  },
}
module.exports = nextConfig
