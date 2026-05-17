import { describe, expect, it } from "vitest"
import type { PdfLayoutBlock, PdfLayoutEditState } from "@/lib/project-schema"
import { generateRuleBasedRepairSuggestions } from "@/lib/pdf-repair/rule-based-suggestions"
import type {
  FutureRepairSuggestionActionType,
  RepairSuggestionAction,
} from "@/lib/pdf-repair/suggestions"

const emptyLayout: PdfLayoutEditState = {
  version: 1,
  deletedPages: [],
  pageOrder: [],
  visualBlocks: [],
  textOverlays: {},
}

function block(overrides: Partial<PdfLayoutBlock>): PdfLayoutBlock {
  return {
    id: "region-1",
    pageIndex: 0,
    x: 0.1,
    y: 0.1,
    width: 0.2,
    height: 0.2,
    type: "visual_region",
    label: "Region 1",
    ...overrides,
  }
}

describe("generateRuleBasedRepairSuggestions", () => {
  it("produces a delete_page suggestion for a blank page", () => {
    const suggestions = generateRuleBasedRepairSuggestions({
      layout: emptyLayout,
      blankPages: [{ pageIndex: 1, blankScore: 0.96 }],
    })

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]).toMatchObject({
      id: "delete-page:blank-page:page-2",
      type: "delete_page",
      severity: "high",
      confidence: 0.96,
      affectedPage: { pageIndex: 1, pageNumber: 2 },
      proposedAction: { type: "delete_page", pageIndex: 1 },
      status: "pending",
      source: "rule_based",
    })
  })

  it("produces an informational restore_page suggestion for a deleted page", () => {
    const suggestions = generateRuleBasedRepairSuggestions({
      layout: {
        ...emptyLayout,
        deletedPages: [2],
      },
    })

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]).toMatchObject({
      id: "restore-page:deleted-page-review:page-3",
      type: "restore_page",
      severity: "info",
      affectedPage: { pageIndex: 2, pageNumber: 3 },
      proposedAction: { type: "restore_page", pageIndex: 2 },
    })
  })

  it("produces a change_patch_fill warning for transparent patch mode", () => {
    const suggestions = generateRuleBasedRepairSuggestions({
      layout: {
        ...emptyLayout,
        visualBlocks: [block({ id: "region-2" })],
      },
      patchFills: [{ pageIndex: 0, regionId: "region-2", mode: "transparent" }],
    })

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]).toMatchObject({
      id: "change-patch-fill:transparent-patch-fill:page-1:region-2",
      type: "change_patch_fill",
      severity: "medium",
      proposedAction: {
        type: "change_patch_fill",
        pageIndex: 0,
        regionId: "region-2",
        fillMode: "white",
      },
      affectedRegion: {
        blockId: "region-2",
        coordinateSpace: "normalized",
      },
    })
  })

  it("produces a manual-review warning for overlapping regions", () => {
    const suggestions = generateRuleBasedRepairSuggestions({
      layout: {
        ...emptyLayout,
        visualBlocks: [
          block({ id: "region-a", label: "Region A", x: 0.1, y: 0.1, width: 0.4, height: 0.4 }),
          block({ id: "region-b", label: "Region B", x: 0.3, y: 0.3, width: 0.3, height: 0.3 }),
        ],
      },
    })

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]).toMatchObject({
      id: "flag-manual-review:overlapping-regions:page-1:region-a",
      type: "flag_manual_review",
      severity: "high",
      proposedAction: {
        type: "flag_manual_review",
        issueCode: "overlapping_regions",
      },
      beforeMetadata: {
        firstRegionId: "region-a",
        secondRegionId: "region-b",
      },
    })
  })

  it("keeps unsupported future actions typed but separate from applied actions", () => {
    const futureAction: FutureRepairSuggestionActionType = "move_region"
    const action: RepairSuggestionAction = {
      type: futureAction,
      regionId: "region-1",
      x: 0.25,
      y: 0.3,
    }

    expect(action).toEqual({
      type: "move_region",
      regionId: "region-1",
      x: 0.25,
      y: 0.3,
    })
  })
})

