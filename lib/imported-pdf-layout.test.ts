import { describe, expect, it } from "vitest"
import { createDefaultImportedPdfLayout, normalizeImportedPdfLayout } from "./imported-pdf-layout"

describe("imported PDF layout hydration", () => {
  it("fills defaults for legacy imported PDF layout state", () => {
    const layout = normalizeImportedPdfLayout({
      deletedPageIds: [4, 2, 2, -1, "skip"],
      visualBlocks: [
        {
          id: "block-1",
          pageIndex: 0,
          x: 0.1,
          y: 0.2,
          width: 0.3,
          height: 0.4,
          type: "visual_region",
        },
      ],
    })

    expect(layout.version).toBe(1)
    expect(layout.deletedPages).toEqual([2, 4])
    expect(layout.pageOrder).toEqual([])
    expect(layout.visualBlocks).toHaveLength(1)
    expect(layout.textOverlays).toEqual({})
    expect(layout.patchFills).toEqual({})
  })

  it("preserves record-based overlays and patch fills", () => {
    const layout = normalizeImportedPdfLayout({
      textOverlays: {
        "text-1": { id: "text-1", text: "Hello" },
      },
      patchFills: {
        "fill-1": { pageIndex: 1, regionId: "block-1", mode: "custom_color", color: "#ffffff" },
      },
    })

    expect(layout.textOverlays).toEqual({
      "text-1": { id: "text-1", text: "Hello" },
    })
    expect(layout.patchFills).toEqual({
      "fill-1": { pageIndex: 1, regionId: "block-1", mode: "custom_color", color: "#ffffff" },
    })
  })

  it("converts legacy overlay arrays to records without throwing", () => {
    const layout = normalizeImportedPdfLayout({
      textOverlays: [
        { id: "text-1", text: "Hello" },
        { text: "missing id" },
      ],
    })

    expect(layout.textOverlays).toEqual({
      "text-1": { id: "text-1", text: "Hello" },
    })
  })

  it("creates a fresh default layout each time", () => {
    const first = createDefaultImportedPdfLayout()
    const second = createDefaultImportedPdfLayout()

    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(first.visualBlocks).not.toBe(second.visualBlocks)
  })
})
