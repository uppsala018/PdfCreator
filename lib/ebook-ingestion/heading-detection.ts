import type { SourceHeading } from "@/lib/ebook-ingestion/source-types"

const TITLE_CASE_WORDS = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,8}\b/

export function detectMarkdownHeading(line: string, lineNumber: number): SourceHeading | null {
  const match = line.match(/^(#{1,6})\s+(.+?)\s*#*$/)
  if (!match) return null

  return {
    depth: match[1].length,
    text: match[2].trim(),
    lineNumber,
  }
}

export function detectPlainTextHeading(line: string, lineNumber: number): SourceHeading | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  if (trimmed.length > 90) return null
  if (/[.!?]$/.test(trimmed)) return null

  const chapterMatch = trimmed.match(/^(chapter|part|section)\s+\d+[:.\-\s]+(.+)$/i)
  if (chapterMatch) {
    return {
      depth: /^chapter|^part/i.test(trimmed) ? 1 : 2,
      text: trimmed === trimmed.toUpperCase() ? toTitleCase(trimmed) : trimmed,
      lineNumber,
    }
  }

  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) && trimmed.split(/\s+/).length <= 8) {
    return {
      depth: 1,
      text: toTitleCase(trimmed),
      lineNumber,
    }
  }

  if (TITLE_CASE_WORDS.test(trimmed) && trimmed.split(/\s+/).length <= 8) {
    return {
      depth: 2,
      text: trimmed,
      lineNumber,
    }
  }

  return null
}

export function isLikelyChapterHeading(heading: SourceHeading) {
  return heading.depth === 1 || /^(chapter|part)\s+\d+/i.test(heading.text)
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (match) => match.toUpperCase())
}
