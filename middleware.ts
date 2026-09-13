import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that don't require a signed-in user
const PUBLIC_PATHS = ['/', '/login', '/signup']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // API routes (payment init, Paystack webhook) are never gated here —
  // the webhook in particular is called server-to-server by Paystack with
  // no user session at all, so redirecting it would silently break payments.
  const isApiRoute = pathname.startsWith('/api/')

  const isPublicPath = PUBLIC_PATHS.includes(pathname)

  if (!isApiRoute && !user && !isPublicPath) {
    // Not logged in and trying to reach a real page — bounce to login,
    // remembering where they were headed so we can return them there after.
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (!isApiRoute && user && (pathname === '/login' || pathname === '/signup')) {
    // Already logged in — no reason to see the auth screens again
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
