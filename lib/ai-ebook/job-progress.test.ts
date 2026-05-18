import { describe, expect, it } from "vitest"
import { ebookJobProgress } from "./job-progress"

describe("ebookJobProgress", () => {
  it("reports chapter progress for generating jobs", () => {
    expect(ebookJobProgress({
      status: "generating",
      currentChapterIndex: 2,
      plan: { chapterCount: 10, totalPages: 50, targetWords: 20000, warnings: [] },
    })).toMatchObject({
      label: "Generating chapter 3/10",
    })
  })

  it("reports retry and finalized states", () => {
    expect(ebookJobProgress({ status: "failed", currentChapterIndex: 1, plan: { chapterCount: 4, totalPages: 20, targetWords: 8000, warnings: [] } }).label).toBe("Waiting for retry")
    expect(ebookJobProgress({ status: "finalized", currentChapterIndex: 4, plan: { chapterCount: 4, totalPages: 20, targetWords: 8000, warnings: [] } })).toEqual({
      label: "Complete",
      percent: 100,
    })
  })
})
