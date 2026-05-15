import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/supabase/database.types"

interface RouteContext {
  params: { id: string }
}

// ─── GET /api/projects/[id] — fetch a single project (used by the editor) ───

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
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .single()

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500
    const message = status === 404 ? "Project not found" : error.message
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ project: data })
}

// ─── PATCH /api/projects/[id] — update title / author / theme / content ─────

export async function PATCH(request: NextRequest, { params }: RouteContext) {
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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // Parse each allowed field explicitly so the patch object is fully typed.
  // user_id is never accepted from the request — it cannot be changed.
  const b = body as Record<string, unknown>

  const patch: {
    title?: string
    subtitle?: string | null
    author?: string | null
    website?: string | null
    theme?: string
    content?: Json
  } = {}

  if ("title" in b && typeof b.title === "string") patch.title = b.title
  if ("subtitle" in b)
    patch.subtitle = typeof b.subtitle === "string" ? b.subtitle : null
  if ("author" in b)
    patch.author = typeof b.author === "string" ? b.author : null
  if ("website" in b)
    patch.website = typeof b.website === "string" ? b.website : null
  if ("theme" in b && typeof b.theme === "string") patch.theme = b.theme
  if ("content" in b) patch.content = b.content as Json

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  // updated_at is handled by the DB trigger.
  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", params.id)
    .select("id, title, author, theme, template, updated_at")
    .single()

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  return NextResponse.json({ project: data })
}

// ─── DELETE /api/projects/[id] — delete a project ────────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
