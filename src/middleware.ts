import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Cle partagee conservee en secours (pendant la periode de transition),
// mais la vraie protection est desormais un vrai compte avec is_admin=true.
const FALLBACK_KEY = 'ping-sa-2026'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (!path.startsWith('/admin')) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.is_admin) return response
  }

  // Secours transitoire : cle partagee (a retirer une fois le compte admin confirme actif)
  const keyParam = request.nextUrl.searchParams.get('key')
  const hasCookie = request.cookies.get('ping_admin')?.value === FALLBACK_KEY
  if (keyParam === FALLBACK_KEY) {
    response.cookies.set('ping_admin', FALLBACK_KEY, { maxAge: 60 * 60 * 24 * 30, httpOnly: true, sameSite: 'lax' })
    return response
  }
  if (hasCookie) return response

  return new NextResponse('Accès refusé — connectez-vous avec le compte administrateur', { status: 401 })
}

export const config = {
  matcher: ['/admin/:path*', '/admin'],
}
