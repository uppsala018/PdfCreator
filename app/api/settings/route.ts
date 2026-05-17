import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { publicProviderStatus, type UserAISettings } from "@/lib/ai-runtime/provider-resolution"

// Keys are stored server-side and NEVER returned in plaintext.
// The GET response only tells the client whether each key is configured.

function maskKey(key: string | null | undefined): string | null {
  if (!key || key.length < 8) return null
  // Show first 7 chars + dots + last 4 chars: "sk-ant-•••••abc123"
  return `${key.slice(0, 7)}••••${key.slice(-4)}`
}

const SETTINGS_COLUMNS = [
  "ai_provider",
  "anthropic_key",
  "anthropic_model",
  "openai_key",
  "openai_model",
  "openrouter_key",
  "openrouter_model",
  "gemini_key",
  "gemini_model",
  "mistral_key",
  "mistral_model",
  "custom_provider_name",
  "custom_api_key",
  "custom_base_url",
  "custom_model",
  "custom_compatibility",
].join(", ")

function settingsResponse(settings: UserAISettings | null | undefined) {
  return {
    ai_provider: settings?.ai_provider ?? null,
    anthropic_configured: Boolean(settings?.anthropic_key),
    openai_configured: Boolean(settings?.openai_key),
    openrouter_configured: Boolean(settings?.openrouter_key),
    gemini_configured: Boolean(settings?.gemini_key),
    mistral_configured: Boolean(settings?.mistral_key),
    custom_configured: Boolean(settings?.custom_api_key),
    anthropic_masked: maskKey(settings?.anthropic_key),
    openai_masked: maskKey(settings?.openai_key),
    openrouter_masked: maskKey(settings?.openrouter_key),
    gemini_masked: maskKey(settings?.gemini_key),
    mistral_masked: maskKey(settings?.mistral_key),
    custom_masked: maskKey(settings?.custom_api_key),
    anthropic_model: settings?.anthropic_model ?? "",
    openai_model: settings?.openai_model ?? "",
    openrouter_model: settings?.openrouter_model ?? "",
    gemini_model: settings?.gemini_model ?? "",
    mistral_model: settings?.mistral_model ?? "",
    custom_provider_name: settings?.custom_provider_name ?? "",
    custom_base_url: settings?.custom_base_url ?? "",
    custom_model: settings?.custom_model ?? "",
    custom_compatibility: settings?.custom_compatibility ?? "openai-compatible",
    providerStatus: publicProviderStatus(settings),
  }
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
    .select(SETTINGS_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle()

  return NextResponse.json(settingsResponse(settings as UserAISettings | null))
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

  const data = (body ?? {}) as Record<string, unknown>

  const patch: {
    user_id: string
    anthropic_key?: string | null
    openai_key?: string | null
    ai_provider?: string | null
    anthropic_model?: string | null
    openai_model?: string | null
    openrouter_key?: string | null
    openrouter_model?: string | null
    gemini_key?: string | null
    gemini_model?: string | null
    mistral_key?: string | null
    mistral_model?: string | null
    custom_provider_name?: string | null
    custom_api_key?: string | null
    custom_base_url?: string | null
    custom_model?: string | null
    custom_compatibility?: string | null
  } = { user_id: user.id }

  assignString(patch, data, "ai_provider")
  assignString(patch, data, "anthropic_key")
  assignString(patch, data, "anthropic_model")
  assignString(patch, data, "openai_key")
  assignString(patch, data, "openai_model")
  assignString(patch, data, "openrouter_key")
  assignString(patch, data, "openrouter_model")
  assignString(patch, data, "gemini_key")
  assignString(patch, data, "gemini_model")
  assignString(patch, data, "mistral_key")
  assignString(patch, data, "mistral_model")
  assignString(patch, data, "custom_provider_name")
  assignString(patch, data, "custom_api_key")
  assignString(patch, data, "custom_base_url")
  assignString(patch, data, "custom_model")
  assignString(patch, data, "custom_compatibility")

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
    .select(SETTINGS_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle()

  return NextResponse.json(settingsResponse(fresh as UserAISettings | null))
}

function assignString(
  patch: Record<string, string | null>,
  data: Record<string, unknown>,
  key: string
) {
  if (typeof data[key] === "string") {
    patch[key] = data[key].trim() || null
  }
}
