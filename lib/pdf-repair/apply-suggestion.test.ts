import { describe, expect, it } from "vitest"
import type { PdfLayoutEditState } from "@/lib/project-schema"
import { applyRepairSuggestion, getPatchFillKey } from "@/lib/pdf-repair/apply-suggestion"
import type { RepairSuggestion } from "@/lib/pdf-repair/suggestions"

const emptyLayout: PdfLayoutEditState = {
  version: 1,
  deletedPages: [],
  pageOrder: [],
  visualBlocks: [],
  textOverlays: {},
  patchFills: {},
}

function suggestion(overrides: Partial<RepairSuggestion>): RepairSuggestion {
  return {
    id: "suggestion-1",
    type: "flag_manual_review",
    severity: "info",
    confidence: 0.8,
    affectedPage: {
      pageIndex: 0,
      pageNumber: 1,
    },
    reason: "Test suggestion",
    proposedAction: {
      type: "flag_manual_review",
      issueCode: "test",
    },
    status: "pending",
    source: "rule_based",
    issueCode: "test",
    ...overrides,
  }
}

describe("applyRepairSuggestion", () => {
  it("applies delete_page by marking the page deleted", () => {
    const result = applyRepairSuggestion(
      emptyLayout,
      suggestion({
        type: "delete_page",
        proposedAction: {
          type: "delete_page",
          pageIndex: 2,
        },
      })
    )

    expect(result.applied).toBe(true)
    expect(result.layout.deletedPages).toEqual([2])
    expect(emptyLayout.deletedPages).toEqual([])
  })

  it("applies restore_page by removing the page from deleted pages", () => {
    const result = applyRepairSuggestion(
      {
        ...emptyLayout,
        deletedPages: [1, 2, 4],
      },
      suggestion({
        type: "restore_page",
        proposedAction: {
          type: "restore_page",
          pageIndex: 2,
        },
      })
    )

    expect(result.applied).toBe(true)
    expect(result.layout.deletedPages).toEqual([1, 4])
  })

  it("applies change_patch_fill by recording patch fill state", () => {
    const result = applyRepairSuggestion(
      emptyLayout,
      suggestion({
        type: "change_patch_fill",
        proposedAction: {
          type: "change_patch_fill",
          pageIndex: 0,
          regionId: "region-1",
          fillMode: "white",
        },
      })
    )

    expect(result.applied).toBe(true)
    expect(result.layout.patchFills).toEqual({
      [getPatchFillKey({ pageIndex: 0, regionId: "region-1" })]: {
        pageIndex: 0,
        regionId: "region-1",
        mode: "white",
        color: undefined,
      },
    })
  })

  it("keeps undo and redo compatible by returning immutable layout snapshots", () => {
    const before = {
      ...emptyLayout,
      deletedPages: [0],
    }
    const applied = applyRepairSuggestion(
      before,
      suggestion({
        type: "delete_page",
        proposedAction: {
          type: "delete_page",
          pageIndex: 3,
        },
      })
    ).layout

    const undoSnapshot = before
    const redoSnapshot = applied

    expect(applied).not.toBe(before)
    expect(undoSnapshot.deletedPages).toEqual([0])
    expect(redoSnapshot.deletedPages).toEqual([0, 3])
  })
})

