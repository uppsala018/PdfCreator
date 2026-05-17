import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  buildUserAISettingsPatch,
  normalizeUserAISettings,
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

  const { data: settings, error: settingsError } = await supabase
    .from("user_settings")
    .select(USER_AI_SETTINGS_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle()

  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 500 })
  }

  const response = publicAISettingsResponse(settings)
  console.info("[settings:get]", response.providerStatus.debug)
  return NextResponse.json(response)
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
  const patchSettings = normalizeUserAISettings(patch)

  // Upsert so the row is created on first save.
  const { error: upsertError } = await supabase
    .from("user_settings")
    .upsert(patch, { onConflict: "user_id" })

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  // Return the same shape as GET so the UI can update in one round-trip.
  const { data: fresh, error: freshError } = await supabase
    .from("user_settings")
    .select(USER_AI_SETTINGS_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle()

  if (freshError) {
    return NextResponse.json({ error: freshError.message }, { status: 500 })
  }

  const response = publicAISettingsResponse(fresh)
  console.info("[settings:patch]", {
    selectedProvider: patchSettings.ai_provider ?? response.providerStatus.debug.selectedProvider,
    selectedModel: patchSettings.openrouter_model ?? response.providerStatus.debug.selectedModel,
    hasUserOpenRouterKey: Boolean(patchSettings.openrouter_key) || response.providerStatus.debug.hasUserOpenRouterKey,
    hasEnvOpenRouterKey: response.providerStatus.debug.hasEnvOpenRouterKey,
    finalResolvedProvider: response.providerStatus.debug.finalResolvedProvider,
    finalResolvedModel: response.providerStatus.debug.finalResolvedModel,
    keySource: response.providerStatus.debug.keySource,
  })
  return NextResponse.json(response)
}
