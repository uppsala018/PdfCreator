import { type NextRequest, NextResponse } from "next/server"
import { projectToProfessionalSchema } from "@/lib/export/project-to-schema"
import { normalizeExportTheme } from "@/lib/export/theme-mapping"
import { createClient } from "@/lib/supabase/server"
import type { ProjectRow } from "@/lib/project-schema"

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

  const { projectId, theme } = (body ?? {}) as Record<string, unknown>
  if (typeof projectId !== "string" || projectId.trim() === "") {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 })
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single()

  if (projectError || !project) {
    const status = projectError?.code === "PGRST116" ? 404 : 500
    return NextResponse.json(
      { error: status === 404 ? "Project not found" : (projectError?.message ?? "Failed to load project") },
      { status }
    )
  }

  const exportTheme = normalizeExportTheme(theme, "luxury-black-gold")
  const structuredEbook = projectToProfessionalSchema(project as unknown as ProjectRow, exportTheme)
  const pdfEngineUrl = process.env.PDF_ENGINE_URL ?? "http://localhost:8000"

  let pdfBuffer: ArrayBuffer
  let diagnosticsHeader: string | null = null
  try {
    const engineRes = await fetch(`${pdfEngineUrl}/generate-professional`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ebook: structuredEbook }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!engineRes.ok) {
      let detail = engineRes.statusText
      try {
        const errJson = (await engineRes.json()) as { error?: string }
        if (errJson.error) detail = errJson.error
      } catch {
        // Non-JSON error body.
      }
      return NextResponse.json({ error: `Professional PDF generation failed: ${detail}` }, { status: 502 })
    }

    diagnosticsHeader = engineRes.headers.get("X-Composer-Diagnostics")
    pdfBuffer = await engineRes.arrayBuffer()
    if (pdfBuffer.byteLength === 0) {
      return NextResponse.json({ error: "Professional composer returned an empty file" }, { status: 502 })
    }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError"
    return NextResponse.json(
      {
        error: isTimeout
          ? "Professional PDF generation timed out. Try a smaller document or use standard export."
          : `Could not reach the PDF engine (${pdfEngineUrl}). Make sure the service is running.`,
      },
      { status: 503 }
    )
  }

  const safeFilename = (project.title ?? "ebook")
    .replace(/[^a-z0-9\-_. ]/gi, "_")
    .trim() || "ebook-export"

  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${safeFilename}-professional.pdf"`,
    "Content-Length": String(pdfBuffer.byteLength),
  }
  if (diagnosticsHeader) headers["X-Composer-Diagnostics"] = diagnosticsHeader

  return new NextResponse(pdfBuffer, { status: 200, headers })
}
