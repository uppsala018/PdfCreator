import { describe, expect, it } from "vitest"
import { analyzeImportedPdfLayout } from "@/lib/pdf-repair/analysis"
import type { PdfLayoutBlock, PdfLayoutEditState } from "@/lib/project-schema"

const emptyLayout: PdfLayoutEditState = {
  version: 1,
  deletedPages: [],
  pageOrder: [],
  visualBlocks: [],
  textOverlays: {},
  patchFills: {},
}

function block(overrides: Partial<PdfLayoutBlock>): PdfLayoutBlock {
  return {
    id: "region-1",
    pageIndex: 0,
    x: 0.01,
    y: 0.1,
    width: 0.3,
    height: 0.3,
    type: "visual_region",
    label: "Region 1",
    ...overrides,
  }
}

describe("analyzeImportedPdfLayout", () => {
  it("returns diagnostics, suggestions, counts, and timestamp for the current layout", () => {
    const analysis = analyzeImportedPdfLayout({
      projectId: "project-1",
      pageCount: 3,
      analyzedAt: "2026-05-17T00:00:00.000Z",
      layout: {
        ...emptyLayout,
        visualBlocks: [block({ id: "edge-region" })],
      },
    })

    expect(analysis.analyzedAt).toBe("2026-05-17T00:00:00.000Z")
    expect(analysis.summary).toMatchObject({
      pagesAnalyzed: 3,
      issuesFound: 1,
      suggestionsGenerated: 1,
      warningsCount: 1,
      errorsCount: 0,
    })
    expect(analysis.diagnostics[0]).toMatchObject({
      code: "region_near_page_edge",
      severity: "warning",
      pageIndex: 0,
      regionId: "edge-region",
    })
    expect(analysis.suggestions[0]).toMatchObject({
      issueCode: "region_near_page_edge",
      projectId: "project-1",
    })
  })
})
