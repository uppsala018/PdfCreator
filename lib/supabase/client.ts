import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "./database.types"

/**
 * Returns a Supabase client for use in Client Components.
 * Call once per component — the underlying client is not a singleton so that
 * each component tree gets a fresh auth context when the session changes.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
