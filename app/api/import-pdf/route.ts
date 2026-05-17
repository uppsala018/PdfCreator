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
  | "UPLOAD_FAILURE"
  | "PROJECT_CREATE_FAILURE"
  | "UNEXPECTED_ERROR"

type ImportMetadataBody = {
  filename?: unknown
  storagePath?: unknown
  size?: unknown
  contentType?: unknown
  pageCount?: unknown
  pageSize?: unknown
}

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

function safeFilename(name: string): string {
  return name.replace(/[^a-z0-9\-_. ]/gi, "_").trim() || "imported.pdf"
}

function parsePageSize(value: unknown): ImportedPdfPageSize | null {
  if (typeof value !== "object" || value === null) return null
  const pageSize = value as { width?: unknown; height?: unknown; unit?: unknown }
  if (
    typeof pageSize.width !== "number" ||
    typeof pageSize.height !== "number" ||
    pageSize.unit !== "pt"
  ) {
    return null
  }
  return {
    width: pageSize.width,
    height: pageSize.height,
    unit: "pt",
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

    let body: ImportMetadataBody
    try {
      body = (await request.json()) as ImportMetadataBody
    } catch (err) {
      logImportError("INVALID_REQUEST", "Import metadata request was not valid JSON", err)
      return errorResponse("INVALID_REQUEST", "Import metadata request must be JSON.", 400)
    }

    const filename = typeof body.filename === "string" ? body.filename : ""
    const storagePath = typeof body.storagePath === "string" ? body.storagePath : ""
    const size = typeof body.size === "number" ? body.size : 0
    const contentType = typeof body.contentType === "string" ? body.contentType : ""

    if (!filename || !storagePath) {
      return errorResponse(
        "INVALID_REQUEST",
        "Import metadata must include filename and storagePath.",
        400
      )
    }

    if (!filename.toLowerCase().endsWith(".pdf") && contentType !== "application/pdf") {
      logImportError("INVALID_PDF", "Rejected non-PDF import metadata", {
        filename,
        contentType,
      })
      return errorResponse("INVALID_PDF", "Only PDF files are supported.", 400)
    }

    if (size <= 0 || size > MAX_PDF_BYTES) {
      logImportError("INVALID_PDF", "Rejected PDF metadata because file size is outside limits", {
        filename,
        size,
      })
      return errorResponse(
        "INVALID_PDF",
        "PDF is too large for browser upload/storage. Maximum size is 50 MB.",
        400
      )
    }

    if (!storagePath.startsWith(`${user.id}/`)) {
      logImportError("INVALID_REQUEST", "Storage path does not belong to authenticated user", {
        userId: user.id,
        storagePath,
      })
      return errorResponse(
        "INVALID_REQUEST",
        "Import storage path does not belong to the authenticated user.",
        403
      )
    }

    const service = createServiceClient()
    const { data: objectExists, error: objectError } = await service.storage
      .from(IMPORT_BUCKET)
      .exists(storagePath)

    if (objectError || !objectExists) {
      logImportError("UPLOAD_FAILURE", "Uploaded PDF object could not be verified", objectError)
      return errorResponse(
        "UPLOAD_FAILURE",
        "Supabase upload failed: the uploaded PDF could not be verified.",
        500,
        objectError?.message
      )
    }

    const projectId = crypto.randomUUID()
    const safeTitle = safeFilename(filename).replace(/\.pdf$/i, "")
    const pageCount = typeof body.pageCount === "number" ? body.pageCount : null
    const pageSize = parsePageSize(body.pageSize)

    const content: ProjectContent = {
      projectType: "imported_pdf",
      chapters: [],
      importedPdf: {
        status: "imported",
        originalFilename: filename,
        storageBucket: IMPORT_BUCKET,
        storagePath,
        pageCount,
        pageSize,
        importedAt: new Date().toISOString(),
      },
      layoutEditState: {
        version: 1,
        deletedPages: [],
        pageOrder: [],
        visualBlocks: [],
        textOverlays: {},
        patchFills: {},
      },
    }

    const { data: project, error: insertError } = await supabase
      .from("projects")
      .insert({
        id: projectId,
        user_id: user.id,
        title: safeTitle,
        theme: "clean-minimal",
        template: "imported-pdf",
        content: content as unknown as Json,
      })
      .select("id, title, author, theme, template, updated_at")
      .single()

    if (insertError) {
      logImportError("PROJECT_CREATE_FAILURE", "Uploaded PDF verified but project creation failed", insertError)
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
