import type { Metadata } from 'next'
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
  themeColor: '#12B39C',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
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
