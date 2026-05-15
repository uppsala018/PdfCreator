import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "./database.types"

/**
 * Server-side Supabase client that reads/writes auth cookies.
 * Use in Server Components and API Route Handlers for operations
 * that should run inside the authenticated user's RLS context.
 */
export function createClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // In Server Components cookies cannot be mutated — the middleware
            // refresh keeps the session alive, so this is safe to swallow.
          }
        },
      },
    }
  )
}

/**
 * Service-role Supabase client.
 * Bypasses RLS — only for API Route Handlers that have already verified the
 * caller's identity (e.g. uploading to Storage on behalf of the user).
 * Never use in Server Components or pass to the client.
 */
export function createServiceClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // intentional — same rationale as above
          }
        },
      },
    }
  )
}
