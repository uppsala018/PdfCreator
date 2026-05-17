import type { AIProviderAdapter } from "@/lib/ai-runtime/provider-interface"
import { MockAIProvider } from "@/lib/ai-runtime/providers/mock-provider"
import { generatePromptBlock } from "@/lib/ai-ebook/block-generation"
import type {
  AiBlockGeneration,
  AiChapterGeneration,
  AiEbookGeneration,
  AiSectionGeneration,
  AiStructureIssue,
  NormalizedAiEbook,
} from "@/lib/ai-ebook/ebook-generation-schema"
import { normalizeAiEbookGeneration } from "@/lib/ai-ebook/normalization"
import type { ComposerBlock, ComposerEbook } from "@/lib/export/project-to-schema"

export interface LiveChapterGenerationInput {
  outline: AiEbookGeneration
  audience?: string
  tone?: string
  provider?: AIProviderAdapter
  model?: string
}

export interface LiveChapterGenerationResult {
  ebook: AiEbookGeneration
  normalized: NormalizedAiEbook
  composerReady: ComposerEbook
  diagnostics: AiStructureIssue[]
  provider: {
    id: string
    model: string
    usedFallback: boolean
  }
  rawText?: string
}

const MAX_PARAGRAPH_LENGTH = 900
const MAX_SECTIONS_PER_CHAPTER = 8
const REQUIRED_VARIETY = 4

export async function generateLiveStructuredChapters(
  input: LiveChapterGenerationInput
): Promise<LiveChapterGenerationResult> {
  const provider = input.provider ?? new MockAIProvider({ structuredJson: fallbackChapterEbook(input.outline, input) })

  try {
    const response = await provider.generateStructuredJson<unknown>({
      model: input.model,
      temperature: 0.2,
      maxOutputTokens: 2600,
      messages: [
        {
          role: "system",
          content:
            "You generate full ebook chapters as structured JSON blocks only. Use supported Professional Composer block types.",
        },
        { role: "user", content: buildChapterPrompt(input) },
      ],
      json: {
        schemaName: "AiStructuredChapters",
        validate: isChapterCandidate,
      },
    })

    const parseResult = recoverChapterJson(response.json, response.text)
    const ebook = normalizeChapterCandidate(parseResult.value, input)
    const safeguardResult = applyChapterSafeguards(ebook)
    const normalized = normalizeAiEbookGeneration(safeguardResult.ebook)
    const diagnostics = [
      ...parseResult.issues,
      ...safeguardResult.issues,
      ...diagnoseGeneratedChapters(safeguardResult.ebook),
      ...normalized.issues,
    ]

    return {
      ebook: safeguardResult.ebook,
      normalized,
      composerReady: normalized.ebook,
      diagnostics,
      provider: {
        id: response.providerId,
        model: response.model,
        usedFallback: false,
      },
      rawText: response.text,
    }
  } catch (err) {
    const ebook = fallbackChapterEbook(input.outline, input)
    const safeguardResult = applyChapterSafeguards(ebook)
    const normalized = normalizeAiEbookGeneration(safeguardResult.ebook)
    const fallbackIssue = issue(
      "CHAPTER_FALLBACK_USED",
      "warning",
      err instanceof Error
        ? `Provider chapter generation failed: ${err.message}`
        : "Provider chapter generation failed.",
      "Use the fallback chapter draft, then regenerate with a configured provider if needed."
    )

    return {
      ebook: safeguardResult.ebook,
      normalized,
      composerReady: normalized.ebook,
      diagnostics: [
        fallbackIssue,
        ...safeguardResult.issues,
        ...diagnoseGeneratedChapters(safeguardResult.ebook),
        ...normalized.issues,
      ],
      provider: {
        id: provider.config.id,
        model: input.model ?? provider.config.defaultModel ?? "unknown",
        usedFallback: true,
      },
    }
  }
}

function buildChapterPrompt(input: LiveChapterGenerationInput) {
  return [
    "Expand this outline into full structured ebook chapters.",
    "Return JSON with title, subtitle, brand, format, theme, chapters, cta.",
    "Use only these block types: paragraph, heading, subheading, bullet_list, numbered_list, tip_box, warning_box, key_takeaway, prompt_block, comparison_table, workflow_step, cta_box.",
    "Every block must be usable: text blocks need non-empty text, lists need non-empty items, and tables need headers plus rows.",
    "Keep paragraphs concise. Include useful lists, callouts, prompts, tables, workflow steps, and chapter CTAs where appropriate.",
    "Do not return markdown. Do not return plain prose outside JSON.",
    "",
    `Audience: ${input.audience ?? "busy professionals"}`,
    `Tone: ${input.tone ?? "clear, practical, premium"}`,
    "",
    JSON.stringify(input.outline),
  ].join("\n")
}

function recoverChapterJson(
  providerJson: unknown,
  providerText: string
): { value: AiEbookGeneration; issues: AiStructureIssue[] } {
  const direct = typeof providerJson === "string" ? null : coerceChapterObject(providerJson)
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
          "MALFORMED_CHAPTER_JSON_RECOVERED",
          "warning",
          "Provider chapter response was recovered from malformed JSON text.",
          "Prefer a provider/model with reliable structured JSON support."
        ),
      ],
    }
  }

  return {
    value: {},
    issues: [
      issue(
        "MALFORMED_CHAPTER_JSON",
        "warning",
        "Provider chapter response was not valid structured ebook JSON.",
        "Repair or regenerate the chapter JSON."
      ),
    ],
  }
}

function normalizeChapterCandidate(
  value: AiEbookGeneration,
  input: LiveChapterGenerationInput
): AiEbookGeneration {
  const fallback = fallbackChapterEbook(input.outline, input)
  const chapters = Array.isArray(value.chapters) && value.chapters.length > 0
    ? value.chapters.map((chapter, chapterIndex) =>
        normalizeChapter(chapter, input.outline.chapters?.[chapterIndex], input, chapterIndex)
      )
    : fallback.chapters

  return {
    title: cleanString(value.title) || input.outline.title || fallback.title,
    subtitle: cleanString(value.subtitle) || input.outline.subtitle || fallback.subtitle,
    author: cleanString(value.author) || input.outline.author,
    brand: cleanString(value.brand) || input.outline.brand || fallback.brand,
    theme: value.theme ?? input.outline.theme,
    format: value.format ?? input.outline.format,
    chapters,
    cta: {
      title: cleanString(value.cta?.title) || input.outline.cta?.title || fallback.cta?.title,
      body: cleanString(value.cta?.body) || input.outline.cta?.body || fallback.cta?.body,
      action: cleanString(value.cta?.action) || input.outline.cta?.action || fallback.cta?.action,
      url: cleanString(value.cta?.url) || input.outline.cta?.url,
    },
    metadata: {
      ...(input.outline.metadata ?? {}),
      ...(value.metadata ?? {}),
      generationStage: "chapters",
    },
  }
}

function normalizeChapter(
  chapter: AiChapterGeneration,
  outlineChapter: AiChapterGeneration | undefined,
  input: LiveChapterGenerationInput,
  chapterIndex: number
): AiChapterGeneration {
  const sections = Array.isArray(chapter.sections) && chapter.sections.length > 0
    ? chapter.sections.slice(0, MAX_SECTIONS_PER_CHAPTER).map((section, sectionIndex) =>
        normalizeSection(section, outlineChapter?.sections?.[sectionIndex], input, chapterIndex, sectionIndex)
      )
    : fallbackSections(outlineChapter, input, chapterIndex)

  return {
    title: cleanString(chapter.title) || cleanString(outlineChapter?.title) || `Chapter ${chapterIndex + 1}`,
    intro:
      cleanString(chapter.intro) ||
      cleanString(outlineChapter?.intro) ||
      "This chapter turns the outline into practical, structured guidance.",
    sections,
  }
}

function normalizeSection(
  section: AiSectionGeneration,
  outlineSection: AiSectionGeneration | undefined,
  input: LiveChapterGenerationInput,
  chapterIndex: number,
  sectionIndex: number
): AiSectionGeneration {
  const title =
    cleanString(section.title) ||
    cleanString(outlineSection?.title) ||
    `Section ${chapterIndex + 1}.${sectionIndex + 1}`
  const normalizedBlocks = Array.isArray(section.blocks) && section.blocks.length > 0
    ? section.blocks.map(normalizeGeneratedBlock).filter(hasUsableBlock)
    : []
  const blocks = normalizedBlocks.length > 0
    ? normalizedBlocks
    : fallbackBlocks(title, input, chapterIndex, sectionIndex)

  return {
    title,
    blocks,
  }
}

function hasUsableBlock(block: AiBlockGeneration): boolean {
  const type = cleanString(block.type)
  if (type === "bullet_list" || type === "numbered_list") {
    return Array.isArray((block as { items?: unknown[] }).items) && (block as { items?: unknown[] }).items!.some((item) => cleanString(item))
  }
  if (type === "comparison_table") {
    const table = block as { headers?: unknown[]; rows?: unknown[][] }
    return Array.isArray(table.headers) && table.headers.some((header) => cleanString(header)) &&
      Array.isArray(table.rows) && table.rows.some((row) => Array.isArray(row) && row.some((cell) => cleanString(cell)))
  }
  if (type === "divider" || type === "spacer") return true
  return blockText(block).trim() !== ""
}

function normalizeGeneratedBlock(block: AiBlockGeneration): AiBlockGeneration {
  const type = cleanString(block.type)
  if (type === "bullet_list" || type === "numbered_list") {
    return {
      type,
      items: Array.isArray((block as { items?: unknown[] }).items)
        ? (block as { items?: unknown[] }).items?.map(String).filter(Boolean)
        : splitListText((block as { text?: string }).text),
    }
  }

  if (type === "comparison_table") {
    const table = block as { headers?: unknown[]; rows?: unknown[][] }
    return {
      type: "comparison_table",
      headers: Array.isArray(table.headers) ? table.headers.map(String) : ["Option", "Best use"],
      rows: Array.isArray(table.rows)
        ? table.rows.map((row) => (Array.isArray(row) ? row.map(String) : [String(row)]))
        : [["Default", "Use as a quick decision aid."]],
    }
  }

  if (type === "workflow_step") {
    return {
      type: "workflow_step",
      title: cleanString((block as { title?: unknown }).title) || "Workflow step",
      text: cleanString((block as { text?: unknown }).text) || "Complete this step before moving on.",
    }
  }

  if (
    [
      "paragraph",
      "heading",
      "subheading",
      "tip_box",
      "warning_box",
      "key_takeaway",
      "prompt_block",
      "cta_box",
    ].includes(type)
  ) {
    return {
      type,
      text: cleanString((block as { text?: unknown }).text) || cleanString((block as { title?: unknown }).title),
    }
  }

  return {
    type: "paragraph",
    text: cleanString((block as { text?: unknown }).text) || "Add practical guidance for this section.",
  }
}

function applyChapterSafeguards(ebook: AiEbookGeneration): {
  ebook: AiEbookGeneration
  issues: AiStructureIssue[]
} {
  const issues: AiStructureIssue[] = []
  const seenHeadings = new Set<string>()
  const chapters = (ebook.chapters ?? []).map((chapter) => {
    const sections = (chapter.sections ?? []).map((section) => {
      const blocks = ensureSectionVariety(
        reduceDuplicateHeadings(
          splitOversizedParagraphs(section.blocks ?? [], issues),
          seenHeadings,
          issues
        ),
        section.title,
        issues
      )
      return { ...section, blocks }
    })
    return { ...chapter, sections: ensureChapterHasContent(sections, chapter.title, issues) }
  })

  return {
    ebook: {
      ...ebook,
      chapters,
      cta: enforceCta(ebook.cta, issues),
    },
    issues,
  }
}

function splitOversizedParagraphs(
  blocks: AiBlockGeneration[],
  issues: AiStructureIssue[]
): AiBlockGeneration[] {
  return blocks.flatMap((block) => {
    const type = cleanString(block.type)
    if (type !== "paragraph") return [block]
    const text = cleanString((block as { text?: unknown }).text)
    if (text.length <= MAX_PARAGRAPH_LENGTH) return [block]

    issues.push(issue("OVERSIZED_BLOCK_SPLIT", "warning", "A long paragraph was split for layout safety.", "Ask for shorter paragraphs."))
    return splitSentences(text, MAX_PARAGRAPH_LENGTH).map((part) => ({ type: "paragraph", text: part }))
  })
}

function reduceDuplicateHeadings(
  blocks: AiBlockGeneration[],
  seen: Set<string>,
  issues: AiStructureIssue[]
): AiBlockGeneration[] {
  return blocks.map((block) => {
    const type = cleanString(block.type)
    if (type !== "heading" && type !== "subheading") return block
    const text = cleanString((block as { text?: unknown }).text)
    const key = text.toLowerCase()
    if (!key || !seen.has(key)) {
      if (key) seen.add(key)
      return block
    }

    issues.push(issue("DUPLICATE_HEADING_REDUCED", "info", `Duplicate heading "${text}" was made more specific.`, "Generate distinct headings."))
    return {
      ...block,
      text: `${text} in practice`,
    }
  })
}

function ensureSectionVariety(
  blocks: AiBlockGeneration[],
  sectionTitle: string | undefined,
  issues: AiStructureIssue[]
): AiBlockGeneration[] {
  const types = new Set(blocks.map((block) => cleanString(block.type)).filter(Boolean))
  if (types.size >= REQUIRED_VARIETY) return blocks

  issues.push(issue("LOW_STRUCTURE_VARIETY", "warning", `Section "${sectionTitle ?? "Untitled"}" has limited block variety.`, "Add lists, callouts, prompts, workflow steps, or tables."))
  return [
    ...blocks,
    { type: "key_takeaway", text: `Focus on the one decision this section helps the reader make.` },
    { type: "prompt_block", text: `Turn "${sectionTitle ?? "this section"}" into a concrete action plan with one next step.` },
  ]
}

function ensureChapterHasContent(
  sections: AiSectionGeneration[],
  chapterTitle: string | undefined,
  issues: AiStructureIssue[]
): AiSectionGeneration[] {
  const blockCount = sections.reduce((sum, section) => sum + (section.blocks?.length ?? 0), 0)
  if (blockCount >= 4) return sections

  issues.push(issue("SPARSE_CHAPTER_REPAIRED", "warning", `Chapter "${chapterTitle ?? "Untitled"}" was sparse.`, "Generate more practical blocks before export."))
  return [
    ...sections,
    {
      title: "Implementation checklist",
      blocks: [
        { type: "bullet_list", items: ["Clarify the reader outcome.", "Apply one tool from the chapter.", "Record the next action."] },
        { type: "cta_box", text: "Use this chapter to complete one practical step before continuing." },
      ],
    },
  ]
}

function enforceCta(
  cta: AiEbookGeneration["cta"],
  issues: AiStructureIssue[]
): AiEbookGeneration["cta"] {
  const action = cleanString(cta?.action)
  const body = cleanString(cta?.body)
  if (action.length >= 12 || body.length >= 30) return cta

  issues.push(issue("WEAK_CTA_REPAIRED", "warning", "CTA was missing or weak.", "Add a clear next action and benefit."))
  return {
    title: cleanString(cta?.title) || "Put the ebook to work",
    body: body || "Use the framework in this ebook to complete one focused implementation session.",
    action: action || "Choose the next step and schedule it now.",
    url: cta?.url,
  }
}

function diagnoseGeneratedChapters(ebook: AiEbookGeneration): AiStructureIssue[] {
  const issues: AiStructureIssue[] = []
  const phraseCounts = new Map<string, number>()

  for (const chapter of ebook.chapters ?? []) {
    for (const section of chapter.sections ?? []) {
      const blocks = section.blocks ?? []
      if (blocks.length > 12) {
        issues.push(issue("DENSE_SECTION", "warning", `Section "${section.title ?? "Untitled"}" has many blocks.`, "Split dense sections before composition."))
      }
      const types = new Set(blocks.map((block) => cleanString(block.type)))
      if (types.size < REQUIRED_VARIETY) {
        issues.push(issue("LOW_STRUCTURE_VARIETY", "info", `Section "${section.title ?? "Untitled"}" uses few block types.`, "Add more structured components."))
      }

      for (const block of blocks) {
        const text = blockText(block)
        const phrase = firstWords(text, 5)
        if (phrase) phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1)
      }
    }
  }

  for (const [phrase, count] of Array.from(phraseCounts.entries())) {
    if (count >= 3) {
      issues.push(issue("REPETITIVE_PHRASING", "warning", `Phrase "${phrase}" appears repeatedly.`, "Vary repeated sentence openings and examples."))
    }
  }

  return issues
}

function fallbackChapterEbook(
  outline: AiEbookGeneration,
  input: Pick<LiveChapterGenerationInput, "audience" | "tone">
): AiEbookGeneration {
  return {
    ...outline,
    chapters: (outline.chapters ?? []).map((chapter, chapterIndex) => ({
      title: chapter.title ?? `Chapter ${chapterIndex + 1}`,
      intro: chapter.intro ?? "A practical chapter with structured guidance.",
      sections: fallbackSections(chapter, input, chapterIndex),
    })),
    cta: outline.cta ?? {
      title: "Put the ebook to work",
      body: "Use this guide to complete one practical implementation session.",
      action: "Choose the next step and schedule it now.",
    },
  }
}

function fallbackSections(
  outlineChapter: AiChapterGeneration | undefined,
  input: Pick<LiveChapterGenerationInput, "audience" | "tone">,
  chapterIndex: number
): AiSectionGeneration[] {
  const sections = outlineChapter?.sections?.length
    ? outlineChapter.sections
    : [{ title: "Core idea" }, { title: "Practical framework" }, { title: "Next steps" }]

  return sections.map((section, sectionIndex) => ({
    title: section.title ?? `Section ${chapterIndex + 1}.${sectionIndex + 1}`,
    blocks: fallbackBlocks(section.title, input, chapterIndex, sectionIndex),
  }))
}

function fallbackBlocks(
  sectionTitle: string | undefined,
  input: Pick<LiveChapterGenerationInput, "audience" | "tone">,
  chapterIndex: number,
  sectionIndex: number
): AiBlockGeneration[] {
  const audience = input.audience ?? "the reader"
  const title = sectionTitle ?? `Section ${chapterIndex + 1}.${sectionIndex + 1}`
  const actionLabel = title.toLowerCase()
  return [
    {
      type: "paragraph",
      text: `${title} gives ${audience} a practical way to understand the topic, connect it to the chapter goal, and decide what matters most.`,
    },
    {
      type: "bullet_list",
      items: [
        `Define what ${actionLabel} means in this chapter.`,
        `Connect ${actionLabel} to the reader's main question.`,
        `Summarize the clearest lesson before moving on.`,
      ],
    },
    {
      type: "tip_box",
      text: `Keep ${actionLabel} focused on one clear idea, one concrete example, and one useful takeaway.`,
    },
    generatePromptBlock(`Create an action checklist for ${title}`, audience) as AiBlockGeneration,
    {
      type: "workflow_step",
      title: "Apply the idea",
      text: `Write one sentence explaining why ${actionLabel} matters, then connect it to the next section.`,
    },
  ]
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
      const ebook = coerceChapterObject(parsed)
      if (ebook) return ebook
    } catch {
      continue
    }
  }
  return null
}

function coerceChapterObject(value: unknown): AiEbookGeneration | null {
  if (typeof value === "string") return parseJsonFromText(value)
  if (typeof value !== "object" || value === null) return null
  return isChapterCandidate(value) ? (value as AiEbookGeneration) : null
}

function isChapterCandidate(value: unknown): value is AiEbookGeneration {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as { chapters?: unknown }
  return Array.isArray(candidate.chapters)
}

function splitListText(text: unknown) {
  return cleanString(text)
    .split(/\n|;|,/)
    .map((item) => item.replace(/^[-*+\d.)\s]+/, "").trim())
    .filter(Boolean)
}

function splitSentences(text: string, maxLength: number) {
  const parts: string[] = []
  let buffer = ""
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (buffer && `${buffer} ${sentence}`.length > maxLength) {
      parts.push(buffer)
      buffer = sentence
    } else {
      buffer = buffer ? `${buffer} ${sentence}` : sentence
    }
  }
  if (buffer) parts.push(buffer)
  return parts.length > 0 ? parts : [text.slice(0, maxLength)]
}

function blockText(block: AiBlockGeneration | ComposerBlock) {
  const loose = block as {
    text?: unknown
    items?: unknown
    headers?: unknown
    rows?: unknown
  }
  if (typeof loose.text === "string") return loose.text
  if (Array.isArray(loose.items)) return loose.items.map(String).join(" ")
  if (block.type === "comparison_table") {
    const headers = Array.isArray(loose.headers) ? loose.headers.map(String) : []
    const rows = Array.isArray(loose.rows)
      ? loose.rows.flatMap((row) => (Array.isArray(row) ? row.map(String) : [String(row)]))
      : []
    return [...headers, ...rows].join(" ")
  }
  return ""
}

function firstWords(text: string, count: number) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean)
  if (words.length < count) return ""
  return words.slice(0, count).join(" ")
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
