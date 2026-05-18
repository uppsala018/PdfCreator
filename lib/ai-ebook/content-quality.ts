import type { AiStructureIssue } from "@/lib/ai-ebook/ebook-generation-schema"
import type { ComposerBlock, ComposerChapter, ComposerEbook, ComposerSection } from "@/lib/export/project-to-schema"

const FORBIDDEN_PATTERNS: Array<{ code: string; pattern: RegExp }> = [
  { code: "LEAKED_PROMPT_LABEL", pattern: /\bPROMPT\b/i },
  { code: "LEAKED_TODO", pattern: /\b(?:TODO|placeholder|scaffold|regenerate this section)\b/i },
  { code: "GENERIC_DECISION_HELPER", pattern: /focus on the one decision this section helps the reader make/i },
  { code: "GENERIC_CORE_IDEA", pattern: /\b(?:core idea|decision framework)\s+gives\b/i },
  { code: "GENERIC_ACTION_PROMPT", pattern: /turn\s+["“][^"”]+["”]\s+into a concrete action plan/i },
]

const GENERIC_TITLES = new Set(["apply the idea", "core idea", "decision framework", "practical application"])

export function repairComposerEbookContent(ebook: ComposerEbook): {
  ebook: ComposerEbook
  issues: AiStructureIssue[]
} {
  const issues: AiStructureIssue[] = []
  const repaired: ComposerEbook = {
    ...ebook,
    chapters: ebook.chapters.map((chapter) => repairChapter(chapter, ebook.title, issues)),
  }
  return { ebook: repaired, issues }
}

export function containsLeakedAuthoringText(value: string): boolean {
  return FORBIDDEN_PATTERNS.some(({ pattern }) => pattern.test(value))
}

function repairChapter(chapter: ComposerChapter, ebookTitle: string, issues: AiStructureIssue[]): ComposerChapter {
  return {
    ...chapter,
    intro: repairText(chapter.intro, chapter.title, ebookTitle, issues),
    sections: chapter.sections.map((section) => repairSection(section, chapter.title, ebookTitle, issues)),
  }
}

function repairSection(
  section: ComposerSection,
  chapterTitle: string,
  ebookTitle: string,
  issues: AiStructureIssue[]
): ComposerSection {
  const title = naturalTitle(section.title, chapterTitle, issues)
  const blocks = section.blocks.flatMap((block) => repairBlock(block, title, ebookTitle, issues))
  const nonEmpty = blocks.filter((block) => blockHasContent(block))
  return {
    ...section,
    title,
    blocks: ensureUsefulDepth(nonEmpty, title, ebookTitle, issues),
  }
}

function repairBlock(
  block: ComposerBlock,
  sectionTitle: string,
  ebookTitle: string,
  issues: AiStructureIssue[]
): ComposerBlock[] {
  switch (block.type) {
    case "prompt_block":
      issues.push(issue("PROMPT_BLOCK_REWRITTEN", "warning", "Prompt block was rewritten as reader-facing prose.", sectionTitle))
      return [{ type: "paragraph", text: promptToProse(block.text, sectionTitle, ebookTitle) }]
    case "tip_box":
    case "key_takeaway":
    case "cta_box": {
      const text = repairText(block.text, sectionTitle, ebookTitle, issues)
      if (isGenericLeak(block.text)) {
        return [{ type: "paragraph", text: fallbackProse(sectionTitle, ebookTitle) }]
      }
      return [{ type: "paragraph", text }]
    }
    case "workflow_step": {
      const title = naturalTitle(block.title, sectionTitle, issues)
      const text = repairText(block.text, sectionTitle, ebookTitle, issues)
      return [
        { type: "subheading", text: title },
        { type: "paragraph", text: text || fallbackProse(sectionTitle, ebookTitle) },
      ]
    }
    case "paragraph":
    case "heading":
    case "subheading":
    case "warning_box":
      return [{ ...block, text: repairText(block.text, sectionTitle, ebookTitle, issues) }]
    case "bullet_list":
    case "numbered_list":
      return [{ ...block, items: block.items.map((item) => repairText(item, sectionTitle, ebookTitle, issues)).filter(Boolean) }]
    case "comparison_table":
      return [{
        ...block,
        headers: block.headers.map((header) => repairText(header, sectionTitle, ebookTitle, issues)),
        rows: block.rows.map((row) => row.map((cell) => repairText(cell, sectionTitle, ebookTitle, issues))),
      }]
    default:
      return [block]
  }
}

function repairText(value: string, sectionTitle: string, ebookTitle: string, issues: AiStructureIssue[]) {
  const text = value.replace(/\s+/g, " ").trim()
  if (!text) return ""
  if (!isGenericLeak(text)) return stripAuthoringPrefixes(text)

  for (const { code, pattern } of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      issues.push(issue(code, "warning", "Internal authoring text was removed from final ebook content.", sectionTitle))
    }
  }
  return fallbackProse(sectionTitle, ebookTitle)
}

function stripAuthoringPrefixes(value: string) {
  return value
    .replace(/^\s*(?:PROMPT|PRO TIP|TODO)\s*:?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function promptToProse(value: string, sectionTitle: string, ebookTitle: string) {
  const cleaned = stripAuthoringPrefixes(value)
  if (!cleaned || isGenericLeak(cleaned)) return fallbackProse(sectionTitle, ebookTitle)
  if (/^(create|write|turn|use|choose|list|describe)\b/i.test(cleaned)) {
    return `${sectionTitle} becomes more useful when it is turned into a concrete routine: ${cleaned.replace(/\.$/, "").toLowerCase()}.`
  }
  return cleaned
}

function naturalTitle(value: string, fallback: string, issues: AiStructureIssue[]) {
  const title = stripAuthoringPrefixes(value)
  if (!title || GENERIC_TITLES.has(title.toLowerCase())) {
    issues.push(issue("GENERIC_HEADING_REWRITTEN", "warning", "Generic heading was rewritten for final ebook content.", fallback))
    return fallback
  }
  return title
}

function ensureUsefulDepth(
  blocks: ComposerBlock[],
  sectionTitle: string,
  ebookTitle: string,
  issues: AiStructureIssue[]
): ComposerBlock[] {
  const textWords = blocks.reduce((sum, block) => sum + countWords(blockText(block)), 0)
  if (textWords >= 55 && blocks.length >= 2) return blocks

  issues.push(issue("THIN_SECTION_EXPANDED", "info", "Thin section was expanded with reader-facing prose.", sectionTitle))
  return [
    ...blocks,
    { type: "paragraph", text: fallbackProse(sectionTitle, ebookTitle) },
    { type: "paragraph", text: practicalProse(sectionTitle, ebookTitle) },
  ]
}

function fallbackProse(sectionTitle: string, ebookTitle: string) {
  return `${sectionTitle} should be understood as a practical part of ${ebookTitle}. It explains what matters, why it matters, and how the reader can use the idea without relying on vague advice or unfinished notes.`
}

function practicalProse(sectionTitle: string, ebookTitle: string) {
  return `A strong approach to ${sectionTitle.toLowerCase()} is to start with the reader's immediate situation, give one concrete example from ${ebookTitle}, and end with a clear next step that feels realistic to apply.`
}

function isGenericLeak(value: string) {
  return FORBIDDEN_PATTERNS.some(({ pattern }) => pattern.test(value))
}

function blockHasContent(block: ComposerBlock) {
  if ("text" in block) return block.text.trim().length > 0
  if ("items" in block) return block.items.length > 0
  if (block.type === "comparison_table") return block.headers.length > 0 && block.rows.length > 0
  return true
}

function blockText(block: ComposerBlock): string {
  if (block.type === "workflow_step") return `${block.title} ${block.text}`
  if ("text" in block) return block.text
  if ("items" in block) return block.items.join(" ")
  if (block.type === "comparison_table") return [...block.headers, ...block.rows.flat()].join(" ")
  return ""
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length
}

function issue(code: string, severity: AiStructureIssue["severity"], message: string, component: string): AiStructureIssue {
  return {
    code,
    severity,
    message,
    suggestedFix: "Rewrite the block as finished reader-facing ebook prose.",
    component,
  }
}
