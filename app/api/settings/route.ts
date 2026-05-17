import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  buildUserAISettingsPatch,
  publicAISettingsResponse,
  USER_AI_SETTINGS_COLUMNS,
} from "@/lib/ai-runtime/provider-settings"

// Keys are stored server-side and NEVER returned in plaintext.
// Responses only include configured booleans, masked user keys, and provider status.

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
    .select(USER_AI_SETTINGS_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle()

  return NextResponse.json(publicAISettingsResponse(settings))
}

// ─── PATCH /api/settings ─────────────────────────────────────────────────────
// Body: provider settings. Empty key string means "clear this key".
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

  const patch = buildUserAISettingsPatch(user.id, body)

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
    .select(USER_AI_SETTINGS_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle()

  return NextResponse.json(publicAISettingsResponse(fresh))
}
