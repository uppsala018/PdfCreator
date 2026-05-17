import { describe, expect, it } from "vitest"
import { MockAIProvider } from "@/lib/ai-runtime/providers/mock-provider"
import { generateLiveStructuredChapters } from "@/lib/ai-ebook/live-chapter-generation"
import type { AiEbookGeneration } from "@/lib/ai-ebook/ebook-generation-schema"

const outline: AiEbookGeneration = {
  title: "Creator Launch System",
  subtitle: "A practical guide for focused launches.",
  brand: "Studio Brand",
  format: "luxury-lead-magnet",
  theme: "luxury-black-gold",
  chapters: [
    {
      title: "Position the Promise",
      intro: "Clarify the launch promise.",
      sections: [{ title: "Reader goal" }, { title: "Offer angle" }],
    },
    {
      title: "Build the Assets",
      intro: "Create launch assets.",
      sections: [{ title: "Core pages" }, { title: "Email sequence" }],
    },
    {
      title: "Launch and Learn",
      intro: "Run the launch.",
      sections: [{ title: "Launch day" }, { title: "Review loop" }],
    },
  ],
  cta: {
    title: "Start the launch",
    body: "Use the guide to plan one focused offer.",
    action: "Create the launch checklist.",
  },
}

const chapterDraft: AiEbookGeneration = {
  ...outline,
  chapters: outline.chapters?.map((chapter) => ({
    ...chapter,
    sections: chapter.sections?.map((section) => ({
      ...section,
      blocks: [
        { type: "paragraph", text: `${section.title} explains the practical decision the reader needs to make.` },
        { type: "bullet_list", items: ["Define the goal", "Choose the asset", "Review the result"] },
        { type: "tip_box", text: "Keep the launch focused before adding extra tactics." },
        { type: "prompt_block", text: `Create a checklist for ${section.title}.` },
        { type: "comparison_table", headers: ["Asset", "Purpose"], rows: [["Landing page", "Clarify the offer"]] },
        { type: "workflow_step", title: "Apply", text: "Turn the idea into one scheduled task." },
        { type: "cta_box", text: "Choose one action and complete it this week." },
      ],
    })),
  })),
}

describe("generateLiveStructuredChapters", () => {
  it("generates composer-compatible structured chapters", async () => {
    const result = await generateLiveStructuredChapters({
      outline,
      audience: "solo creators",
      provider: new MockAIProvider({ structuredJson: chapterDraft }),
    })

    expect(result.provider.usedFallback).toBe(false)
    expect(result.ebook.chapters?.[0].sections?.[0].blocks?.map((block) => block.type)).toEqual([
      "paragraph",
      "bullet_list",
      "tip_box",
      "prompt_block",
      "comparison_table",
      "workflow_step",
      "cta_box",
    ])
    expect(result.composerReady.chapters[0].sections[0].blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "comparison_table" }),
        expect.objectContaining({ type: "workflow_step" }),
      ])
    )
  })

  it("recovers malformed structured JSON responses", async () => {
    const result = await generateLiveStructuredChapters({
      outline,
      provider: new MockAIProvider({
        structuredJson: `\`\`\`json\n${JSON.stringify(chapterDraft)}\n\`\`\``,
      }),
    })

    expect(result.provider.usedFallback).toBe(false)
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MALFORMED_CHAPTER_JSON_RECOVERED" }),
      ])
    )
    expect(result.composerReady.chapters).toHaveLength(3)
  })

  it("falls back and repairs sparse chapter output", async () => {
    const result = await generateLiveStructuredChapters({
      outline,
      provider: new MockAIProvider({ structuredJson: "not json" }),
    })

    expect(result.provider.usedFallback).toBe(false)
    expect(result.ebook.chapters).toHaveLength(3)
    expect(result.composerReady.chapters[0].sections[0].blocks.length).toBeGreaterThan(0)
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MALFORMED_CHAPTER_JSON" }),
      ])
    )
  })

  it("replaces provider sections that contain only empty blocks before normalization", async () => {
    const result = await generateLiveStructuredChapters({
      outline,
      audience: "students",
      provider: new MockAIProvider({
        structuredJson: {
          ...outline,
          chapters: [
            {
              title: "Gustav Vasa",
              intro: "A Swedish history chapter.",
              sections: [
                {
                  title: "Early life",
                  blocks: [
                    { type: "paragraph", text: "" },
                    { type: "bullet_list", items: [] },
                    { type: "tip_box", text: "   " },
                  ],
                },
              ],
            },
          ],
        },
      }),
    })

    const blocks = result.composerReady.chapters[0].sections[0].blocks
    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "paragraph", text: expect.stringContaining("Early life") }),
      ])
    )
    expect(result.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "EMPTY_BLOCKS_REPAIRED" }),
      ])
    )
  })

  it("applies safeguards for oversized paragraphs and weak CTAs", async () => {
    const longParagraph = Array.from({ length: 80 }, () => "This repeated sentence supports the section.").join(" ")
    const result = await generateLiveStructuredChapters({
      outline: { ...outline, cta: { title: "Next", body: "", action: "" } },
      provider: new MockAIProvider({
        structuredJson: {
          ...outline,
          cta: { title: "Next", body: "", action: "" },
          chapters: [
            {
              title: "Same",
              intro: "Intro",
              sections: [
                {
                  title: "Dense",
                  blocks: [
                    { type: "paragraph", text: longParagraph },
                    { type: "heading", text: "Repeat" },
                    { type: "heading", text: "Repeat" },
                  ],
                },
              ],
            },
          ],
        },
      }),
    })

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "OVERSIZED_BLOCK_SPLIT" }),
        expect.objectContaining({ code: "DUPLICATE_HEADING_REDUCED" }),
        expect.objectContaining({ code: "WEAK_CTA_REPAIRED" }),
        expect.objectContaining({ code: "LOW_STRUCTURE_VARIETY" }),
      ])
    )
    expect(result.normalized.ebook.back_cover_cta).toBeTruthy()
  })

  it("normalizes malformed tables for composer compatibility", async () => {
    const result = await generateLiveStructuredChapters({
      outline,
      provider: new MockAIProvider({
        structuredJson: {
          ...outline,
          chapters: [
            {
              title: "Tables",
              sections: [
                {
                  title: "Comparison",
                  blocks: [
                    {
                      type: "comparison_table",
                      headers: ["One"],
                      rows: [["A", "B", "C"]],
                    },
                    { type: "cta_box", text: "Apply this comparison to your next decision." },
                  ],
                },
              ],
            },
          ],
        },
      }),
    })

    const table = result.composerReady.chapters[0].sections[0].blocks.find(
      (block) => block.type === "comparison_table"
    )
    expect(table).toMatchObject({
      type: "comparison_table",
      headers: ["Item", "Details"],
    })
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MALFORMED_TABLE_REPAIRED" }),
      ])
    )
  })
})
