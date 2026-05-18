import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface RouteContext {
  params: { id: string }
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("ebook_generation_jobs")
    .select("*")
    .eq("id", params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Job not found" }, { status: error?.code === "PGRST116" ? 404 : 500 })
  }

  return NextResponse.json({ job: data })
}
