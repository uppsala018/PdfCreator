import { describe, expect, it } from "vitest"
import {
  RENDERED_PAGE_ANALYSIS_PIPELINE,
  analyzeRenderedPagePlaceholder,
  createRenderedPageImageMetadata,
  normalizeRenderedBoundingBox,
} from "@/lib/pdf-repair/render-analysis"

describe("render-analysis architecture hooks", () => {
  it("defines the future rendered-page analysis pipeline order", () => {
    expect(RENDERED_PAGE_ANALYSIS_PIPELINE).toEqual([
      "pdf_page_render",
      "canvas_image_extraction",
      "visual_issue_analysis",
      "repair_suggestion_generation",
    ])
  })

  it("creates placeholder rendered-page analysis without OCR or pixel analysis", () => {
    const image = createRenderedPageImageMetadata({
      pageIndex: 1,
      width: 1224,
      height: 1584,
      scale: 2,
      source: "pdfjs_canvas",
      extractedAt: "2026-05-17T00:00:00.000Z",
    })

    const analysis = analyzeRenderedPagePlaceholder({
      image,
      analyzedAt: "2026-05-17T00:00:01.000Z",
    })

    expect(analysis).toMatchObject({
      version: 1,
      pageIndex: 1,
      pageNumber: 2,
      renderedDimensions: { width: 1224, height: 1584, unit: "px" },
      visualIssues: [],
      ocr: { status: "not_implemented", textRuns: [] },
      pixelAnalysis: {
        status: "not_implemented",
        sampledBackgrounds: [],
        detectedEdges: [],
      },
      analyzedAt: "2026-05-17T00:00:01.000Z",
    })
  })

  it("normalizes rendered-pixel bounding boxes for future suggestion mapping", () => {
    expect(
      normalizeRenderedBoundingBox(
        {
          x: 306,
          y: 396,
          width: 612,
          height: 792,
          coordinateSpace: "rendered_pixels",
          unit: "px",
        },
        { width: 1224, height: 1584 }
      )
    ).toEqual({
      x: 0.25,
      y: 0.25,
      width: 0.5,
      height: 0.5,
      coordinateSpace: "normalized",
      unit: "ratio",
    })
  })
})
