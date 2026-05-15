import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Keys are stored server-side and NEVER returned in plaintext.
// The GET response only tells the client whether each key is configured.

function maskKey(key: string | null | undefined): string | null {
  if (!key || key.length < 8) return null
  // Show first 7 chars + dots + last 4 chars: "sk-ant-•••••abc123"
  return `${key.slice(0, 7)}••••${key.slice(-4)}`
}

// ─── GET /api/settings ────────────────────────────────────────────────────────

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("anthropic_key, openai_key")
    .eq("user_id", user.id)
    .maybeSingle()

  return NextResponse.json({
    anthropic_configured: Boolean(settings?.anthropic_key),
    openai_configured:    Boolean(settings?.openai_key),
    anthropic_masked:     maskKey(settings?.anthropic_key),
    openai_masked:        maskKey(settings?.openai_key),
  })
}

// ─── PATCH /api/settings ─────────────────────────────────────────────────────
// Body: { anthropic_key?: string, openai_key?: string }
// Empty string means "clear this key".

export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 })
  }

  const { anthropic_key, openai_key } = (body ?? {}) as Record<string, unknown>

  const patch: {
    user_id: string
    anthropic_key?: string | null
    openai_key?: string | null
  } = { user_id: user.id }

  if (typeof anthropic_key === "string") {
    patch.anthropic_key = anthropic_key.trim() || null
  }
  if (typeof openai_key === "string") {
    patch.openai_key = openai_key.trim() || null
  }

  // Upsert so the row is created on first save.
  const { error: upsertError } = await supabase
    .from("user_settings")
    .upsert(patch, { onConflict: "user_id" })

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  // Return the same shape as GET so the UI can update in one round-trip.
  const { data: fresh } = await supabase
    .from("user_settings")
    .select("anthropic_key, openai_key")
    .eq("user_id", user.id)
    .maybeSingle()

  return NextResponse.json({
    anthropic_configured: Boolean(fresh?.anthropic_key),
    openai_configured:    Boolean(fresh?.openai_key),
    anthropic_masked:     maskKey(fresh?.anthropic_key),
    openai_masked:        maskKey(fresh?.openai_key),
  })
}
