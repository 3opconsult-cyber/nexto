import { NextResponse, type NextRequest } from 'next/server'

// Protection temporaire par cle partagee, en attendant un vrai systeme de
// roles (profiles.role a ete retire lors de la reconstruction du schema
// mono-produit). Le cookie posé une fois suffit ensuite.
const ADMIN_KEY = 'ping-sa-2026'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (path.startsWith('/admin')) {
    const url = request.nextUrl
    const keyParam = url.searchParams.get('key')
    const hasCookie = request.cookies.get('ping_admin')?.value === ADMIN_KEY

    if (keyParam === ADMIN_KEY) {
      const res = NextResponse.next()
      res.cookies.set('ping_admin', ADMIN_KEY, { maxAge: 60 * 60 * 24 * 30, httpOnly: true, sameSite: 'lax' })
      return res
    }
    if (!hasCookie) {
      return new NextResponse('Acces refuse', { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
