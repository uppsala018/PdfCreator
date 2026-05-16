import type { ComposerEbook } from "@/lib/export/project-to-schema"
import type { AiStructureIssue } from "./ebook-generation-schema"

export function diagnoseAiGeneratedStructure(ebook: ComposerEbook): AiStructureIssue[] {
  const issues: AiStructureIssue[] = []
  const headings = new Map<string, number>()

  if (ebook.chapters.length < 2) {
    issues.push(issue("SPARSE_EBOOK", "warning", "The ebook has fewer than two chapters.", "Generate a richer outline before professional export."))
  }

  for (const chapter of ebook.chapters) {
    const blockCount = chapter.sections.reduce((sum, section) => sum + section.blocks.length, 0)
    if (blockCount > 45) {
      issues.push(issue("EXCESSIVE_CHAPTER_LENGTH", "warning", `Chapter "${chapter.title}" has many blocks.`, "Split long chapters into smaller chapters or sections.", chapter.title))
    }
    if (blockCount < 3) {
      issues.push(issue("SPARSE_CHAPTER", "info", `Chapter "${chapter.title}" is sparse.`, "Add examples, callouts, prompts, or a table if the chapter feels thin.", chapter.title))
    }

    trackHeading(headings, chapter.title)
    for (const section of chapter.sections) {
      trackHeading(headings, section.title)
      if (section.blocks.length > 18) {
        issues.push(issue("SUSPICIOUS_BLOCK_DENSITY", "warning", `Section "${section.title}" is dense.`, "Break the section into focused subsections.", section.title))
      }

      for (const block of section.blocks) {
        if ("text" in block && block.text.length > 1600) {
          issues.push(issue("LONG_UNBROKEN_PROSE", "warning", `${block.type} contains long unbroken text.`, "Split long prose into paragraphs, lists, or callouts.", block.type))
        }
        if (block.type === "comparison_table") {
          const malformedRows = block.rows.some((row) => row.length !== block.headers.length)
          if (malformedRows) {
            issues.push(issue("MALFORMED_TABLE", "warning", "A comparison table has inconsistent row lengths.", "Normalize all table rows to match the header count.", section.title))
          }
        }
      }
    }
  }

  if (!ebook.back_cover_cta.trim()) {
    issues.push(issue("MISSING_BACK_COVER_CTA", "warning", "The generated ebook has no back-cover CTA.", "Add a next step, URL, or offer."))
  }

  headings.forEach((count, heading) => {
    if (count > 1) {
      issues.push(issue("REPETITIVE_HEADING", "info", `Heading "${heading}" appears ${count} times.`, "Use more specific headings to improve TOC quality.", heading))
    }
  })

  return issues
}

function trackHeading(map: Map<string, number>, heading: string): void {
  const key = heading.trim().toLowerCase()
  if (!key) return
  map.set(key, (map.get(key) ?? 0) + 1)
}

function issue(code: string, severity: AiStructureIssue["severity"], message: string, suggestedFix: string, component?: string): AiStructureIssue {
  return { code, severity, message, suggestedFix, component }
}
