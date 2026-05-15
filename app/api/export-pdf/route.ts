import { type NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

const BUCKET = "exports"
const SIGNED_URL_TTL = 60 * 60 // 1 hour

// ─── POST /api/export-pdf ─────────────────────────────────────────────────────
//
// Body:  { projectId: string }
// Happy: { url: string, filePath: string }
//
// Steps:
//  1. Verify session
//  2. Parse + validate body
//  3. Fetch project — RLS confirms ownership automatically
//  4. Construct full project payload for the PDF engine
//  5. POST to Docker PDF engine
//  6. Upload PDF binary to Supabase Storage
//  7. Save export record to the exports table
//  8. Return signed download URL (TTL = 1 h)

export async function POST(request: NextRequest) {
  // ── 1. Auth ─────────────────────────────────────────────────────────────────
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── 2. Body ──────────────────────────────────────────────────────────────────
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

  // ── 3. Fetch project (RLS verifies the caller owns it) ──────────────────────
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

  // ── 4. Assemble the payload for the PDF engine ───────────────────────────────
  // The DB stores chapters inside the `content` JSONB column; the top-level
  // project fields live as first-class columns in the projects table.
  const rawContent = project.content as { chapters?: unknown[] } | null
  const chapters = Array.isArray(rawContent?.chapters) ? rawContent.chapters : []

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

  // ── 5. Call the PDF engine ───────────────────────────────────────────────────
  const pdfEngineUrl = process.env.PDF_ENGINE_URL ?? "http://localhost:8000"

  let pdfBuffer: ArrayBuffer
  try {
    const engineRes = await fetch(`${pdfEngineUrl}/generate`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(pdfPayload),
      // Generous timeout — a large document with many chapters takes a few seconds.
      signal: AbortSignal.timeout(120_000),
    })

    if (!engineRes.ok) {
      let detail = engineRes.statusText
      try {
        const errJson = await engineRes.json() as { error?: string }
        if (errJson.error) detail = errJson.error
      } catch { /* body was not JSON */ }
      return NextResponse.json(
        { error: `PDF generation failed: ${detail}` },
        { status: 502 }
      )
    }

    pdfBuffer = await engineRes.arrayBuffer()

    if (pdfBuffer.byteLength === 0) {
      return NextResponse.json({ error: "PDF engine returned an empty file" }, { status: 502 })
    }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError"
    return NextResponse.json(
      {
        error: isTimeout
          ? "PDF generation timed out — the document may be too large. Try splitting it into smaller chapters."
          : `Could not reach the PDF engine (${pdfEngineUrl}). Make sure the Docker container is running.`,
      },
      { status: 503 }
    )
  }

  // ── 6. Upload to Supabase Storage ────────────────────────────────────────────
  const serviceClient = createServiceClient()

  // Ensure the bucket exists (idempotent — silently ignores "already exists").
  {
    const { error: bucketErr } = await serviceClient.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 52_428_800, // 50 MB
    })
    if (bucketErr && !bucketErr.message.toLowerCase().includes("already exist")) {
      return NextResponse.json(
        { error: `Storage bucket error: ${bucketErr.message}` },
        { status: 500 }
      )
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const filePath  = `exports/${user.id}/${projectId}/${timestamp}.pdf`

  const { error: uploadError } = await serviceClient.storage
    .from(BUCKET)
    .upload(filePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 }
    )
  }

  // ── 7. Save export record ─────────────────────────────────────────────────────
  const { error: recordError } = await serviceClient
    .from("exports")
    .insert({
      project_id: projectId,
      user_id:    user.id,
      file_path:  filePath,
    })

  if (recordError) {
    // Non-fatal — the PDF is already uploaded. Log and continue.
    console.error("[export-pdf] Failed to save export record:", recordError.message)
  }

  // ── 8. Signed download URL ────────────────────────────────────────────────────
  const safeFilename = project.title.replace(/[^a-z0-9\-_. ]/gi, "_") + ".pdf"

  const { data: signedData, error: urlError } = await serviceClient.storage
    .from(BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_TTL, { download: safeFilename })

  if (urlError || !signedData?.signedUrl) {
    return NextResponse.json(
      { error: `Could not create download URL: ${urlError?.message ?? "unknown error"}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    url:      signedData.signedUrl,
    filePath,
  })
}
