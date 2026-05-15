import { v4 as uuidv4 } from "uuid"
import type { Block, BlockType, BlockMetadata } from "./project-schema"

// ─── Text → Blocks ───────────────────────────────────────────────────────────
//
// Rules (applied line-by-line, blank lines are separators):
//   ## text       → subheading  (checked before # to avoid ambiguity)
//   # text        → heading
//   > text        → pro_tip
//   PROMPT: text  → prompt_card
//   ---           → page_break
//   ===           → chapter_divider
//   text | text   → table row   (consecutive pipe-lines = one table block)
//   (blank line)  → flush any open accumulator
//   anything else → paragraph   (consecutive non-blank plain lines = one block)

export function textToBlocks(text: string): Block[] {
  const lines = text.split("\n")
  const blocks: Block[] = []

  // Accumulators — at most one can be non-empty at a time.
  let paraLines: string[] = []
  let tableRows: string[][] = []

  function makeBlock(
    type: BlockType,
    content: string,
    metadata?: BlockMetadata
  ): Block {
    return {
      id: uuidv4(),
      type,
      content,
      ...(metadata !== undefined ? { metadata } : {}),
    }
  }

  function flushPara() {
    if (paraLines.length === 0) return
    blocks.push(makeBlock("paragraph", paraLines.join("\n")))
    paraLines = []
  }

  function flushTable() {
    if (tableRows.length === 0) return
    blocks.push(makeBlock("table", "", { rows: tableRows.map((r) => [...r]) }))
    tableRows = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    // ── blank line ────────────────────────────────────────────────────────
    if (line === "") {
      flushTable()
      flushPara()
      continue
    }

    // ── subheading  (## — must come before heading check) ─────────────────
    if (line.startsWith("## ")) {
      flushTable()
      flushPara()
      blocks.push(makeBlock("subheading", line.slice(3).trim()))
      continue
    }

    // ── heading  (# — single hash + space) ────────────────────────────────
    if (line.startsWith("# ")) {
      flushTable()
      flushPara()
      blocks.push(makeBlock("heading", line.slice(2).trim()))
      continue
    }

    // ── pro tip  (> ) ─────────────────────────────────────────────────────
    if (line.startsWith("> ")) {
      flushTable()
      flushPara()
      blocks.push(makeBlock("pro_tip", line.slice(2).trim()))
      continue
    }

    // ── prompt card  (PROMPT: ) ────────────────────────────────────────────
    if (line.startsWith("PROMPT: ")) {
      flushTable()
      flushPara()
      // "PROMPT: ".length === 8
      blocks.push(makeBlock("prompt_card", line.slice(8).trim()))
      continue
    }

    // ── page break  (exactly ---) ──────────────────────────────────────────
    if (line === "---") {
      flushTable()
      flushPara()
      blocks.push(makeBlock("page_break", ""))
      continue
    }

    // ── chapter divider  (exactly ===) ────────────────────────────────────
    if (line === "===") {
      flushTable()
      flushPara()
      blocks.push(makeBlock("chapter_divider", ""))
      continue
    }

    // ── table row  (any line containing |) ────────────────────────────────
    // Consecutive pipe-lines accumulate into a single table block.
    // A non-pipe line ends the table.
    if (line.includes("|")) {
      flushPara() // can't mix para accumulator with table
      tableRows.push(line.split("|").map((cell) => cell.trim()))
      continue
    }

    // ── paragraph  (everything else) ──────────────────────────────────────
    // Consecutive plain lines accumulate into a single paragraph block,
    // preserving internal newlines so the round-trip is exact.
    flushTable()
    paraLines.push(line)
  }

  // Flush whatever is still open at EOF.
  flushTable()
  flushPara()

  return blocks
}

// ─── Blocks → Text ───────────────────────────────────────────────────────────
//
// Exact reverse of the above. Each block becomes one "segment"; segments are
// joined with a single blank line (\n\n) so the result is ready to parse back.

export function blocksToText(blocks: Block[]): string {
  const segments: string[] = []

  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        segments.push(`# ${block.content}`)
        break

      case "subheading":
        segments.push(`## ${block.content}`)
        break

      case "paragraph":
        // Multi-line paragraphs store internal newlines in content directly.
        segments.push(block.content)
        break

      case "pro_tip":
        segments.push(`> ${block.content}`)
        break

      case "prompt_card":
        segments.push(`PROMPT: ${block.content}`)
        break

      case "table": {
        const rows = block.metadata?.rows ?? []
        // Each row → "cell1 | cell2 | cell3"; rows joined by \n (no blank line
        // between them so the parser sees one uninterrupted table block).
        segments.push(rows.map((row) => row.join(" | ")).join("\n"))
        break
      }

      case "page_break":
        segments.push("---")
        break

      case "chapter_divider":
        segments.push("===")
        break
    }
  }

  // Blank line between every segment — the canonical separator.
  return segments.join("\n\n")
}
