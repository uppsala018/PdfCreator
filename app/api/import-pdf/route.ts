import { type NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/supabase/database.types"
import type { ImportedPdfPageSize, ProjectContent } from "@/lib/project-schema"

const IMPORT_BUCKET = "imports"
const MAX_PDF_BYTES = 50 * 1024 * 1024

function safeFilename(name: string): string {
  return name.replace(/[^a-z0-9\-_. ]/gi, "_").trim() || "imported.pdf"
}

function extractPdfMetadata(bytes: ArrayBuffer): {
  pageCount: number | null
  pageSize: ImportedPdfPageSize | null
} {
  const text = Buffer.from(bytes).toString("latin1")
  const pageMatches = text.match(/\/Type\s*\/Page\b/g)
  const mediaBoxMatch = text.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/)

  return {
    pageCount: pageMatches?.length ?? null,
    pageSize: mediaBoxMatch
      ? {
          width: Number(mediaBoxMatch[1]),
          height: Number(mediaBoxMatch[2]),
          unit: "pt",
        }
      : null,
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Request must be multipart/form-data" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "PDF file is required" }, { status: 400 })
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 })
  }

  if (file.size <= 0 || file.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: "PDF must be larger than 0 bytes and no more than 50 MB" },
      { status: 400 }
    )
  }

  const bytes = await file.arrayBuffer()
  const metadata = extractPdfMetadata(bytes)
  const projectId = crypto.randomUUID()
  const filename = safeFilename(file.name)
  const storagePath = `${user.id}/${projectId}/${filename}`
  const service = createServiceClient()

  const { error: bucketError } = await service.storage.createBucket(IMPORT_BUCKET, {
    public: false,
  })
  if (bucketError && !bucketError.message.toLowerCase().includes("already exists")) {
    return NextResponse.json({ error: bucketError.message }, { status: 500 })
  }

  const { error: uploadError } = await service.storage
    .from(IMPORT_BUCKET)
    .upload(storagePath, bytes, {
      contentType: "application/pdf",
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const content: ProjectContent = {
    projectType: "imported_pdf",
    chapters: [],
    importedPdf: {
      status: "imported",
      originalFilename: file.name,
      storageBucket: IMPORT_BUCKET,
      storagePath,
      pageCount: metadata.pageCount,
      pageSize: metadata.pageSize,
      importedAt: new Date().toISOString(),
    },
    layoutEditState: {
      version: 1,
      deletedPages: [],
      pageOrder: [],
      visualBlocks: [],
      textOverlays: {},
    },
  }

  const { data: project, error: insertError } = await supabase
    .from("projects")
    .insert({
      id: projectId,
      user_id: user.id,
      title: filename.replace(/\.pdf$/i, ""),
      theme: "clean-minimal",
      template: "imported-pdf",
      content: content as unknown as Json,
    })
    .select("id, title, author, theme, template, updated_at")
    .single()

  if (insertError) {
    await service.storage.from(IMPORT_BUCKET).remove([storagePath])
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ project }, { status: 201 })
}
