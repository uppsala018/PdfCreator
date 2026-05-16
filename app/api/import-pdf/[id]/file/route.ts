import { type NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import type { ImportedPdfInfo } from "@/lib/project-schema"

interface RouteContext {
  params: { id: string }
}

function getImportedPdf(content: unknown): ImportedPdfInfo | null {
  if (
    typeof content !== "object" ||
    content === null ||
    (content as { projectType?: unknown }).projectType !== "imported_pdf"
  ) {
    return null
  }

  const importedPdf = (content as { importedPdf?: unknown }).importedPdf
  if (
    typeof importedPdf !== "object" ||
    importedPdf === null ||
    typeof (importedPdf as { storageBucket?: unknown }).storageBucket !== "string" ||
    typeof (importedPdf as { storagePath?: unknown }).storagePath !== "string"
  ) {
    return null
  }

  return importedPdf as ImportedPdfInfo
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

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("content")
    .eq("id", params.id)
    .single()

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  const importedPdf = getImportedPdf(project.content)
  if (!importedPdf) {
    return NextResponse.json({ error: "Project is not an imported PDF" }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service.storage
    .from(importedPdf.storageBucket)
    .download(importedPdf.storagePath)

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not load PDF" },
      { status: 500 }
    )
  }

  return new NextResponse(data, {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, max-age=60",
    },
  })
}
