/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'wmiawwaxwlvascyflpba.supabase.co' },
    ],
  },
  async rewrites() {
    return [
      { source: '/', destination: '/app.html' },
    ]
  },
}
module.exports = nextConfig
