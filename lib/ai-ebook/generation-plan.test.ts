import { describe, expect, it } from "vitest"
import { createProfessionalEbookPlan, inferStructureFromPrompt, parseChapterDefinitions } from "./generation-plan"

describe("professional ebook generation planning", () => {
  it("extracts natural language chapter and page targets", () => {
    expect(inferStructureFromPrompt("Write a 10 chapter book with at least 50 pages and each chapter should be 2 pages")).toEqual({
      chapterCount: 10,
      totalPages: 50,
      pagesPerChapter: 2,
    })
  })

  it("parses manual chapter definitions", () => {
    expect(parseChapterDefinitions(["Chapter 1: Historical background", "Chapter 2: The theological dispute"].join("\n"))).toEqual([
      { title: "Historical background" },
      { title: "The theological dispute" },
    ])
  })

  it("lets explicit controls override prompt inference", () => {
    const plan = createProfessionalEbookPlan({
      topic: "Write a 10 chapter book about Nicaea with at least 100 pages",
      desiredChapterCount: 4,
      desiredTotalPages: 20,
      wordsPerPage: 350,
    })

    expect(plan.chapterCount).toBe(4)
    expect(plan.totalPages).toBe(20)
    expect(plan.targetWords).toBe(7000)
    expect(plan.chapters).toHaveLength(4)
  })

  it("warns when a large book has little planning detail", () => {
    const plan = createProfessionalEbookPlan({
      topic: "Nicaea ebook",
      desiredTotalPages: 60,
      desiredChapterCount: 10,
      minPagesPerChapter: 6,
    })

    expect(plan.warnings.length).toBeGreaterThan(0)
  })
})
