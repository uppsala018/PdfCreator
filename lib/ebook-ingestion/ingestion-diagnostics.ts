import type {
  IngestionDiagnostic,
  SourceBlock,
  SourceHeading,
  SourceSection,
} from "@/lib/ebook-ingestion/source-types"

export interface BuildIngestionDiagnosticsInput {
  sanitizedText: string
  sections: SourceSection[]
  blocks: SourceBlock[]
  headings: SourceHeading[]
  malformedMarkdownLines?: number[]
}

const GIANT_PARAGRAPH_WORDS = 220
const SPARSE_SOURCE_WORDS = 80
const EXCESSIVE_HEADING_DEPTH = 4

export function buildIngestionDiagnostics(
  input: BuildIngestionDiagnosticsInput
): IngestionDiagnostic[] {
  const diagnostics: IngestionDiagnostic[] = []
  const wordCount = countWords(input.sanitizedText)

  if (wordCount === 0) {
    diagnostics.push({
      code: "empty_source",
      severity: "error",
      message: "Source text is empty after sanitization.",
    })
  } else if (wordCount < SPARSE_SOURCE_WORDS) {
    diagnostics.push({
      code: "sparse_source",
      severity: "warning",
      message: "Source text is short and may need expansion before ebook generation.",
    })
  }

  for (const section of input.sections) {
    const sectionWords = countWords(section.blocks.map((block) => block.text).join(" "))
    if (sectionWords === 0) {
      diagnostics.push({
        code: "empty_section",
        severity: "warning",
        message: `Section "${section.title}" has no body content.`,
        sectionId: section.id,
        lineNumber: section.lineStart,
      })
    }
  }

  for (const block of input.blocks) {
    if (block.type === "paragraph" && countWords(block.text) > GIANT_PARAGRAPH_WORDS) {
      diagnostics.push({
        code: "giant_paragraph",
        severity: "warning",
        message: "A paragraph is very long and should be split before generation.",
        lineNumber: block.lineStart,
      })
    }
  }

  for (const heading of input.headings) {
    if (heading.depth > EXCESSIVE_HEADING_DEPTH) {
      diagnostics.push({
        code: "excessive_heading_depth",
        severity: "warning",
        message: `Heading depth ${heading.depth} may be too deep for ebook structure.`,
        lineNumber: heading.lineNumber,
      })
    }
  }

  for (const lineNumber of input.malformedMarkdownLines ?? []) {
    diagnostics.push({
      code: "malformed_markdown",
      severity: "warning",
      message: "Markdown heading syntax appears malformed and was treated as body text.",
      lineNumber,
    })
  }

  return diagnostics
}

export function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}
