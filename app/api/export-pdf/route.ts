import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// ─── POST /api/export-pdf ─────────────────────────────────────────────────────
//
// Body:  { projectId: string }
// Happy: PDF binary streamed directly to the browser as a file download.
//
// Steps:
//  1. Verify session
//  2. Parse + validate body
//  3. Fetch project — RLS confirms ownership automatically
//  4. Construct payload for the PDF engine
//  5. Call Railway PDF engine
//  6. Return the PDF binary directly with download headers
//     (no Supabase Storage, no exports table, no signed URLs)

export async function POST(request: NextRequest) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── 2. Body ───────────────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 })
  }

  const { projectId } = (body ?? {}) as Record<string, unknown>

  if (typeof projectId !== "string" || projectId.trim() === "") {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 })
  }

  // ── 3. Fetch project (RLS verifies the caller owns it) ────────────────────
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single()

  if (projectError || !project) {
    const status = projectError?.code === "PGRST116" ? 404 : 500
    return NextResponse.json(
      {
        error:
          status === 404
            ? "Project not found"
            : (projectError?.message ?? "Failed to load project"),
      },
      { status }
    )
  }

  // ── 4. Assemble the PDF engine payload ────────────────────────────────────
  const rawContent = project.content as { chapters?: unknown[] } | null
  const chapters   = Array.isArray(rawContent?.chapters) ? rawContent.chapters : []

  const pdfPayload = {
    project: {
      title:    project.title,
      subtitle: project.subtitle ?? "",
      author:   project.author   ?? "",
      website:  project.website  ?? "",
      theme:    project.theme,
      template: project.template,
      chapters,
    },
    template: project.theme,
  }

  // ── 5. Call the Railway PDF engine ───────────────────────────────────────
  const pdfEngineUrl = process.env.PDF_ENGINE_URL ?? "http://localhost:8000"

  let pdfBuffer: ArrayBuffer
  try {
    const engineRes = await fetch(`${pdfEngineUrl}/generate`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(pdfPayload),
      signal:  AbortSignal.timeout(120_000),
    })

    if (!engineRes.ok) {
      let detail = engineRes.statusText
      try {
        const errJson = (await engineRes.json()) as { error?: string }
        if (errJson.error) detail = errJson.error
      } catch { /* body was not JSON */ }
      return NextResponse.json(
        { error: `PDF generation failed: ${detail}` },
        { status: 502 }
      )
    }

    pdfBuffer = await engineRes.arrayBuffer()

    if (pdfBuffer.byteLength === 0) {
      return NextResponse.json(
        { error: "PDF engine returned an empty file" },
        { status: 502 }
      )
    }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError"
    return NextResponse.json(
      {
        error: isTimeout
          ? "PDF generation timed out — the document may be too large. Try splitting it into smaller chapters."
          : `Could not reach the PDF engine (${pdfEngineUrl}). Make sure the service is running.`,
      },
      { status: 503 }
    )
  }

  // ── 6. Return the PDF binary directly — browser downloads it immediately ──
  const safeFilename = (project.title ?? "ebook")
    .replace(/[^a-z0-9\-_. ]/gi, "_")
    .trim() || "ebook-export"

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilename}.pdf"`,
      "Content-Length":      String(pdfBuffer.byteLength),
    },
  })
}
