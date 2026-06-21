import type { Metadata } from 'next'
import { Nunito } from 'next/font/google'
import './globals.css'

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-nunito',
})

export const metadata: Metadata = {
  title: 'Nexto — Et si ce que vous cherchez se trouvait juste à côté ?',
  description: 'Marketplace géolocalisée de services de proximité. Plombier, ménage, baby-sitter, jardinage, manutention.',
  manifest: '/manifest.json',
  themeColor: '#7C5CFC',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${nunito.variable} font-nunito bg-cream text-navy antialiased`}>
        {children}
      </body>
    </html>
  )
}
