import type { AiEbookFormat } from "@/lib/ai-ebook/ebook-generation-schema"
import type { ExportTheme } from "@/lib/export/theme-mapping"

export interface ChapterPlan {
  title: string
  targetPages?: number
  sectionCount?: number
}

export interface ProfessionalEbookPlan {
  topic: string
  audience?: string
  tone?: string
  format: AiEbookFormat
  theme: ExportTheme
  providerId?: string
  model?: string
  ctaGoal?: string
  targetLength: "short" | "standard" | "long"
  chapterCount: number
  totalPages: number
  minPagesPerChapter: number
  sectionCountPerChapter?: number
  wordsPerPage: number
  targetWords: number
  chapters: ChapterPlan[]
  imagePlan?: {
    includeImages: boolean
    frequency: "none" | "cover" | "per_chapter" | "every_x_pages" | "custom"
    everyPages?: number
    stylePrompt?: string
    providerPreference?: string
  }
  warnings: string[]
}

export function createProfessionalEbookPlan(input: {
  topic?: string
  audience?: string
  tone?: string
  ebookPreset?: string
  theme?: string
  providerId?: string
  model?: string
  ctaGoal?: string
  targetLength?: string
  chapterDefinitions?: string
  desiredChapterCount?: unknown
  desiredTotalPages?: unknown
  minPagesPerChapter?: unknown
  sectionCountPerChapter?: unknown
  wordsPerPage?: unknown
  includeImages?: unknown
  imageFrequency?: unknown
  imageEveryPages?: unknown
  imageStylePrompt?: unknown
  imageProviderPreference?: unknown
}): ProfessionalEbookPlan {
  const topic = clean(input.topic) || "Professional Ebook"
  const inferred = inferStructureFromPrompt(topic)
  const manualChapters = parseChapterDefinitions(input.chapterDefinitions)
  const explicitChapterCount = positiveInt(input.desiredChapterCount)
  const explicitTotalPages = positiveInt(input.desiredTotalPages)
  const explicitMinPages = positiveInt(input.minPagesPerChapter)
  const sectionCount = positiveInt(input.sectionCountPerChapter)
  const targetLength = lengthValue(input.targetLength)

  const plannedChapterCount =
    explicitChapterCount ??
    (manualChapters.length > 0 ? manualChapters.length : undefined) ??
    inferred.chapterCount ??
    lengthToChapters(targetLength)
  const chapterCount = clamp(plannedChapterCount, 1, 40)
  const minPagesPerChapter = clamp(explicitMinPages ?? inferred.pagesPerChapter ?? 1, 1, 25)
  const totalPages = clamp(
    explicitTotalPages ?? inferred.totalPages ?? Math.max(chapterCount * minPagesPerChapter, lengthToPages(targetLength)),
    3,
    200
  )
  const wordsPerPage = clamp(positiveInt(input.wordsPerPage) ?? 400, 250, 650)
  const chapters = buildChapters(manualChapters, chapterCount, totalPages, sectionCount)
  const warnings = buildWarnings({ topic, totalPages, chapterCount, minPagesPerChapter, hasManualChapters: manualChapters.length > 0 })

  return {
    topic,
    audience: clean(input.audience),
    tone: clean(input.tone),
    format: formatValue(input.ebookPreset),
    theme: themeValue(input.theme),
    providerId: clean(input.providerId),
    model: clean(input.model),
    ctaGoal: clean(input.ctaGoal),
    targetLength,
    chapterCount,
    totalPages,
    minPagesPerChapter,
    sectionCountPerChapter: sectionCount,
    wordsPerPage,
    targetWords: totalPages * wordsPerPage,
    chapters,
    imagePlan: {
      includeImages: input.includeImages === true,
      frequency: imageFrequency(input.imageFrequency),
      everyPages: positiveInt(input.imageEveryPages),
      stylePrompt: clean(input.imageStylePrompt),
      providerPreference: clean(input.imageProviderPreference),
    },
    warnings,
  }
}

export function parseChapterDefinitions(value: unknown): ChapterPlan[] {
  const text = typeof value === "string" ? value.trim() : ""
  if (!text) return []
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^chapter\s*\d+\s*[:.)-]\s*/i, "").replace(/^\d+\s*[:.)-]\s*/, "").trim())
    .filter(Boolean)
    .map((title) => ({ title }))
}

export function inferStructureFromPrompt(prompt: string): {
  chapterCount?: number
  totalPages?: number
  pagesPerChapter?: number
} {
  const text = prompt.toLowerCase()
  return {
    chapterCount: firstNumber(text, [
      /(\d+)\s*(?:chapter|chapters)\b/,
      /(?:chapter|chapters)\s*(?:count|length)?\s*(?:of|:)?\s*(\d+)/,
    ]),
    totalPages: firstNumber(text, [
      /(?:at least|minimum|min\.?)\s*(\d+)\s*pages?\b/,
      /(\d+)\s*pages?\s*(?:book|ebook|e-book)\b/,
      /(?:make|write|create)\s+(?:this\s+)?(?:a\s+)?(\d+)\s*pages?\b/,
    ]),
    pagesPerChapter: firstNumber(text, [
      /(\d+)\s*pages?\s*(?:per|each)\s*chapter\b/,
      /each\s*chapter\s*(?:should\s*be\s*)?(\d+)\s*pages?\b/,
    ]),
  }
}

function buildChapters(manual: ChapterPlan[], chapterCount: number, totalPages: number, sectionCount?: number): ChapterPlan[] {
  const pages = Math.max(1, Math.round(totalPages / chapterCount))
  const chapters: ChapterPlan[] = manual.length > 0
    ? manual.slice(0, chapterCount)
    : Array.from({ length: chapterCount }, (_, index) => ({ title: `Chapter ${index + 1}` }))
  while (chapters.length < chapterCount) chapters.push({ title: `Chapter ${chapters.length + 1}` })
  return chapters.map((chapter) => ({
    ...chapter,
    targetPages: chapter.targetPages ?? pages,
    sectionCount,
  }))
}

function buildWarnings(input: {
  topic: string
  totalPages: number
  chapterCount: number
  minPagesPerChapter: number
  hasManualChapters: boolean
}) {
  const warnings: string[] = []
  if (input.totalPages >= 50) {
    warnings.push("Large ebooks work best with source material, examples, or a manual chapter plan.")
  }
  if (input.chapterCount * input.minPagesPerChapter >= 50 && !input.hasManualChapters) {
    warnings.push("A deep book without chapter definitions may need extra retries or source detail to avoid generic sections.")
  }
  if (input.topic.split(/\s+/).filter(Boolean).length < 8 && input.totalPages >= 30) {
    warnings.push("The prompt is short for the requested depth. Add audience, angle, examples, or source material for stronger chapters.")
  }
  return warnings
}

function firstNumber(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    const value = match?.[1] ? Number.parseInt(match[1], 10) : NaN
    if (Number.isFinite(value) && value > 0) return value
  }
  return undefined
}

function positiveInt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value)
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return undefined
}

function clean(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
}

function lengthValue(value: unknown): ProfessionalEbookPlan["targetLength"] {
  return value === "short" || value === "long" ? value : "standard"
}

function lengthToChapters(value: ProfessionalEbookPlan["targetLength"]) {
  if (value === "short") return 3
  if (value === "long") return 8
  return 5
}

function lengthToPages(value: ProfessionalEbookPlan["targetLength"]) {
  if (value === "short") return 8
  if (value === "long") return 35
  return 15
}

function formatValue(value: unknown): AiEbookFormat {
  if (
    value === "luxury-lead-magnet" ||
    value === "workbook" ||
    value === "consultant-guide" ||
    value === "cinematic-ebook" ||
    value === "educational-handbook"
  ) {
    return value
  }
  return "luxury-lead-magnet"
}

function themeValue(value: unknown): ExportTheme {
  return value === "dark-cinematic" || value === "clean-minimal" ? value : "luxury-black-gold"
}

function imageFrequency(value: unknown): NonNullable<ProfessionalEbookPlan["imagePlan"]>["frequency"] {
  if (value === "cover" || value === "per_chapter" || value === "every_x_pages" || value === "custom") return value
  return "none"
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)))
}
