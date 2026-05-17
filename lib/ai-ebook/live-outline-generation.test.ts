import { describe, expect, it } from "vitest"
import { MockAIProvider } from "@/lib/ai-runtime/providers/mock-provider"
import { normalizeSource } from "@/lib/ebook-ingestion/normalize-source"
import { generateLiveStructuredOutline } from "@/lib/ai-ebook/live-outline-generation"

const validOutline = {
  title: "Creator Launch System",
  subtitle: "A practical guide to building a focused launch plan.",
  brand: "Studio Brand",
  format: "luxury-lead-magnet",
  theme: "luxury-black-gold",
  chapters: [
    {
      title: "Position the Promise",
      intro: "Clarify the reader outcome.",
      sections: [{ title: "Reader goal" }, { title: "Offer angle" }],
    },
    {
      title: "Build the Assets",
      intro: "Create the launch materials.",
      sections: [{ title: "Core pages" }, { title: "Email sequence" }],
    },
    {
      title: "Launch and Learn",
      intro: "Ship the launch and improve it.",
      sections: [{ title: "Launch day" }, { title: "Review loop" }],
    },
  ],
  cta: {
    title: "Start the launch",
    body: "Use the guide to plan one focused offer.",
    action: "Create the launch checklist.",
  },
}

describe("generateLiveStructuredOutline", () => {
  it("generates and normalizes a valid provider outline", async () => {
    const result = await generateLiveStructuredOutline({
      topic: "creator launch",
      audience: "solo creators",
      provider: new MockAIProvider({ structuredJson: validOutline }),
    })

    expect(result.provider).toMatchObject({
      id: "mock",
      model: "mock-model",
      usedFallback: false,
    })
    expect(result.outline.title).toBe("Creator Launch System")
    expect(result.outline.chapters).toHaveLength(3)
    expect(result.normalized.ebook.title).toBe("Creator Launch System")
    expect(result.normalized.ebook.chapters[0].sections[0].blocks.length).toBeGreaterThan(0)
  })

  it("recovers malformed JSON text from a provider response", async () => {
    const result = await generateLiveStructuredOutline({
      topic: "pricing strategy",
      provider: new MockAIProvider({
        structuredJson: `Here is the outline:\n\n\`\`\`json\n${JSON.stringify(validOutline)}\n\`\`\``,
      }),
    })

    expect(result.provider.usedFallback).toBe(false)
    expect(result.outline.title).toBe("Creator Launch System")
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MALFORMED_OUTLINE_JSON_RECOVERED" }),
      ])
    )
  })

  it("falls back to deterministic outline generation when provider output is unusable", async () => {
    const result = await generateLiveStructuredOutline({
      topic: "workflow automation",
      audience: "operators",
      targetLength: "short",
      provider: new MockAIProvider({ structuredJson: "not json" }),
    })

    expect(result.provider.usedFallback).toBe(false)
    expect(result.outline.title).toBe("Workflow Automation")
    expect(result.outline.chapters).toHaveLength(3)
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MALFORMED_OUTLINE_JSON" }),
      ])
    )
  })

  it("uses uploaded source structure in prompts and stays normalization compatible", async () => {
    const sourceDocument = normalizeSource({
      kind: "markdown",
      text: [
        "# The Operations Playbook",
        "",
        "A source document for improving team workflows.",
        "",
        "## Bottlenecks",
        "",
        "- Intake",
        "- Review",
      ].join("\n"),
    })

    const result = await generateLiveStructuredOutline({
      sourceDocument,
      audience: "team leads",
      provider: new MockAIProvider({ structuredJson: validOutline }),
    })

    expect(result.rawText).toContain("Creator Launch System")
    expect(result.normalized.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "EMPTY_BLOCKS_REPAIRED" }),
      ])
    )
    expect(result.normalized.ebook.chapters).toHaveLength(3)
  })

  it("diagnoses repetitive chapter names and sparse sections", async () => {
    const result = await generateLiveStructuredOutline({
      topic: "sales systems",
      provider: new MockAIProvider({
        structuredJson: {
          ...validOutline,
          chapters: [
            { title: "Repeat", sections: [{ title: "Only" }] },
            { title: "Repeat", sections: [{ title: "Only" }] },
          ],
        },
      }),
    })

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "WEAK_OUTLINE_DEPTH" }),
        expect.objectContaining({ code: "REPETITIVE_CHAPTER_NAMES" }),
        expect.objectContaining({ code: "SPARSE_OUTLINE_SECTIONS" }),
      ])
    )
  })
})
