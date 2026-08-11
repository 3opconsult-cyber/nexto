import { NextResponse, type NextRequest } from 'next/server'

// Protection desactivee temporairement : la table profiles n'a plus de
// colonne "role" depuis la reconstruction du schema mono-produit.
// /admin et /presentation restent des pages de revue libre pour l'instant.
export async function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
