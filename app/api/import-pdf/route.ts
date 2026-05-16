import { type NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/supabase/database.types"
import type { ImportedPdfPageSize, ProjectContent } from "@/lib/project-schema"

const IMPORT_BUCKET = "imports"
const MAX_PDF_BYTES = 50 * 1024 * 1024

type ImportErrorCode =
  | "MISSING_CONFIG"
  | "UNAUTHENTICATED"
  | "INVALID_REQUEST"
  | "INVALID_PDF"
  | "BUCKET_FAILURE"
  | "UPLOAD_FAILURE"
  | "PROJECT_CREATE_FAILURE"
  | "UNEXPECTED_ERROR"

function logImportError(code: ImportErrorCode, message: string, detail?: unknown) {
  console.error("[import-pdf]", code, message, detail ?? "")
}

function errorResponse(
  code: ImportErrorCode,
  error: string,
  status: number,
  detail?: string
) {
  return NextResponse.json(
    {
      error,
      code,
      ...(detail ? { detail } : {}),
    },
    { status }
  )
}

function missingConfig(): string[] {
  return [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ].filter((key) => !process.env[key])
}

function isBucketAlreadyExists(error: { message?: string; statusCode?: string } | null) {
  if (!error) return false
  const message = error.message?.toLowerCase() ?? ""
  return (
    error.statusCode === "409" ||
    message.includes("already exists") ||
    message.includes("duplicate") ||
    message.includes("resource already exists")
  )
}

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
  try {
    const missing = missingConfig()
    if (missing.length > 0) {
      const message = `Missing required server configuration: ${missing.join(", ")}`
      logImportError("MISSING_CONFIG", message)
      return errorResponse("MISSING_CONFIG", message, 500)
    }

    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      logImportError("UNAUTHENTICATED", "PDF import requested without a valid user session", authError)
      return errorResponse(
        "UNAUTHENTICATED",
        "You are not authenticated. Sign in again, then import the PDF.",
        401
      )
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch (err) {
      logImportError("INVALID_REQUEST", "Import request was not multipart/form-data", err)
      return errorResponse(
        "INVALID_REQUEST",
        "Import request must be multipart/form-data.",
        400
      )
    }

    const file = formData.get("file")
    if (!(file instanceof File)) {
      logImportError("INVALID_PDF", "Import request did not include a file")
      return errorResponse("INVALID_PDF", "PDF file is required.", 400)
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      logImportError("INVALID_PDF", "Rejected non-PDF upload", {
        name: file.name,
        type: file.type,
      })
      return errorResponse("INVALID_PDF", "Only PDF files are supported.", 400)
    }

    if (file.size <= 0 || file.size > MAX_PDF_BYTES) {
      logImportError("INVALID_PDF", "Rejected PDF because file size is outside limits", {
        name: file.name,
        size: file.size,
      })
      return errorResponse(
        "INVALID_PDF",
        "PDF must be larger than 0 bytes and no more than 50 MB.",
        400
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
    if (bucketError && !isBucketAlreadyExists(bucketError)) {
      logImportError("BUCKET_FAILURE", "Could not create or verify imports bucket", bucketError)
      return errorResponse(
        "BUCKET_FAILURE",
        "Storage bucket failure: could not create or verify the private imports bucket.",
        500,
        bucketError.message
      )
    }

    const { error: uploadError } = await service.storage
      .from(IMPORT_BUCKET)
      .upload(storagePath, bytes, {
        contentType: "application/pdf",
        upsert: false,
      })

    if (uploadError) {
      logImportError("UPLOAD_FAILURE", "Storage upload failed", uploadError)
      return errorResponse(
        "UPLOAD_FAILURE",
        "Storage upload failed: the PDF could not be saved.",
        500,
        uploadError.message
      )
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
      logImportError("PROJECT_CREATE_FAILURE", "Imported PDF uploaded but project creation failed", insertError)
      return errorResponse(
        "PROJECT_CREATE_FAILURE",
        "Project creation failed after the PDF was uploaded.",
        500,
        insertError.message
      )
    }

    return NextResponse.json({ project }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected PDF import error"
    logImportError("UNEXPECTED_ERROR", message, err)
    return errorResponse(
      "UNEXPECTED_ERROR",
      "Unexpected PDF import error. Check server logs for details.",
      500,
      message
    )
  }
}
