import {
  detectPlainTextHeading,
  isLikelyChapterHeading,
} from "@/lib/ebook-ingestion/heading-detection"
import { countWords, buildIngestionDiagnostics } from "@/lib/ebook-ingestion/ingestion-diagnostics"
import { blockId, parseMarkdownSource } from "@/lib/ebook-ingestion/markdown-parser"
import type {
  SourceBlock,
  SourceDocument,
  SourceHeading,
  SourceInputKind,
  SourceSection,
} from "@/lib/ebook-ingestion/source-types"

export interface NormalizeSourceInput {
  text: string
  kind: SourceInputKind
  title?: string
}

export function normalizeSource(input: NormalizeSourceInput): SourceDocument {
  const sanitizedText = sanitizeSourceText(input.text)
  const parsed =
    input.kind === "markdown"
      ? parseMarkdownSource(sanitizedText)
      : parsePlainTextSource(sanitizedText)
  const sections = buildSections(parsed.blocks, parsed.headings)
  const headings = parsed.headings
  const diagnostics = buildIngestionDiagnostics({
    sanitizedText,
    sections,
    blocks: parsed.blocks,
    headings,
    malformedMarkdownLines: parsed.malformedLines,
  })

  return {
    id: "source-document",
    rawText: input.text,
    sanitizedText,
    metadata: {
      title: input.title ?? headings[0]?.text,
      inputKind: input.kind,
      originalLength: input.text.length,
      sanitizedLength: sanitizedText.length,
      wordCount: countWords(sanitizedText),
      lineCount: sanitizedText ? sanitizedText.split("\n").length : 0,
    },
    sections,
    hierarchy: {
      headings,
      maxDepth: headings.reduce((max, heading) => Math.max(max, heading.depth), 0),
      likelyChapterTitles: headings.filter(isLikelyChapterHeading).map((heading) => heading.text),
      hasExplicitStructure: headings.length > 0,
    },
    diagnostics,
  }
}

export function sanitizeSourceText(text: string) {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim()
}

function parsePlainTextSource(text: string): {
  blocks: SourceBlock[]
  headings: SourceHeading[]
  malformedLines: number[]
} {
  const lines = text.split("\n")
  const blocks: SourceBlock[] = []
  const headings: SourceHeading[] = []
  let paragraphLines: Array<{ text: string; lineNumber: number }> = []
  let listItems: Array<{ text: string; lineNumber: number }> = []

  function flushParagraph() {
    if (paragraphLines.length === 0) return
    blocks.push({
      id: blockId("paragraph", blocks.length),
      type: "paragraph",
      text: paragraphLines.map((line) => line.text).join("\n"),
      lineStart: paragraphLines[0].lineNumber,
      lineEnd: paragraphLines[paragraphLines.length - 1].lineNumber,
    })
    paragraphLines = []
  }

  function flushList() {
    if (listItems.length === 0) return
    blocks.push({
      id: blockId("list", blocks.length),
      type: "list",
      text: listItems.map((item) => item.text).join("\n"),
      lineStart: listItems[0].lineNumber,
      lineEnd: listItems[listItems.length - 1].lineNumber,
      listItems: listItems.map((item) => item.text),
    })
    listItems = []
  }

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1
    const line = lines[index].trim()

    if (line === "") {
      flushList()
      flushParagraph()
      continue
    }

    const heading = detectPlainTextHeading(line, lineNumber)
    if (heading) {
      flushList()
      flushParagraph()
      headings.push(heading)
      blocks.push({
        id: blockId("heading", blocks.length),
        type: "heading",
        text: heading.text,
        lineStart: lineNumber,
        lineEnd: lineNumber,
        headingDepth: heading.depth,
      })
      continue
    }

    const listMatch = line.match(/^([-*+]|\d+[.)])\s+(.+)$/)
    if (listMatch) {
      flushParagraph()
      listItems.push({ text: listMatch[2].trim(), lineNumber })
      continue
    }

    flushList()
    paragraphLines.push({ text: line, lineNumber })
  }

  flushList()
  flushParagraph()

  return { blocks, headings, malformedLines: [] }
}

function buildSections(blocks: SourceBlock[], headings: SourceHeading[]): SourceSection[] {
  const sections: SourceSection[] = []
  let current: SourceSection | null = null

  for (const block of blocks) {
    if (block.type === "heading") {
      if (current) {
        current.lineEnd = block.lineStart - 1
        sections.push(current)
      }

      const heading = headings.find((candidate) => candidate.lineNumber === block.lineStart)
      current = {
        id: `section-${sections.length + 1}`,
        title: block.text,
        depth: block.headingDepth ?? heading?.depth ?? 1,
        lineStart: block.lineStart,
        lineEnd: block.lineEnd,
        blocks: [],
        likelyChapterBreak: heading ? isLikelyChapterHeading(heading) : block.headingDepth === 1,
      }
      continue
    }

    if (!current) {
      current = {
        id: "section-1",
        title: "Untitled source",
        depth: 1,
        lineStart: block.lineStart,
        lineEnd: block.lineEnd,
        blocks: [],
        likelyChapterBreak: true,
      }
    }

    current.blocks.push(block)
    current.lineEnd = block.lineEnd
  }

  if (current) sections.push(current)

  return sections
}
