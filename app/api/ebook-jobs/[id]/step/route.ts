import { type NextRequest, NextResponse } from "next/server"
import { runNextEbookJobStep, type EbookJobState } from "@/lib/ai-ebook/ebook-job-runner"
import type { ProfessionalEbookPlan } from "@/lib/ai-ebook/generation-plan"
import { normalizeUserAISettings, USER_AI_SETTINGS_COLUMNS } from "@/lib/ai-runtime/provider-settings"
import { resolveAIProvider } from "@/lib/ai-runtime/provider-resolution"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/supabase/database.types"

interface RouteContext {
  params: { id: string }
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: job, error: jobError } = await supabase
    .from("ebook_generation_jobs")
    .select("*")
    .eq("id", params.id)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: jobError?.message ?? "Job not found" }, { status: jobError?.code === "PGRST116" ? 404 : 500 })
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select(USER_AI_SETTINGS_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle()

  const plan = job.settings as unknown as ProfessionalEbookPlan
  const userSettings = normalizeUserAISettings(settings)
  const primary = resolveAIProvider({
    userSettings,
    preferredProviderId: plan.providerId,
    model: plan.model,
  })
  const gemini = primary.status.activeProvider === "gemini"
    ? null
    : resolveAIProvider({ userSettings, preferredProviderId: "gemini" })

  const state: EbookJobState = {
    plan,
    outline: job.outline as unknown as EbookJobState["outline"],
    chapters: Array.isArray(job.chapters) ? job.chapters as unknown as EbookJobState["chapters"] : [],
    diagnostics: Array.isArray(job.diagnostics) ? job.diagnostics as unknown as EbookJobState["diagnostics"] : [],
    currentChapterIndex: job.current_chapter_index,
  }

  try {
    let result = await runNextEbookJobStep({
      state,
      provider: primary.provider,
      model: plan.model,
    })

    if (shouldRetryWithGemini(result.diagnostics) && gemini?.status.activeProvider === "gemini") {
      result = await runNextEbookJobStep({
        state,
        provider: gemini.provider,
      })
    }

    const { data: updated, error: updateError } = await supabase
      .from("ebook_generation_jobs")
      .update({
        status: result.status,
        outline: result.outline as unknown as Json,
        chapters: result.chapters as unknown as Json,
        diagnostics: result.diagnostics as unknown as Json,
        current_chapter_index: result.currentChapterIndex,
        error: null,
      })
      .eq("id", params.id)
      .select("*")
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ job: updated, completed: result.completed })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ebook job step failed"
    await supabase
      .from("ebook_generation_jobs")
      .update({ status: "failed", error: message })
      .eq("id", params.id)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function shouldRetryWithGemini(diagnostics: EbookJobState["diagnostics"]) {
  return diagnostics.some((diagnostic) =>
    diagnostic.code === "OUTLINE_FALLBACK_USED" ||
    diagnostic.code === "CHAPTER_FALLBACK_USED" ||
    diagnostic.code === "MALFORMED_OUTLINE_JSON" ||
    diagnostic.code === "MALFORMED_CHAPTER_JSON"
  )
}
