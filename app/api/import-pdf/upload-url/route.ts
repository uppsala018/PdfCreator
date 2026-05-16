import { type NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

const IMPORT_BUCKET = "imports"
const MAX_PDF_BYTES = 50 * 1024 * 1024
const IS_DEV = process.env.NODE_ENV === "development"

function safeFilename(name: string): string {
  return name.replace(/[^a-z0-9\-_. ]/gi, "_").trim() || "imported.pdf"
}

function missingConfig(): string[] {
  return [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ].filter((key) => !process.env[key])
}

function debugInfo(extra?: Record<string, unknown>) {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    bucket: IMPORT_BUCKET,
    ...extra,
  }
}

function withDevDebug<T extends Record<string, unknown>>(
  body: T,
  debug: Record<string, unknown>
) {
  return IS_DEV ? { ...body, debug } : body
}

export async function POST(request: NextRequest) {
  console.info("[import-pdf:upload-url] active Supabase project", {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    bucket: IMPORT_BUCKET,
  })

  const missing = missingConfig()
  if (missing.length > 0) {
    return NextResponse.json(
      withDevDebug(
        {
          code: "MISSING_CONFIG",
          error: `Missing required server configuration: ${missing.join(", ")}`,
        },
        debugInfo({ missing })
      ),
      { status: 500 }
    )
  }

  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      {
        code: "UNAUTHENTICATED",
        error: "You are not authenticated. Sign in again, then import the PDF.",
      },
      { status: 401 }
    )
  }

  const body = (await request.json().catch(() => null)) as {
    filename?: unknown
    size?: unknown
    contentType?: unknown
  } | null

  const filename = typeof body?.filename === "string" ? body.filename : ""
  const size = typeof body?.size === "number" ? body.size : 0
  const contentType = typeof body?.contentType === "string" ? body.contentType : ""

  if (!filename.toLowerCase().endsWith(".pdf") && contentType !== "application/pdf") {
    return NextResponse.json(
      { code: "INVALID_PDF", error: "Only PDF files are supported." },
      { status: 400 }
    )
  }

  if (size <= 0 || size > MAX_PDF_BYTES) {
    return NextResponse.json(
      {
        code: "INVALID_PDF",
        error: "PDF is too large for browser upload/storage. Maximum size is 50 MB.",
      },
      { status: 400 }
    )
  }

  const service = createServiceClient()
  const { data: bucket, error: bucketError } = await service.storage.getBucket(IMPORT_BUCKET)
  console.info("[import-pdf:upload-url] imports bucket lookup", {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    bucketExists: Boolean(bucket && !bucketError),
    bucketName: bucket?.name ?? null,
    error: bucketError
      ? {
          name: bucketError.name,
          message: bucketError.message,
          status: "status" in bucketError ? bucketError.status : undefined,
          statusCode: "statusCode" in bucketError ? bucketError.statusCode : undefined,
        }
      : null,
  })

  if (bucketError) {
    console.error("[import-pdf:upload-url] BUCKET_FAILURE getBucket(imports) exact error", bucketError)
    return NextResponse.json(
      withDevDebug(
        {
          code: "BUCKET_FAILURE",
          error: "Supabase Storage bucket `imports` is missing or inaccessible. Create it manually as a private bucket and verify Storage policies.",
          detail: bucketError.message,
        },
        debugInfo({
          bucketExists: false,
          storageError: {
            name: bucketError.name,
            message: bucketError.message,
            status: "status" in bucketError ? bucketError.status : undefined,
            statusCode: "statusCode" in bucketError ? bucketError.statusCode : undefined,
          },
        })
      ),
      { status: 500 }
    )
  }

  const storagePath = `${user.id}/${Date.now()}-${crypto.randomUUID()}-${safeFilename(filename)}`
  const { data, error } = await service.storage
    .from(IMPORT_BUCKET)
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    console.error("[import-pdf:upload-url] SIGNED_UPLOAD_FAILURE createSignedUploadUrl(imports) exact error", error)
    return NextResponse.json(
      withDevDebug(
        {
          code: "UPLOAD_FAILURE",
          error: "Storage upload failed: could not create a direct upload URL.",
          detail: error?.message,
        },
        debugInfo({
          bucketExists: true,
          storagePath,
          storageError: error
            ? {
                name: error.name,
                message: error.message,
                status: "status" in error ? error.status : undefined,
                statusCode: "statusCode" in error ? error.statusCode : undefined,
              }
            : null,
        })
      ),
      { status: 500 }
    )
  }

  return NextResponse.json({
    bucket: IMPORT_BUCKET,
    storagePath: data.path,
    token: data.token,
  })
}
