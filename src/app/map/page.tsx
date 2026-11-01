"use client"
import { useEffect } from 'react'
import DemoShell from '@/components/DemoShell'
import { flushReferral } from '@/lib/referral'

export const dynamic = 'force-dynamic'

export default function MapPage() {
  // Parrainage en attente (e-mail confirmé après l'inscription) : enregistré à la première visite.
  useEffect(() => { flushReferral() }, [])
  return <DemoShell initialView="v_map" />
}
