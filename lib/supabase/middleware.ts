import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"
import type { Database } from "./database.types"

/**
 * Called from the root middleware.ts on every request.
 *
 * Responsibilities:
 *   1. Refresh the Supabase session cookie so it never silently expires.
 *   2. Return the authenticated user (or null) so the middleware can gate routes.
 *   3. Return the NextResponse with updated Set-Cookie headers attached.
 *
 * The caller must return `supabaseResponse` (not a new NextResponse) to preserve
 * the cookie writes — otherwise the session refresh is lost.
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse
  user: { id: string; email?: string } | null
}> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write into both the request (so server components see fresh cookies)
          // and the response (so the browser receives Set-Cookie headers).
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() is the only safe way to confirm a session server-side.
  // getSession() must not be used here — it trusts the cookie value without
  // re-validating with the Supabase Auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}
