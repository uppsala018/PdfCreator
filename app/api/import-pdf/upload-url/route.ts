import { type NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

const IMPORT_BUCKET = "imports"
const MAX_PDF_BYTES = 50 * 1024 * 1024

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

export async function POST(request: NextRequest) {
  const missing = missingConfig()
  if (missing.length > 0) {
    return NextResponse.json(
      {
        code: "MISSING_CONFIG",
        error: `Missing required server configuration: ${missing.join(", ")}`,
      },
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
  const { error: bucketError } = await service.storage.createBucket(IMPORT_BUCKET, {
    public: false,
  })
  if (bucketError && !isBucketAlreadyExists(bucketError)) {
    console.error("[import-pdf:upload-url] BUCKET_FAILURE", bucketError)
    return NextResponse.json(
      {
        code: "BUCKET_FAILURE",
        error: "Storage bucket failure: could not create or verify the private imports bucket.",
        detail: bucketError.message,
      },
      { status: 500 }
    )
  }

  const storagePath = `${user.id}/${Date.now()}-${crypto.randomUUID()}-${safeFilename(filename)}`
  const { data, error } = await service.storage
    .from(IMPORT_BUCKET)
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    console.error("[import-pdf:upload-url] SIGNED_UPLOAD_FAILURE", error)
    return NextResponse.json(
      {
        code: "UPLOAD_FAILURE",
        error: "Storage upload failed: could not create a direct upload URL.",
        detail: error?.message,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    bucket: IMPORT_BUCKET,
    storagePath: data.path,
    token: data.token,
  })
}
