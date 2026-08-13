"use client"
import { useMemo } from 'react'
// @ts-ignore -- pas de types officiels, API minimale utilisee ci-dessous
import qrcodegen from 'qrcode-generator'

// Genere le QR entierement cote client : les tokens d'arrivee/sortie ne
// quittent jamais le navigateur (avant, ils etaient envoyes en clair a un
// service tiers, api.qrserver.com, pour le rendu de l'image).
export default function QrCode({ data, size = 200, fg = '#123644' }: { data: string; size?: number; fg?: string }) {
  const cells = useMemo(() => {
    const qr = qrcodegen(0, 'M')
    qr.addData(data)
    qr.make()
    return qr
  }, [data])

  const count = cells.getModuleCount()
  const cell = size / count

  let path = ''
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (cells.isDark(r, c)) {
        path += `M${c * cell},${r * cell}h${cell}v${cell}h-${cell}z`
      }
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="QR code">
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill={fg} />
    </svg>
  )
}
