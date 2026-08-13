import type { Metadata, Viewport } from 'next'
import { Quicksand, Inter } from 'next/font/google'
import './globals.css'

const quicksand = Quicksand({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-quicksand',
})
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'PING — Et si ce que vous cherchez se trouvait juste à côté de vous ?',
  description: 'Ménage, repassage, nettoyage : trouvez un prestataire disponible près de chez vous, paiement sous séquestre.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PING',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#12B39C',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={`${quicksand.variable} ${inter.variable} font-nunito bg-cream text-navy antialiased`}>
        {children}
      </body>
    </html>
  )
}
