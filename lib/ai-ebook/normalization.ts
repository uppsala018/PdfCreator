import type { ComposerBlock, ComposerChapter, ComposerEbook, ComposerSection } from "@/lib/export/project-to-schema"
import { toComposerTheme } from "@/lib/export/theme-mapping"
import { coerceLooseBlock, generateCtaStructure } from "./block-generation"
import {
  AI_BLOCK_TYPES,
  type AiBlockGeneration,
  type AiEbookGeneration,
  type AiSectionGeneration,
  type AiStructureIssue,
  type NormalizedAiEbook,
} from "./ebook-generation-schema"

const MAX_TEXT_LENGTH = 1800
const MAX_PROMPT_LENGTH = 2400
const MAX_HEADING_LENGTH = 110
const MAX_BLOCKS_PER_SECTION = 14
const MAX_SECTIONS_PER_CHAPTER = 8

export function normalizeAiEbookGeneration(input: AiEbookGeneration): NormalizedAiEbook {
  const issues: AiStructureIssue[] = []
  const chapters = normalizeChapters(input, issues)
  const ctaText = [input.cta?.body, input.cta?.action].filter(Boolean).join(" ").trim()

  const ebook: ComposerEbook = {
    title: cleanText(input.title, "Untitled AI Ebook", MAX_HEADING_LENGTH, issues, "title"),
    subtitle: cleanText(input.subtitle, "A professionally composed structured ebook.", 220, issues, "subtitle"),
    author: cleanText(input.author, "", 120, issues, "author"),
    brand: cleanText(input.brand, "Ebook Studio", 80, issues, "brand"),
    theme: toComposerTheme(input.theme ?? "luxury-black-gold"),
    chapters,
    back_cover_title: cleanText(input.cta?.title, "Continue the work", 90, issues, "back_cover_title"),
    back_cover_body: cleanText(input.cta?.body, "Use this guide as a practical operating system, not a one-time read.", 420, issues, "back_cover_body"),
    back_cover_cta: cleanText(input.cta?.url ?? input.cta?.action, ctaText || "Start with the first checklist.", 180, issues, "back_cover_cta"),
  }

  if (!input.cta?.action && !input.cta?.url) {
    issues.push(issue("MISSING_CTA", "warning", "AI output did not include a clear CTA.", "Ask the model for one final next-action CTA."))
  }

  return { ebook, issues }
}

export function normalizeAiBlocks(blocks: AiBlockGeneration[] | undefined, issues: AiStructureIssue[]): ComposerBlock[] {
  const normalized = (blocks ?? []).flatMap((block) => normalizeBlock(block, issues))
  if (normalized.length > MAX_BLOCKS_PER_SECTION) {
    issues.push(issue("SECTION_TOO_DENSE", "warning", "A section contains many blocks.", "Split dense AI output into smaller sections."))
  }
  return normalized.slice(0, MAX_BLOCKS_PER_SECTION)
}

export function sanitizeSpacingAndTextLengths(block: ComposerBlock, issues: AiStructureIssue[]): ComposerBlock {
  if ("text" in block) {
    const max = block.type === "prompt_block" ? MAX_PROMPT_LENGTH : block.type === "heading" || block.type === "subheading" ? MAX_HEADING_LENGTH : MAX_TEXT_LENGTH
    return { ...block, text: cleanText(block.text, "", max, issues, block.type) } as ComposerBlock
  }
  if ("items" in block) {
    const items = block.items.map((item) => cleanText(item, "", 240, issues, block.type)).filter(Boolean).slice(0, 12)
    return { ...block, items } as ComposerBlock
  }
  if (block.type === "comparison_table") return repairTable(block, issues)
  return block
}

export function splitOversizedSections(chapter: ComposerChapter, issues: AiStructureIssue[]): ComposerChapter {
  const sections: ComposerSection[] = []
  for (const section of chapter.sections) {
    if (section.blocks.length <= MAX_BLOCKS_PER_SECTION) {
      sections.push(section)
      continue
    }
    issues.push(issue("SECTION_SPLIT", "info", `Section "${section.title}" was split for safer layout.`, "Keep AI sections focused around one idea."))
    for (let index = 0; index < section.blocks.length; index += MAX_BLOCKS_PER_SECTION) {
      sections.push({
        title: index === 0 ? section.title : `${section.title} continued`,
        blocks: section.blocks.slice(index, index + MAX_BLOCKS_PER_SECTION),
      })
    }
  }
  return { ...chapter, sections }
}

function normalizeChapters(input: AiEbookGeneration, issues: AiStructureIssue[]): ComposerChapter[] {
  const rawChapters = input.chapters ?? []
  if (rawChapters.length === 0) {
    issues.push(issue("EMPTY_AI_CHAPTERS", "warning", "AI output did not include chapters.", "Generate at least three chapters with sections."))
  }

  const chapters = rawChapters.map((chapter, index) =>
    splitOversizedSections(
      {
        title: cleanText(chapter.title, `Chapter ${index + 1}`, MAX_HEADING_LENGTH, issues, "chapter"),
        intro: cleanText(chapter.intro, "", 420, issues, "chapter_intro"),
        sections: normalizeSections(chapter.sections, index + 1, issues),
      },
      issues
    )
  )

  return chapters.length > 0
    ? chapters
    : [
        {
          title: "Foundation",
          intro: "This fallback chapter was created because the AI output was incomplete.",
          sections: [{ title: "Overview", blocks: [generateCtaStructure("Regenerate the ebook with chapters, sections, and blocks.")] }],
        },
      ]
}

function normalizeSections(sections: AiSectionGeneration[] | undefined, chapterNumber: number, issues: AiStructureIssue[]): ComposerSection[] {
  const rawSections = (sections ?? []).slice(0, MAX_SECTIONS_PER_CHAPTER)
  if (rawSections.length === 0) {
    issues.push(issue("EMPTY_AI_SECTION", "warning", `Chapter ${chapterNumber} has no sections.`, "Generate at least one section with practical blocks."))
  }

  return rawSections.length > 0
    ? rawSections.map((section, index) => ({
        title: cleanText(section.title, `Section ${chapterNumber}.${index + 1}`, MAX_HEADING_LENGTH, issues, "section"),
        blocks: ensureNonEmptyBlocks(normalizeAiBlocks(section.blocks, issues), issues),
      }))
    : [{ title: `Section ${chapterNumber}.1`, blocks: [generateCtaStructure("Regenerate this section with useful content.")] }]
}

function normalizeBlock(raw: AiBlockGeneration, issues: AiStructureIssue[]): ComposerBlock[] {
  const loose = raw as {
    text?: unknown
    title?: unknown
    items?: unknown[]
    headers?: unknown[]
    rows?: unknown[][]
    size?: unknown
  }
  const blockType = String(raw.type ?? "").trim()
  if (!AI_BLOCK_TYPES.includes(blockType as ComposerBlock["type"])) {
    issues.push(issue("UNSUPPORTED_AI_BLOCK", "warning", `Unsupported AI block "${blockType || "missing"}" was coerced.`, "Use one of the canonical AI block types."))
    return [sanitizeSpacingAndTextLengths(coerceLooseBlock(raw), issues)]
  }

  switch (blockType) {
    case "paragraph":
    case "heading":
    case "subheading":
    case "tip_box":
    case "warning_box":
    case "key_takeaway":
    case "prompt_block":
    case "cta_box":
      return [sanitizeSpacingAndTextLengths({ type: blockType, text: String(loose.text ?? "") } as ComposerBlock, issues)]
    case "bullet_list":
    case "numbered_list":
      return [sanitizeSpacingAndTextLengths({ type: blockType, items: Array.isArray(loose.items) ? loose.items.map(String) : [] }, issues)]
    case "workflow_step":
      return [
        {
          type: "workflow_step",
          title: cleanText(loose.title, "Workflow step", 80, issues, "workflow_step"),
          text: cleanText(loose.text, "", MAX_TEXT_LENGTH, issues, "workflow_step"),
        },
      ]
    case "comparison_table":
      return [
        repairTable(
          {
            type: "comparison_table",
            headers: (loose.headers ?? []).map(String),
            rows: (loose.rows ?? []).map((row) => row.map(String)),
          },
          issues
        ),
      ]
    case "divider":
      return [{ type: "divider" }]
    case "spacer":
      return [{ type: "spacer", size: loose.size === "small" || loose.size === "large" ? loose.size : "medium" }]
    default:
      return [sanitizeSpacingAndTextLengths(coerceLooseBlock(raw), issues)]
  }
}

function repairTable(block: Extract<ComposerBlock, { type: "comparison_table" }>, issues: AiStructureIssue[]): ComposerBlock {
  const headers = block.headers.map((header) => cleanText(header, "Column", 80, issues, "comparison_table")).filter(Boolean)
  const safeHeaders = headers.length >= 2 ? headers.slice(0, 5) : ["Item", "Details"]
  const rows = block.rows
    .map((row) => row.slice(0, safeHeaders.length).map((cell) => cleanText(cell, "", 180, issues, "comparison_table")))
    .filter((row) => row.some(Boolean))
    .map((row) => [...row, ...Array(Math.max(0, safeHeaders.length - row.length)).fill("")])
    .slice(0, 10)

  if (safeHeaders.length !== block.headers.length || rows.length !== block.rows.length || rows.some((row) => row.length !== safeHeaders.length)) {
    issues.push(issue("MALFORMED_TABLE_REPAIRED", "warning", "A comparison table was repaired.", "Ask the AI to return consistent headers and rows."))
  }

  return { type: "comparison_table", headers: safeHeaders, rows: rows.length > 0 ? rows : [["Add a row", "Describe the comparison"]] }
}

function ensureNonEmptyBlocks(blocks: ComposerBlock[], issues: AiStructureIssue[]): ComposerBlock[] {
  const usable = blocks.filter((block) => {
    if ("text" in block) return block.text.trim() !== ""
    if ("items" in block) return block.items.length > 0
    if (block.type === "comparison_table") return block.headers.length > 0 && block.rows.length > 0
    return true
  })
  if (usable.length === 0) {
    issues.push(issue("EMPTY_BLOCKS_REPAIRED", "warning", "A section had no usable blocks.", "Generate at least one paragraph, list, callout, table, prompt, or CTA."))
    return [generateCtaStructure("Regenerate this section with a practical takeaway.")]
  }
  return usable
}

function cleanText(value: unknown, fallback: string, maxLength: number, issues: AiStructureIssue[], component: string): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim() || fallback
  if (text.length <= maxLength) return text
  issues.push(issue("TEXT_TRIMMED", "info", `${component} text was trimmed for layout safety.`, "Ask the AI for shorter, more scannable copy.", component))
  return `${text.slice(0, maxLength - 1).trim()}...`
}

function issue(code: string, severity: AiStructureIssue["severity"], message: string, suggestedFix: string, component?: string): AiStructureIssue {
  return { code, severity, message, suggestedFix, component }
}
