import type { SourceBlock, SourceHeading } from "@/lib/ebook-ingestion/source-types"
import { detectMarkdownHeading } from "@/lib/ebook-ingestion/heading-detection"

export interface ParsedMarkdown {
  blocks: SourceBlock[]
  headings: SourceHeading[]
  malformedLines: number[]
}

export function parseMarkdownSource(text: string): ParsedMarkdown {
  const lines = text.split("\n")
  const blocks: SourceBlock[] = []
  const headings: SourceHeading[] = []
  const malformedLines: number[] = []
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
    const rawLine = lines[index]
    const line = rawLine.trim()

    if (line === "") {
      flushList()
      flushParagraph()
      continue
    }

    const heading = detectMarkdownHeading(line, lineNumber)
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

    if (/^#{1,6}\S/.test(line) || /^#{7,}\s+/.test(line)) {
      malformedLines.push(lineNumber)
    }

    const listMatch = line.match(/^([-*+]|\d+[.)])\s+(.+)$/)
    if (listMatch) {
      flushParagraph()
      listItems.push({ text: listMatch[2].trim(), lineNumber })
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushList()
      flushParagraph()
      blocks.push({
        id: blockId("thematic_break", blocks.length),
        type: "thematic_break",
        text: "",
        lineStart: lineNumber,
        lineEnd: lineNumber,
      })
      continue
    }

    flushList()
    paragraphLines.push({ text: line, lineNumber })
  }

  flushList()
  flushParagraph()

  return { blocks, headings, malformedLines }
}

export function blockId(type: string, index: number) {
  return `${type}-${index + 1}`
}
