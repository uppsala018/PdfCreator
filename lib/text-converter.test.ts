import { describe, it, expect } from "vitest"
import { textToBlocks, blocksToText } from "./text-converter"
import type { Block } from "./project-schema"

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip generated IDs so we can compare block content without caring about UUIDs. */
type NoId = Omit<Block, "id">
function noIds(blocks: Block[]): NoId[] {
  return blocks.map(({ id: _id, ...rest }) => rest)
}

/** Build a minimal block for use as blocksToText input. */
function b(
  type: Block["type"],
  content: string,
  metadata?: Block["metadata"]
): Block {
  return { id: "test-id", type, content, ...(metadata ? { metadata } : {}) }
}

// ─── textToBlocks — single block types ───────────────────────────────────────

describe("textToBlocks — single blocks", () => {
  it("parses a heading", () => {
    expect(noIds(textToBlocks("# My Heading"))).toEqual([
      { type: "heading", content: "My Heading" },
    ])
  })

  it("parses a subheading", () => {
    expect(noIds(textToBlocks("## My Subheading"))).toEqual([
      { type: "subheading", content: "My Subheading" },
    ])
  })

  it("parses a paragraph", () => {
    expect(noIds(textToBlocks("Plain paragraph text."))).toEqual([
      { type: "paragraph", content: "Plain paragraph text." },
    ])
  })

  it("parses a pro_tip", () => {
    expect(noIds(textToBlocks("> Always back up your work."))).toEqual([
      { type: "pro_tip", content: "Always back up your work." },
    ])
  })

  it("parses a prompt_card", () => {
    expect(noIds(textToBlocks("PROMPT: Write a story about a robot."))).toEqual([
      { type: "prompt_card", content: "Write a story about a robot." },
    ])
  })

  it("parses a page_break", () => {
    expect(noIds(textToBlocks("---"))).toEqual([
      { type: "page_break", content: "" },
    ])
  })

  it("parses a chapter_divider", () => {
    expect(noIds(textToBlocks("==="))).toEqual([
      { type: "chapter_divider", content: "" },
    ])
  })

  it("parses a single-row table", () => {
    expect(noIds(textToBlocks("Name | Age | City"))).toEqual([
      {
        type: "table",
        content: "",
        metadata: { rows: [["Name", "Age", "City"]] },
      },
    ])
  })

  it("parses a multi-row table as a single block", () => {
    const text = "Name | Age\nAlice | 30\nBob | 25"
    expect(noIds(textToBlocks(text))).toEqual([
      {
        type: "table",
        content: "",
        metadata: {
          rows: [
            ["Name", "Age"],
            ["Alice", "30"],
            ["Bob", "25"],
          ],
        },
      },
    ])
  })
})

// ─── textToBlocks — blank-line separator behaviour ────────────────────────────

describe("textToBlocks — blank lines and separators", () => {
  it("returns empty array for empty string", () => {
    expect(textToBlocks("")).toEqual([])
  })

  it("returns empty array for only blank lines", () => {
    expect(textToBlocks("\n\n\n")).toEqual([])
  })

  it("trims leading and trailing whitespace from each line", () => {
    expect(noIds(textToBlocks("  # Heading with padding  "))).toEqual([
      { type: "heading", content: "Heading with padding" },
    ])
  })

  it("separates two paragraphs with a blank line", () => {
    const text = "First paragraph.\n\nSecond paragraph."
    expect(noIds(textToBlocks(text))).toEqual([
      { type: "paragraph", content: "First paragraph." },
      { type: "paragraph", content: "Second paragraph." },
    ])
  })

  it("accumulates consecutive plain lines into one paragraph", () => {
    const text = "Line one.\nLine two.\nLine three."
    expect(noIds(textToBlocks(text))).toEqual([
      { type: "paragraph", content: "Line one.\nLine two.\nLine three." },
    ])
  })

  it("stops a table when a blank line appears and starts a new table after", () => {
    const text = "A | B\n\nC | D"
    expect(noIds(textToBlocks(text))).toEqual([
      { type: "table", content: "", metadata: { rows: [["A", "B"]] } },
      { type: "table", content: "", metadata: { rows: [["C", "D"]] } },
    ])
  })

  it("stops a table when a non-pipe line appears", () => {
    const text = "A | B\nPlain text"
    expect(noIds(textToBlocks(text))).toEqual([
      { type: "table", content: "", metadata: { rows: [["A", "B"]] } },
      { type: "paragraph", content: "Plain text" },
    ])
  })

  it("ignores multiple consecutive blank lines", () => {
    const text = "# Heading\n\n\n\nSome paragraph."
    expect(noIds(textToBlocks(text))).toEqual([
      { type: "heading", content: "Heading" },
      { type: "paragraph", content: "Some paragraph." },
    ])
  })
})

// ─── textToBlocks — mixed document ────────────────────────────────────────────

describe("textToBlocks — full mixed document", () => {
  it("correctly parses every block type in sequence", () => {
    const text = [
      "# Chapter One",
      "",
      "## Introduction",
      "",
      "This is a paragraph.",
      "",
      "> Always cite your sources.",
      "",
      "PROMPT: Describe the main theme in three sentences.",
      "",
      "Header | Value",
      "Row1   | Data1",
      "Row2   | Data2",
      "",
      "---",
      "",
      "===",
    ].join("\n")

    expect(noIds(textToBlocks(text))).toEqual([
      { type: "heading", content: "Chapter One" },
      { type: "subheading", content: "Introduction" },
      { type: "paragraph", content: "This is a paragraph." },
      { type: "pro_tip", content: "Always cite your sources." },
      { type: "prompt_card", content: "Describe the main theme in three sentences." },
      {
        type: "table",
        content: "",
        metadata: {
          rows: [
            ["Header", "Value"],
            ["Row1", "Data1"],
            ["Row2", "Data2"],
          ],
        },
      },
      { type: "page_break", content: "" },
      { type: "chapter_divider", content: "" },
    ])
  })
})

// ─── textToBlocks — prefix edge cases ────────────────────────────────────────

describe("textToBlocks — prefix edge cases", () => {
  it("does not confuse ## with # (subheading is not a heading)", () => {
    const blocks = noIds(textToBlocks("## Sub\n\n# Head"))
    expect(blocks[0].type).toBe("subheading")
    expect(blocks[1].type).toBe("heading")
  })

  it("treats ### as a paragraph (no match)", () => {
    expect(noIds(textToBlocks("### Triple hash"))).toEqual([
      { type: "paragraph", content: "### Triple hash" },
    ])
  })

  it("treats #without-space as a paragraph", () => {
    expect(noIds(textToBlocks("#NoSpace"))).toEqual([
      { type: "paragraph", content: "#NoSpace" },
    ])
  })

  it("treats > without space as a paragraph", () => {
    expect(noIds(textToBlocks(">noSpace"))).toEqual([
      { type: "paragraph", content: ">noSpace" },
    ])
  })

  it("treats PROMPT: without space as a paragraph", () => {
    expect(noIds(textToBlocks("PROMPT:noSpace"))).toEqual([
      { type: "paragraph", content: "PROMPT:noSpace" },
    ])
  })

  it("only matches exactly --- for page_break (not ----)", () => {
    // ---- contains | ... wait no, it doesn't. It's four dashes.
    // Without |, it falls through to paragraph.
    expect(noIds(textToBlocks("----"))).toEqual([
      { type: "paragraph", content: "----" },
    ])
  })

  it("only matches exactly === for chapter_divider (not ====)", () => {
    expect(noIds(textToBlocks("===="))).toEqual([
      { type: "paragraph", content: "====" },
    ])
  })

  it("trims cell whitespace in tables", () => {
    const result = noIds(textToBlocks("  Alice  |  30  "))
    expect(result[0]).toEqual({
      type: "table",
      content: "",
      metadata: { rows: [["Alice", "30"]] },
    })
  })
})

// ─── blocksToText — single blocks ────────────────────────────────────────────

describe("blocksToText — single blocks", () => {
  it("serialises a heading", () => {
    expect(blocksToText([b("heading", "My Title")])).toBe("# My Title")
  })

  it("serialises a subheading", () => {
    expect(blocksToText([b("subheading", "My Sub")])).toBe("## My Sub")
  })

  it("serialises a paragraph", () => {
    expect(blocksToText([b("paragraph", "Some text.")])).toBe("Some text.")
  })

  it("serialises a multi-line paragraph preserving internal newlines", () => {
    expect(blocksToText([b("paragraph", "Line 1\nLine 2")])).toBe("Line 1\nLine 2")
  })

  it("serialises a pro_tip", () => {
    expect(blocksToText([b("pro_tip", "Stay hydrated.")])).toBe("> Stay hydrated.")
  })

  it("serialises a prompt_card", () => {
    expect(blocksToText([b("prompt_card", "Write an intro.")])).toBe(
      "PROMPT: Write an intro."
    )
  })

  it("serialises a page_break", () => {
    expect(blocksToText([b("page_break", "")])).toBe("---")
  })

  it("serialises a chapter_divider", () => {
    expect(blocksToText([b("chapter_divider", "")])).toBe("===")
  })

  it("serialises a single-row table", () => {
    expect(
      blocksToText([b("table", "", { rows: [["A", "B", "C"]] })])
    ).toBe("A | B | C")
  })

  it("serialises a multi-row table with newlines between rows", () => {
    expect(
      blocksToText([
        b("table", "", { rows: [["Name", "Age"], ["Alice", "30"], ["Bob", "25"]] }),
      ])
    ).toBe("Name | Age\nAlice | 30\nBob | 25")
  })
})

// ─── blocksToText — multiple blocks ──────────────────────────────────────────

describe("blocksToText — multiple blocks", () => {
  it("joins blocks with a blank line", () => {
    const text = blocksToText([
      b("heading", "Title"),
      b("paragraph", "Body text."),
    ])
    expect(text).toBe("# Title\n\nBody text.")
  })

  it("returns empty string for empty array", () => {
    expect(blocksToText([])).toBe("")
  })
})

// ─── Invertibility: blocks → text → blocks ───────────────────────────────────
//
// For every block type: blocksToText([block]) then textToBlocks must produce
// a single block with the same type, content, and metadata (ID will differ).

describe("invertibility — blocks → text → blocks", () => {
  function roundTrip(block: Block): NoId {
    const text = blocksToText([block])
    const result = textToBlocks(text)
    expect(result).toHaveLength(1)
    const { id: _id, ...rest } = result[0]
    return rest
  }

  it("heading is invertible", () => {
    expect(roundTrip(b("heading", "Chapter One"))).toEqual({
      type: "heading",
      content: "Chapter One",
    })
  })

  it("subheading is invertible", () => {
    expect(roundTrip(b("subheading", "Section 1.1"))).toEqual({
      type: "subheading",
      content: "Section 1.1",
    })
  })

  it("paragraph (single line) is invertible", () => {
    expect(roundTrip(b("paragraph", "Hello world."))).toEqual({
      type: "paragraph",
      content: "Hello world.",
    })
  })

  it("paragraph (multi-line) is invertible", () => {
    expect(roundTrip(b("paragraph", "Line A\nLine B\nLine C"))).toEqual({
      type: "paragraph",
      content: "Line A\nLine B\nLine C",
    })
  })

  it("pro_tip is invertible", () => {
    expect(roundTrip(b("pro_tip", "Keep it simple."))).toEqual({
      type: "pro_tip",
      content: "Keep it simple.",
    })
  })

  it("prompt_card is invertible", () => {
    expect(
      roundTrip(b("prompt_card", "Describe the setting in detail."))
    ).toEqual({
      type: "prompt_card",
      content: "Describe the setting in detail.",
    })
  })

  it("page_break is invertible", () => {
    expect(roundTrip(b("page_break", ""))).toEqual({
      type: "page_break",
      content: "",
    })
  })

  it("chapter_divider is invertible", () => {
    expect(roundTrip(b("chapter_divider", ""))).toEqual({
      type: "chapter_divider",
      content: "",
    })
  })

  it("single-row table is invertible", () => {
    expect(
      roundTrip(b("table", "", { rows: [["Name", "Age", "City"]] }))
    ).toEqual({
      type: "table",
      content: "",
      metadata: { rows: [["Name", "Age", "City"]] },
    })
  })

  it("multi-row table is invertible", () => {
    const rows = [
      ["Product", "Price", "Stock"],
      ["Widget", "$9.99", "100"],
      ["Gadget", "$19.99", "50"],
    ]
    expect(roundTrip(b("table", "", { rows }))).toEqual({
      type: "table",
      content: "",
      metadata: { rows },
    })
  })

  it("full document with all block types is invertible", () => {
    const original: Block[] = [
      b("heading", "My Ebook"),
      b("subheading", "A Deep Dive"),
      b("paragraph", "Introduction paragraph."),
      b("pro_tip", "Read every chapter twice."),
      b("prompt_card", "Summarise this chapter."),
      b("table", "", { rows: [["Col A", "Col B"], ["1", "2"]] }),
      b("page_break", ""),
      b("chapter_divider", ""),
      b("paragraph", "Closing thoughts."),
    ]

    const text = blocksToText(original)
    const recovered = textToBlocks(text)

    expect(recovered).toHaveLength(original.length)
    expect(noIds(recovered)).toEqual(noIds(original))
  })
})

// ─── Stability: text → blocks → text ─────────────────────────────────────────
//
// Starting from NORMALISED text (as produced by blocksToText), a second
// round-trip must return the identical string.

describe("stability — text → blocks → text", () => {
  function stable(text: string) {
    return blocksToText(textToBlocks(text))
  }

  it("heading is stable", () => {
    expect(stable("# Title")).toBe("# Title")
  })

  it("subheading is stable", () => {
    expect(stable("## Sub")).toBe("## Sub")
  })

  it("paragraph is stable", () => {
    expect(stable("Hello world.")).toBe("Hello world.")
  })

  it("multi-line paragraph is stable", () => {
    expect(stable("Line 1\nLine 2")).toBe("Line 1\nLine 2")
  })

  it("pro_tip is stable", () => {
    expect(stable("> A tip.")).toBe("> A tip.")
  })

  it("prompt_card is stable", () => {
    expect(stable("PROMPT: Write something.")).toBe("PROMPT: Write something.")
  })

  it("page_break is stable", () => {
    expect(stable("---")).toBe("---")
  })

  it("chapter_divider is stable", () => {
    expect(stable("===")).toBe("===")
  })

  it("table is stable", () => {
    expect(stable("A | B\nC | D")).toBe("A | B\nC | D")
  })

  it("full mixed document is stable", () => {
    const text = [
      "# Title",
      "",
      "## Subtitle",
      "",
      "Paragraph text.",
      "",
      "> A pro tip.",
      "",
      "PROMPT: A prompt card.",
      "",
      "Col1 | Col2",
      "Val1 | Val2",
      "",
      "---",
      "",
      "===",
    ].join("\n")

    expect(stable(text)).toBe(text)
  })
})
