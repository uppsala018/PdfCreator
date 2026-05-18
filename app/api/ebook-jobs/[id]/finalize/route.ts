import { type NextRequest, NextResponse } from "next/server"
import { projectContentFromJob, type EbookJobState } from "@/lib/ai-ebook/ebook-job-runner"
import type { ProfessionalEbookPlan } from "@/lib/ai-ebook/generation-plan"
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

  if (job.status !== "ready" && job.status !== "finalized") {
    return NextResponse.json({ error: "Job is not ready to finalize." }, { status: 409 })
  }

  const plan = job.settings as unknown as ProfessionalEbookPlan
  const state: EbookJobState = {
    plan,
    outline: job.outline as unknown as EbookJobState["outline"],
    chapters: Array.isArray(job.chapters) ? job.chapters as unknown as EbookJobState["chapters"] : [],
    diagnostics: Array.isArray(job.diagnostics) ? job.diagnostics as unknown as EbookJobState["diagnostics"] : [],
    currentChapterIndex: job.current_chapter_index,
  }
  const content = projectContentFromJob(state)
  const title = state.outline?.title ?? plan.topic
  const subtitle = state.outline?.subtitle ?? null
  const theme = plan.theme === "clean-minimal" ? "clean-minimal" : "dark-cinematic"

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      title,
      subtitle,
      author: state.outline?.author ?? null,
      theme,
      template: plan.format,
      content: content as unknown as Json,
    })
    .select("id, title, author, theme, template, updated_at")
    .single()

  if (projectError || !project) {
    return NextResponse.json({ error: projectError?.message ?? "Project creation failed" }, { status: 500 })
  }

  await supabase
    .from("ebook_generation_jobs")
    .update({ status: "finalized", result_project_id: project.id })
    .eq("id", params.id)

  return NextResponse.json({ project })
}
