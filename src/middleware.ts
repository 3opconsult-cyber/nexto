import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// La vraie protection est un vrai compte avec is_admin=true.
// Cle de secours optionnelle : variable d'environnement ADMIN_FALLBACK_KEY (Vercel, production), jamais ecrite
// dans le code. Sans cette variable, le secours est desactive.
const FALLBACK_KEY = process.env.ADMIN_FALLBACK_KEY || ''

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (!path.startsWith('/admin')) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // @supabase/ssr 0.3 : get / set / remove (getAll / setAll serait ignoré en silence).
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request })
          response.cookies.set({ name, value: '', ...options })
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
  const hasCookie = !!FALLBACK_KEY && request.cookies.get('ping_admin')?.value === FALLBACK_KEY
  if (FALLBACK_KEY && keyParam === FALLBACK_KEY) {
    response.cookies.set('ping_admin', FALLBACK_KEY, { maxAge: 60 * 60 * 24 * 30, httpOnly: true, sameSite: 'lax' })
    return response
  }
  if (hasCookie) return response

  return new NextResponse('Accès refusé — connectez-vous avec le compte administrateur', { status: 401 })
}

export const config = {
  matcher: ['/admin/:path*', '/admin'],
}
