import type { AIProviderAdapter } from "@/lib/ai-runtime/provider-interface"
import { MockAIProvider } from "@/lib/ai-runtime/providers/mock-provider"
import type { SourceDocument } from "@/lib/ebook-ingestion/source-types"
import { normalizeAiEbookGeneration } from "@/lib/ai-ebook/normalization"
import { generateOutline } from "@/lib/ai-ebook/structured-outline"
import type {
  AiEbookFormat,
  AiEbookGeneration,
  AiGenerationRequest,
  AiSectionGeneration,
  AiStructureIssue,
  NormalizedAiEbook,
} from "@/lib/ai-ebook/ebook-generation-schema"
import type { ExportTheme } from "@/lib/export/theme-mapping"

export interface LiveOutlineGenerationInput {
  topic?: string
  sourceDocument?: SourceDocument
  audience?: string
  tone?: string
  ebookType?: AiEbookFormat
  targetLength?: "short" | "standard" | "long"
  outcome?: string
  author?: string
  brand?: string
  theme?: ExportTheme
  provider?: AIProviderAdapter
  model?: string
}

export interface LiveOutlineGenerationResult {
  outline: AiEbookGeneration
  normalized: NormalizedAiEbook
  diagnostics: AiStructureIssue[]
  provider: {
    id: string
    model: string
    usedFallback: boolean
  }
  rawText?: string
}

export async function generateLiveStructuredOutline(
  input: LiveOutlineGenerationInput
): Promise<LiveOutlineGenerationResult> {
  const provider = input.provider ?? new MockAIProvider({ structuredJson: fallbackOutline(input) })
  const prompt = buildOutlinePrompt(input)

  try {
    const response = await provider.generateStructuredJson<unknown>({
      model: input.model,
      messages: [
        {
          role: "system",
          content:
            "You generate structured ebook outlines as JSON only. Do not generate full chapter prose.",
        },
        { role: "user", content: prompt },
      ],
      json: {
        schemaName: "AiEbookOutline",
        validate: isOutlineCandidate,
      },
    })

    const parseResult = recoverOutlineJson(response.json, response.text)
    const outline = normalizeOutlineCandidate(parseResult.value, input)
    const diagnostics = [
      ...parseResult.issues,
      ...diagnoseOutline(outline),
    ]
    const normalized = normalizeAiEbookGeneration(outline)

    return {
      outline,
      normalized,
      diagnostics,
      provider: {
        id: response.providerId,
        model: response.model,
        usedFallback: false,
      },
      rawText: response.text,
    }
  } catch (err) {
    const outline = fallbackOutline(input)
    const normalized = normalizeAiEbookGeneration(outline)
    const fallbackIssue = issue(
      "OUTLINE_FALLBACK_USED",
      "warning",
      err instanceof Error
        ? `Provider outline generation failed: ${err.message}`
        : "Provider outline generation failed.",
      "Use the fallback outline, then regenerate with a configured provider if needed."
    )

    return {
      outline,
      normalized,
      diagnostics: [fallbackIssue, ...diagnoseOutline(outline)],
      provider: {
        id: provider.config.id,
        model: input.model ?? provider.config.defaultModel ?? "unknown",
        usedFallback: true,
      },
    }
  }
}

function buildOutlinePrompt(input: LiveOutlineGenerationInput) {
  const sourceSummary = input.sourceDocument
    ? [
        `Source title: ${input.sourceDocument.metadata.title ?? "Untitled source"}`,
        `Source words: ${input.sourceDocument.metadata.wordCount}`,
        `Detected headings: ${input.sourceDocument.hierarchy.headings.map((heading) => heading.text).join(" | ") || "none"}`,
        `Source excerpt:\n${input.sourceDocument.sanitizedText.slice(0, 3000)}`,
      ].join("\n")
    : "No uploaded source document."

  return [
    "Create a structured ebook outline JSON object.",
    "Return JSON with: title, subtitle, brand, format, theme, chapters, cta.",
    "Each chapter must include title, intro, and sections.",
    "Each section must include a title. Do not draft full chapter prose yet.",
    "Use concise, distinct chapter and section names.",
    "",
    `Topic: ${input.topic ?? input.sourceDocument?.metadata.title ?? "Professional Ebook"}`,
    `Audience: ${input.audience ?? "busy professionals"}`,
    `Tone: ${input.tone ?? "clear, practical, premium"}`,
    `Ebook type: ${input.ebookType ?? "luxury-lead-magnet"}`,
    `Target length: ${input.targetLength ?? "standard"}`,
    `Outcome: ${input.outcome ?? "make confident progress"}`,
    `Brand: ${input.brand ?? "Ebook Studio"}`,
    "",
    sourceSummary,
  ].join("\n")
}

function recoverOutlineJson(
  providerJson: unknown,
  providerText: string
): { value: AiEbookGeneration; issues: AiStructureIssue[] } {
  const direct =
    typeof providerJson === "string" ? null : coerceOutlineObject(providerJson)
  if (direct) return { value: direct, issues: [] }

  const parsed =
    typeof providerJson === "string"
      ? parseJsonFromText(providerJson) ?? parseJsonFromText(providerText)
      : parseJsonFromText(providerText)
  if (parsed) {
    return {
      value: parsed,
      issues: [
        issue(
          "MALFORMED_OUTLINE_JSON_RECOVERED",
          "warning",
          "Provider outline response was recovered from malformed JSON text.",
          "Prefer a provider/model with reliable structured JSON support."
        ),
      ],
    }
  }

  return {
    value: {},
    issues: [
      issue(
        "MALFORMED_OUTLINE_JSON",
        "warning",
        "Provider outline response was not valid outline JSON.",
        "Repair or regenerate the outline JSON."
      ),
    ],
  }
}

function normalizeOutlineCandidate(
  value: AiEbookGeneration,
  input: LiveOutlineGenerationInput
): AiEbookGeneration {
  const fallback = fallbackOutline(input)
  const chapters = Array.isArray(value.chapters) && value.chapters.length > 0
    ? value.chapters.map((chapter, chapterIndex) => ({
        title: cleanString(chapter?.title) || `Chapter ${chapterIndex + 1}`,
        intro: cleanString(chapter?.intro) || `A focused chapter for ${input.audience ?? "the target reader"}.`,
        sections: normalizeOutlineSections(chapter?.sections, chapterIndex),
      }))
    : fallback.chapters

  return {
    title: cleanString(value.title) || fallback.title,
    subtitle: cleanString(value.subtitle) || fallback.subtitle,
    author: cleanString(value.author) || input.author,
    brand: cleanString(value.brand) || input.brand || fallback.brand,
    theme: value.theme ?? input.theme ?? fallback.theme,
    format: value.format ?? input.ebookType ?? fallback.format,
    chapters,
    cta: {
      title: cleanString(value.cta?.title) || fallback.cta?.title,
      body: cleanString(value.cta?.body) || fallback.cta?.body,
      action: cleanString(value.cta?.action) || fallback.cta?.action,
      url: cleanString(value.cta?.url) || fallback.cta?.url,
    },
    metadata: {
      ...(value.metadata ?? {}),
      generationStage: "outline",
      targetLength: input.targetLength ?? "standard",
      tone: input.tone ?? "clear, practical, premium",
    },
  }
}

function normalizeOutlineSections(
  sections: AiSectionGeneration[] | undefined,
  chapterIndex: number
): AiSectionGeneration[] {
  const usable = Array.isArray(sections) ? sections : []
  const normalized = usable
    .map((section, sectionIndex) => ({
      title: cleanString(section?.title) || `Section ${chapterIndex + 1}.${sectionIndex + 1}`,
      blocks: [],
    }))
    .filter((section) => section.title.trim())

  return normalized.length > 0
    ? normalized
    : [
        { title: "Core idea", blocks: [] },
        { title: "Practical framework", blocks: [] },
        { title: "Next steps", blocks: [] },
      ]
}

function fallbackOutline(input: LiveOutlineGenerationInput): AiEbookGeneration {
  const request: AiGenerationRequest = {
    topic: input.topic ?? input.sourceDocument?.metadata.title ?? "Professional Ebook",
    audience: input.audience,
    outcome: input.outcome,
    author: input.author,
    brand: input.brand,
    format: input.ebookType,
    theme: input.theme,
    chapterCount: targetChapterCount(input.targetLength),
  }

  return generateOutline(request)
}

function diagnoseOutline(outline: AiEbookGeneration): AiStructureIssue[] {
  const issues: AiStructureIssue[] = []
  const chapters = outline.chapters ?? []
  const chapterNames = new Map<string, number>()

  if (chapters.length < 3) {
    issues.push(issue("WEAK_OUTLINE_DEPTH", "warning", "Outline has fewer than three chapters.", "Generate a deeper outline with at least three chapters."))
  }

  if (chapters.length > 10) {
    issues.push(issue("OVERSIZED_OUTLINE_STRUCTURE", "warning", "Outline has many chapters.", "Reduce or merge chapters before drafting."))
  }

  for (const chapter of chapters) {
    const key = cleanString(chapter.title).toLowerCase()
    if (key) chapterNames.set(key, (chapterNames.get(key) ?? 0) + 1)

    const sections = chapter.sections ?? []
    if (sections.length < 2) {
      issues.push(issue("SPARSE_OUTLINE_SECTIONS", "warning", `Chapter "${chapter.title ?? "Untitled"}" has few sections.`, "Add at least two focused sections."))
    }
    if (sections.length > 8) {
      issues.push(issue("OVERSIZED_OUTLINE_STRUCTURE", "warning", `Chapter "${chapter.title ?? "Untitled"}" has many sections.`, "Split or simplify this chapter outline."))
    }
  }

  for (const [title, count] of Array.from(chapterNames.entries())) {
    if (count > 1) {
      issues.push(issue("REPETITIVE_CHAPTER_NAMES", "warning", `Chapter title "${title}" appears ${count} times.`, "Use distinct chapter names."))
    }
  }

  return issues
}

function parseJsonFromText(text: string): AiEbookGeneration | null {
  const trimmed = text.trim()
  const candidates = [
    trimmed,
    trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1],
    trimmed.match(/\{[\s\S]*\}/)?.[0],
  ].filter((candidate): candidate is string => Boolean(candidate))

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      const outline = coerceOutlineObject(parsed)
      if (outline) return outline
    } catch {
      continue
    }
  }

  return null
}

function coerceOutlineObject(value: unknown): AiEbookGeneration | null {
  if (typeof value === "string") return parseJsonFromText(value)
  if (typeof value !== "object" || value === null) return null
  const candidate = value as AiEbookGeneration
  if (!isOutlineCandidate(candidate)) return null
  return candidate
}

function isOutlineCandidate(value: unknown): value is AiEbookGeneration {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as { chapters?: unknown }
  return Array.isArray(candidate.chapters)
}

function targetChapterCount(targetLength: LiveOutlineGenerationInput["targetLength"]) {
  if (targetLength === "short") return 3
  if (targetLength === "long") return 7
  return 5
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
}

function issue(
  code: string,
  severity: AiStructureIssue["severity"],
  message: string,
  suggestedFix: string,
  component?: string
): AiStructureIssue {
  return { code, severity, message, suggestedFix, component }
}
