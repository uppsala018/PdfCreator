import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// ─── GET /api/projects — list the current user's projects ────────────────────

export async function GET() {
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
    .select("id, title, author, theme, template, content, updated_at")
    .order("updated_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ projects: data })
}

// ─── POST /api/projects — create a new project ───────────────────────────────

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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { title, author, theme } = body as Record<string, unknown>

  if (typeof title !== "string" || title.trim() === "") {
    return NextResponse.json({ error: "title is required" }, { status: 400 })
  }

  const validThemes = ["dark-cinematic", "clean-minimal"]
  const resolvedTheme =
    typeof theme === "string" && validThemes.includes(theme)
      ? theme
      : "dark-cinematic"

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      title: title.trim(),
      author:
        typeof author === "string" && author.trim() !== ""
          ? author.trim()
          : null,
      theme: resolvedTheme,
      template: "ebook-prompt-collection",
      content: { projectType: "ebook", chapters: [] },
    })
    .select("id, title, author, theme, template, updated_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ project: data }, { status: 201 })
}
