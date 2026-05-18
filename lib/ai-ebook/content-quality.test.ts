import { describe, expect, it } from "vitest"
import { repairComposerEbookContent, containsLeakedAuthoringText } from "./content-quality"
import type { ComposerEbook } from "@/lib/export/project-to-schema"

function leakyEbook(): ComposerEbook {
  return {
    title: "The Solo Grooming Guide",
    subtitle: "Back hair hygiene",
    author: "Ebook Studio",
    brand: "Ebook Studio",
    theme: "black_gold",
    back_cover_title: "Next step",
    back_cover_body: "Use the guide.",
    back_cover_cta: "Start now",
    chapters: [
      {
        title: "The Essential Toolkit",
        intro: "A short intro.",
        sections: [
          {
            title: "Core idea",
            blocks: [
              { type: "paragraph", text: "Core idea gives readers a practical way to move from idea to action." },
              { type: "tip_box", text: "Focus on the one decision this section helps the reader make." },
              { type: "prompt_block", text: 'PROMPT Turn "Choosing the Right Back Shaver" into a concrete action plan with one next step.' },
              { type: "workflow_step", title: "Apply the idea", text: "Write the next concrete action." },
            ],
          },
        ],
      },
    ],
  }
}

describe("repairComposerEbookContent", () => {
  it("removes internal authoring and prompt leakage from final ebook content", () => {
    const result = repairComposerEbookContent(leakyEbook())
    const text = JSON.stringify(result.ebook)

    expect(text).not.toMatch(/\bPROMPT\b/i)
    expect(text).not.toMatch(/focus on the one decision/i)
    expect(text).not.toMatch(/core idea gives/i)
    expect(text).not.toMatch(/turn "choosing the right back shaver" into a concrete action plan/i)
    expect(text).not.toMatch(/apply the idea/i)
    expect(result.ebook.chapters[0].sections[0].blocks.some((block) => block.type === "prompt_block")).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["PROMPT_BLOCK_REWRITTEN", "GENERIC_DECISION_HELPER", "GENERIC_CORE_IDEA"])
    )
  })

  it("expands thin sections with reader-facing prose", () => {
    const result = repairComposerEbookContent({
      ...leakyEbook(),
      chapters: [
        {
          title: "Technique",
          intro: "",
          sections: [{ title: "Mirror Positioning", blocks: [{ type: "paragraph", text: "Use mirrors." }] }],
        },
      ],
    })

    const section = result.ebook.chapters[0].sections[0]
    expect(section.blocks.length).toBeGreaterThan(1)
    expect(containsLeakedAuthoringText(JSON.stringify(section))).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toContain("THIN_SECTION_EXPANDED")
  })
})
