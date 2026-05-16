import { describe, expect, it } from "vitest"
import { buildComposerPrompt } from "./composer-prompting"
import { diagnoseAiGeneratedStructure } from "./diagnostics"
import { composerEbookToEditorDraft } from "./editor-draft"
import { generateOutline } from "./structured-outline"
import { normalizeAiEbookGeneration } from "./normalization"
import { simulatedAiEbookInput, normalizedSimulatedAiEbook } from "./simulated-sample"

describe("AI ebook structured generation foundation", () => {
  it("normalizes simulated AI output into composer-ready schema", () => {
    const { ebook, issues } = normalizedSimulatedAiEbook()

    expect(ebook.theme).toBe("black_gold")
    expect(ebook.chapters).toHaveLength(2)
    expect(ebook.chapters[0].sections[1].blocks.map((block) => block.type)).toContain("warning_box")
    expect(ebook.chapters[0].sections[0].blocks.map((block) => block.type)).toContain("comparison_table")
    expect(issues.some((issue) => issue.code === "UNSUPPORTED_AI_BLOCK")).toBe(true)
  })

  it("repairs malformed tables and empty content safely", () => {
    const { ebook, issues } = normalizeAiEbookGeneration({
      title: "",
      chapters: [
        {
          title: "",
          sections: [
            {
              title: "",
              blocks: [
                { type: "comparison_table", headers: ["A"], rows: [["one", "two"]] },
                { type: "prompt_block", text: "" },
              ],
            },
          ],
        },
      ],
    })

    const table = ebook.chapters[0].sections[0].blocks[0]
    expect(ebook.title).toBe("Untitled AI Ebook")
    expect(table.type).toBe("comparison_table")
    if (table.type === "comparison_table") {
      expect(table.headers.length).toBeGreaterThanOrEqual(2)
      expect(table.rows[0]).toHaveLength(table.headers.length)
    }
    expect(issues.some((issue) => issue.code === "MALFORMED_TABLE_REPAIRED")).toBe(true)
  })

  it("builds deterministic outlines without calling a live AI API", () => {
    const outline = generateOutline({
      topic: "premium client onboarding",
      audience: "consultants",
      outcome: "deliver a stronger first week",
      chapterCount: 4,
    })
    const normalized = normalizeAiEbookGeneration(outline)
    const diagnostics = diagnoseAiGeneratedStructure(normalized.ebook)

    expect(normalized.ebook.chapters).toHaveLength(4)
    expect(diagnostics.filter((issue) => issue.severity === "error")).toHaveLength(0)
  })

  it("creates composer-oriented JSON prompt instructions", () => {
    const prompt = buildComposerPrompt({
      topic: "client onboarding",
      format: "consultant-guide",
      audience: "solo consultants",
    })

    expect(prompt).toContain("Output JSON only")
    expect(prompt).toContain("comparison_table")
    expect(prompt).toContain("client onboarding")
  })

  it("keeps the simulated fixture stable enough for PDF rendering", () => {
    const normalized = normalizeAiEbookGeneration(simulatedAiEbookInput)
    expect(JSON.stringify(normalized.ebook)).toContain("Premium Client Onboarding System")
    expect(normalized.ebook.chapters[0].sections[0].blocks.length).toBeGreaterThan(2)
  })

  it("converts normalized structured drafts into editor chapters", () => {
    const normalized = normalizeAiEbookGeneration(simulatedAiEbookInput)
    const draft = composerEbookToEditorDraft(normalized.ebook)
    const firstChapterTypes = draft.chapters[0].blocks.map((block) => block.type)

    expect(draft.title).toBe("Premium Client Onboarding System")
    expect(firstChapterTypes).toContain("heading")
    expect(firstChapterTypes).toContain("pro_tip")
    expect(firstChapterTypes).toContain("prompt_card")
    expect(firstChapterTypes).toContain("table")
  })
})
