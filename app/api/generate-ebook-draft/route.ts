import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { diagnoseAiGeneratedStructure } from "@/lib/ai-ebook/diagnostics"
import { composerEbookToEditorDraft } from "@/lib/ai-ebook/editor-draft"
import { repairComposerEbookContent } from "@/lib/ai-ebook/content-quality"
import type { AiEbookFormat, AiGenerationRequest, AiStructureIssue } from "@/lib/ai-ebook/ebook-generation-schema"
import { normalizeAiEbookGeneration } from "@/lib/ai-ebook/normalization"
import { generateOutline } from "@/lib/ai-ebook/structured-outline"

const FORMATS: readonly AiEbookFormat[] = [
  "luxury-lead-magnet",
  "consultant-guide",
  "cinematic-ebook",
  "educational-handbook",
  "workbook",
]

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

  const requestData = normalizeRequest(body)
  if (!requestData.topic) {
    return NextResponse.json({ error: "Topic is required" }, { status: 400 })
  }

  const generated = generateOutline(requestData)
  const normalized = normalizeAiEbookGeneration(generated)
  const quality = repairComposerEbookContent(normalized.ebook)
  const diagnostics: AiStructureIssue[] = [
    ...normalized.issues,
    ...diagnoseAiGeneratedStructure(quality.ebook),
    ...quality.issues,
  ]
  const draft = composerEbookToEditorDraft(quality.ebook)

  return NextResponse.json({
    draft,
    structuredEbook: quality.ebook,
    diagnostics,
    summary: {
      chapterCount: draft.chapters.length,
      blockCount: draft.chapters.reduce((sum, chapter) => sum + chapter.blocks.length, 0),
    },
  })
}

function normalizeRequest(body: unknown): AiGenerationRequest {
  const data = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {}
  const format = typeof data.format === "string" && FORMATS.includes(data.format as AiEbookFormat)
    ? (data.format as AiEbookFormat)
    : data.format === "minimal-clean-guide"
      ? "educational-handbook"
      : "luxury-lead-magnet"

  return {
    topic: stringField(data.topic) || stringField(data.title),
    audience: stringField(data.audience),
    outcome: stringField(data.ctaGoal) || stringField(data.outcome),
    author: stringField(data.author),
    brand: "Ebook Studio",
    format,
    theme: format === "educational-handbook" ? "clean-minimal" : "luxury-black-gold",
    chapterCount: lengthToChapterCount(stringField(data.length)),
  } as AiGenerationRequest
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function lengthToChapterCount(length: string): number {
  if (length === "short") return 3
  if (length === "long") return 7
  return 5
}
