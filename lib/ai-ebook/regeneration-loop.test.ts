import { describe, expect, it } from "vitest"
import {
  runControlledRegenerationLoop,
  suggestRegenerationImprovements,
} from "@/lib/ai-ebook/regeneration-loop"
import type { ComposerEbook } from "@/lib/export/project-to-schema"

function baseEbook(overrides: Partial<ComposerEbook> = {}): ComposerEbook {
  return {
    title: "Autopilot Guide",
    subtitle: "A structured guide.",
    author: "",
    brand: "Ebook Studio",
    theme: "black_gold",
    chapters: [
      {
        title: "Foundation",
        intro: "Start here.",
        sections: [
          {
            title: "Overview",
            blocks: [
              { type: "paragraph", text: "This chapter introduces the main idea." },
              { type: "bullet_list", items: ["Define the problem", "Choose one action"] },
              { type: "cta_box", text: "Apply this idea today." },
            ],
          },
        ],
      },
      {
        title: "Implementation",
        intro: "Put it to work.",
        sections: [
          {
            title: "Action plan",
            blocks: [
              { type: "paragraph", text: "Turn the concept into a practical plan." },
              { type: "key_takeaway", text: "One clear action beats a vague strategy." },
              { type: "prompt_block", text: "Create a checklist from this chapter." },
            ],
          },
        ],
      },
    ],
    back_cover_title: "Next step",
    back_cover_body: "Use the guide in a focused implementation session.",
    back_cover_cta: "Schedule one next action today.",
    ...overrides,
  }
}

describe("controlled regeneration loop", () => {
  it("stops without passes when diagnostics are clean enough", () => {
    const result = runControlledRegenerationLoop(baseEbook(), { maxPasses: 3 })

    expect(result.passHistory).toHaveLength(0)
    expect(result.metadata.stoppedReason).toBe("clean")
    expect(result.ebook).toEqual(baseEbook())
  })

  it("repairs sparse ebook and missing CTA within pass limits", () => {
    const sparse = baseEbook({
      chapters: [
        {
          title: "Only Chapter",
          intro: "",
          sections: [{ title: "Overview", blocks: [{ type: "paragraph", text: "Short." }] }],
        },
      ],
      back_cover_cta: "",
    })

    const result = runControlledRegenerationLoop(sparse, { maxPasses: 2 })

    expect(result.metadata.passesRun).toBeLessThanOrEqual(2)
    expect(result.ebook.chapters.length).toBeGreaterThanOrEqual(2)
    expect(result.ebook.back_cover_cta).toBeTruthy()
    expect(result.passHistory[0].changes).toEqual(
      expect.arrayContaining([
        "Added a supporting implementation chapter.",
        'Expanded sparse chapter "Only Chapter".',
        "Added a back-cover CTA.",
      ])
    )
    expect(result.metadata.finalScore).toBeLessThan(result.metadata.initialScore)
  })

  it("generates suggestions from diagnostics without applying destructive changes", () => {
    const ebook = baseEbook({
      chapters: [
        {
          title: "Repeat",
          intro: "",
          sections: [
            { title: "Repeat", blocks: [{ type: "paragraph", text: "Short." }] },
            { title: "Repeat", blocks: [{ type: "paragraph", text: "Short." }] },
          ],
        },
        {
          title: "Repeat",
          intro: "",
          sections: [{ title: "Repeat", blocks: [{ type: "paragraph", text: "Short." }] }],
        },
      ],
    })
    const result = runControlledRegenerationLoop(ebook, { maxPasses: 1 })

    expect(result.passHistory).toHaveLength(1)
    expect(result.ebook.chapters).toHaveLength(2)
    expect(result.ebook.title).toBe(ebook.title)
    expect(result.ebook.chapters[1].title).toContain("Repeat part")
  })

  it("splits dense sections and normalizes malformed tables", () => {
    const denseBlocks = Array.from({ length: 20 }, (_, index) => ({
      type: "paragraph" as const,
      text: `Paragraph ${index + 1}.`,
    }))
    const ebook = baseEbook({
      chapters: [
        {
          title: "Dense Chapter",
          intro: "",
          sections: [
            {
              title: "Dense",
              blocks: [
                ...denseBlocks,
                { type: "comparison_table", headers: ["Only"], rows: [["A", "B"]] } as const,
              ],
            },
          ],
        },
        baseEbook().chapters[1],
      ],
    })

    const result = runControlledRegenerationLoop(ebook, { maxPasses: 2 })

    expect(result.passHistory.length).toBeGreaterThan(0)
    expect(result.ebook.chapters[0].sections.length).toBeGreaterThan(1)
    const tables = result.ebook.chapters[0].sections.flatMap((section) => section.blocks).filter((block) => block.type === "comparison_table")
    expect(tables[0]).toMatchObject({ headers: ["Item", "Details"] })
  })

  it("exposes structured improvement suggestions", () => {
    const suggestions = suggestRegenerationImprovements(baseEbook({ back_cover_cta: "" }), [
      {
        code: "MISSING_BACK_COVER_CTA",
        severity: "warning",
        message: "Missing CTA",
        suggestedFix: "Add CTA",
      },
    ])

    expect(suggestions).toEqual([
      {
        code: "STRENGTHEN_CTA",
        action: "add_back_cover_cta",
        reason: "Missing CTA",
      },
    ])
  })
})
