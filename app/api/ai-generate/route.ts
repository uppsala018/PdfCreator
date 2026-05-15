import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateText } from "@/lib/ai"

// ─── POST /api/ai-generate ────────────────────────────────────────────────────
//
// Body:  { prompt: string, context?: string }
// Happy: { text: string, provider: "anthropic" | "openai" }
//
// Key resolution order:
//   1. Per-user key in user_settings table
//   2. Server env var (ANTHROPIC_API_KEY / OPENAI_API_KEY)
//
// Returns 503 if no key is configured so the UI can show
// "Add an API key in Settings" instead of a generic error.

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── Body ─────────────────────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 })
  }

  const { prompt, context } = (body ?? {}) as Record<string, unknown>

  if (typeof prompt !== "string" || prompt.trim() === "") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 })
  }

  // ── Load user API keys (server-side only — never returned to the client) ────
  const { data: settings } = await supabase
    .from("user_settings")
    .select("anthropic_key, openai_key")
    .eq("user_id", user.id)
    .maybeSingle()

  // ── Generate ─────────────────────────────────────────────────────────────────
  try {
    const result = await generateText({
      prompt: prompt.trim(),
      context: typeof context === "string" ? context : undefined,
      userAnthropicKey: settings?.anthropic_key ?? null,
      userOpenaiKey:    settings?.openai_key    ?? null,
    })

    return NextResponse.json({ text: result.text, provider: result.provider })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    // Special sentinel: no key is configured.
    if (message.startsWith("NO_API_KEY:")) {
      return NextResponse.json(
        {
          error: "Add an API key in Settings to use AI generation.",
          code:  "NO_API_KEY",
        },
        { status: 503 }
      )
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
