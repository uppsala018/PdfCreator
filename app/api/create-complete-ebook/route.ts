import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { composerEbookToEditorDraft } from "@/lib/ai-ebook/editor-draft"
import type { AiEbookFormat, AiStructureIssue } from "@/lib/ai-ebook/ebook-generation-schema"
import { generateLiveStructuredChapters } from "@/lib/ai-ebook/live-chapter-generation"
import { generateLiveStructuredOutline } from "@/lib/ai-ebook/live-outline-generation"
import { runControlledRegenerationLoop } from "@/lib/ai-ebook/regeneration-loop"
import { normalizeSource } from "@/lib/ebook-ingestion/normalize-source"
import type { ExportTheme } from "@/lib/export/theme-mapping"

const FORMATS: readonly AiEbookFormat[] = [
  "luxury-lead-magnet",
  "consultant-guide",
  "cinematic-ebook",
  "educational-handbook",
  "workbook",
]

const THEMES: readonly ExportTheme[] = [
  "luxury-black-gold",
  "dark-cinematic",
  "clean-minimal",
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

  const input = normalizeRequest(body)
  if (!input.topic && !input.sourceText) {
    return NextResponse.json({ error: "Topic or source text is required" }, { status: 400 })
  }

  const sourceDocument = input.sourceText
    ? normalizeSource({
        kind: input.sourceKind,
        text: input.sourceText,
        title: input.topic || undefined,
      })
    : undefined

  const outline = await generateLiveStructuredOutline({
    topic: input.topic || sourceDocument?.metadata.title,
    sourceDocument,
    audience: input.audience,
    tone: input.tone,
    ebookType: input.format,
    targetLength: input.targetLength,
    outcome: input.ctaGoal,
    brand: input.brand,
    theme: input.theme,
    model: input.model,
  })

  const chapters = await generateLiveStructuredChapters({
    outline: outline.outline,
    audience: input.audience,
    tone: input.tone,
    model: input.model,
  })

  const regeneration = runControlledRegenerationLoop(chapters.composerReady, {
    maxPasses: 2,
  })
  const draft = composerEbookToEditorDraft(regeneration.ebook)
  const diagnostics: AiStructureIssue[] = [
    ...sourceDiagnostics(sourceDocument),
    ...outline.diagnostics,
    ...chapters.diagnostics,
    ...regeneration.finalDiagnostics,
  ]

  return NextResponse.json({
    draft,
    structuredEbook: regeneration.ebook,
    diagnostics,
    summary: {
      title: draft.title,
      subtitle: draft.subtitle,
      chapterCount: draft.chapters.length,
      blockCount: draft.chapters.reduce((sum, chapter) => sum + chapter.blocks.length, 0),
      diagnosticsCount: diagnostics.length,
      regenerationPasses: regeneration.metadata.passesRun,
      provider: chapters.provider,
      source: sourceDocument
        ? {
            inputKind: sourceDocument.metadata.inputKind,
            wordCount: sourceDocument.metadata.wordCount,
            sectionCount: sourceDocument.sections.length,
          }
        : null,
    },
    regeneration: {
      metadata: regeneration.metadata,
      passHistory: regeneration.passHistory.map((pass) => ({
        pass: pass.pass,
        improved: pass.improved,
        changes: pass.changes,
        beforeCount: pass.beforeDiagnostics.length,
        afterCount: pass.afterDiagnostics.length,
      })),
    },
  })
}

function normalizeRequest(body: unknown) {
  const data = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {}
  const format = stringField(data.ebookPreset)
  const theme = stringField(data.theme)
  const sourceKind = stringField(data.sourceKind)
  const targetLength = stringField(data.targetLength)
  const resolvedTargetLength: "short" | "standard" | "long" =
    targetLength === "short" || targetLength === "long" ? targetLength : "standard"

  return {
    topic: stringField(data.topic),
    sourceText: stringField(data.sourceText),
    sourceKind: sourceKind === "markdown" ? "markdown" as const : "plain_text" as const,
    audience: stringField(data.audience),
    tone: stringField(data.tone),
    format: FORMATS.includes(format as AiEbookFormat)
      ? (format as AiEbookFormat)
      : "luxury-lead-magnet",
    targetLength: resolvedTargetLength,
    ctaGoal: stringField(data.ctaGoal),
    brand: stringField(data.brand) || "Ebook Studio",
    theme: THEMES.includes(theme as ExportTheme) ? (theme as ExportTheme) : "luxury-black-gold",
    providerId: stringField(data.providerId) || "mock",
    model: stringField(data.model) || undefined,
  }
}

function sourceDiagnostics(sourceDocument: ReturnType<typeof normalizeSource> | undefined): AiStructureIssue[] {
  return (sourceDocument?.diagnostics ?? []).map((diagnostic) => ({
    code: `SOURCE_${diagnostic.code.toUpperCase()}`,
    severity: diagnostic.severity,
    message: diagnostic.message,
    suggestedFix: "Review source input before generating the final ebook.",
    component: diagnostic.sectionId,
  }))
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}
