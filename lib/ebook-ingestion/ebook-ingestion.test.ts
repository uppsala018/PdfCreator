import { describe, expect, it } from "vitest"
import { chunkSourceDocument } from "@/lib/ebook-ingestion/chunking"
import { normalizeSource } from "@/lib/ebook-ingestion/normalize-source"

describe("ebook ingestion", () => {
  it("parses markdown headings, lists, paragraphs, and chapter breaks", () => {
    const document = normalizeSource({
      kind: "markdown",
      text: [
        "# Launch Guide",
        "",
        "This guide helps creators launch.",
        "",
        "## Checklist",
        "",
        "- Pick an audience",
        "- Write the promise",
        "",
        "### Notes",
        "",
        "Keep it focused.",
      ].join("\n"),
    })

    expect(document.metadata.title).toBe("Launch Guide")
    expect(document.hierarchy.headings).toEqual([
      { text: "Launch Guide", depth: 1, lineNumber: 1 },
      { text: "Checklist", depth: 2, lineNumber: 5 },
      { text: "Notes", depth: 3, lineNumber: 10 },
    ])
    expect(document.hierarchy.likelyChapterTitles).toEqual(["Launch Guide"])
    expect(document.sections).toHaveLength(3)
    expect(document.sections[1]).toMatchObject({
      title: "Checklist",
      depth: 2,
      likelyChapterBreak: false,
    })
    expect(document.sections[1].blocks[0]).toMatchObject({
      type: "list",
      listItems: ["Pick an audience", "Write the promise"],
    })
  })

  it("normalizes plain text into sections and sanitizes unsafe control characters", () => {
    const document = normalizeSource({
      kind: "plain_text",
      text: "CHAPTER 1: START HERE\u0000\n\nThis is the opening paragraph.\n\n- First step\n- Second step",
    })

    expect(document.sanitizedText).not.toContain("\u0000")
    expect(document.sections).toHaveLength(1)
    expect(document.sections[0]).toMatchObject({
      title: "Chapter 1: Start Here",
      likelyChapterBreak: true,
    })
    expect(document.sections[0].blocks.map((block) => block.type)).toEqual(["paragraph", "list"])
  })

  it("recovers malformed markdown as body text and emits diagnostics", () => {
    const document = normalizeSource({
      kind: "markdown",
      text: [
        "# Valid",
        "",
        "####### Too deep",
        "",
        "#Missing space",
        "",
        "##### Too Detailed",
      ].join("\n"),
    })

    expect(document.sections).toHaveLength(2)
    expect(document.sections[0].blocks.map((block) => block.text)).toContain("####### Too deep")
    expect(document.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "malformed_markdown", lineNumber: 3 }),
        expect.objectContaining({ code: "malformed_markdown", lineNumber: 5 }),
        expect.objectContaining({ code: "excessive_heading_depth", lineNumber: 7 }),
        expect.objectContaining({ code: "empty_section", lineNumber: 7 }),
      ])
    )
  })

  it("chunks source sections for future AI generation", () => {
    const document = normalizeSource({
      kind: "markdown",
      text: [
        "# One",
        "",
        "alpha beta gamma delta epsilon",
        "",
        "# Two",
        "",
        "zeta eta theta iota kappa",
        "",
        "# Three",
        "",
        "lambda mu nu xi omicron",
      ].join("\n"),
    })

    const chunks = chunkSourceDocument(document, { targetWords: 8, maxWords: 12 })

    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toMatchObject({
      id: "source-chunk-1",
      sectionIds: ["section-1"],
      wordCount: 7,
    })
    expect(chunks[1].text).toContain("# Two")
    expect(chunks[2].estimatedTokens).toBeGreaterThan(0)
  })
})
