import type { Metadata, Viewport } from 'next'
import { Quicksand, Inter } from 'next/font/google'
import './globals.css'
import './ping-ui.css'
import './ping-legacy.css'
import DesktopShell from '@/components/DesktopShell'
import ChunkReload from '@/components/ChunkReload'
import PageViewTracker from '@/components/PageViewTracker'
import FeedbackBubble from '@/components/FeedbackBubble'
import InstallPrompt from '@/components/InstallPrompt'
import AuthGate from '@/components/AuthGate'
import TabPrefetch from '@/components/TabPrefetch'
import OfflineSync from '@/components/OfflineSync'

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
  description: 'Ménage, repassage, nettoyage : trouvez un prestataire disponible près de chez vous.',
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
  // Pas de maximumScale : le zoom de la page reste possible (accessibilité, lot 31). Sur les cartes,
  // le pincement reste à Leaflet (leaflet.css pose touch-action: none sur le conteneur de la carte).
  themeColor: '#12B39C',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        {/* Familles littérales 'Quicksand' / 'Inter' utilisées par ping-ui.css et les styles en ligne
            (next/font les expose sous un nom interne, et l'@import de ping-ui.css est retiré au build). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Quicksand:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body className={`${quicksand.variable} ${inter.variable} font-nunito bg-cream text-navy antialiased`} style={{ background: '#E7EDEB' }}>
        <PageViewTracker />
        <ChunkReload />
        <DesktopShell>
          {children}
        </DesktopShell>
        <FeedbackBubble />
        <InstallPrompt />
        <AuthGate />
        <TabPrefetch />
        <OfflineSync />
      </body>
    </html>
  )
}
