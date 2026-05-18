import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createProfessionalEbookPlan } from "@/lib/ai-ebook/generation-plan"
import type { Json } from "@/lib/supabase/database.types"

export async function POST(request: NextRequest) {
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

  const plan = createProfessionalEbookPlan(typeof body === "object" && body !== null ? body : {})
  const { data, error } = await supabase
    .from("ebook_generation_jobs")
    .insert({
      user_id: user.id,
      status: "planning",
      topic: plan.topic,
      settings: plan as unknown as Json,
      chapters: [],
      diagnostics: [],
      current_chapter_index: 0,
    })
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ job: data, plan }, { status: 201 })
}
