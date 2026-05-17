import type { PdfLayoutEditState, PdfPatchFill } from "@/lib/project-schema"
import type { RepairSuggestion, RepairSuggestionAction } from "@/lib/pdf-repair/suggestions"

export type ApplicableRepairSuggestionActionType =
  | "delete_page"
  | "restore_page"
  | "change_patch_fill"

export interface ApplyRepairSuggestionResult {
  applied: boolean
  layout: PdfLayoutEditState
  reason?: string
}

export function isRepairSuggestionApplicable(suggestion: RepairSuggestion) {
  return isApplicableAction(suggestion.proposedAction)
}

export function applyRepairSuggestion(
  layout: PdfLayoutEditState,
  suggestion: RepairSuggestion
): ApplyRepairSuggestionResult {
  const action = suggestion.proposedAction

  if (!isApplicableAction(action)) {
    return {
      applied: false,
      layout,
      reason: `${action.type} suggestions are not applicable yet.`,
    }
  }

  if (action.type === "delete_page") {
    const deletedPages = new Set(layout.deletedPages)
    deletedPages.add(action.pageIndex)

    return {
      applied: true,
      layout: {
        ...layout,
        deletedPages: Array.from(deletedPages).sort((a, b) => a - b),
      },
    }
  }

  if (action.type === "restore_page") {
    return {
      applied: true,
      layout: {
        ...layout,
        deletedPages: layout.deletedPages.filter((pageIndex) => pageIndex !== action.pageIndex),
      },
    }
  }

  const patchFill = toPatchFill(action)
  const key = getPatchFillKey(patchFill)

  return {
    applied: true,
    layout: {
      ...layout,
      patchFills: {
        ...(layout.patchFills ?? {}),
        [key]: patchFill,
      },
    },
  }
}

export function getPatchFillKey(fill: Pick<PdfPatchFill, "pageIndex" | "regionId">) {
  return fill.regionId ? `region:${fill.regionId}` : `page:${fill.pageIndex}`
}

function isApplicableAction(
  action: RepairSuggestionAction
): action is Extract<RepairSuggestionAction, { type: ApplicableRepairSuggestionActionType }> {
  return (
    action.type === "delete_page" ||
    action.type === "restore_page" ||
    action.type === "change_patch_fill"
  )
}

function toPatchFill(
  action: Extract<RepairSuggestionAction, { type: "change_patch_fill" }>
): PdfPatchFill {
  return {
    pageIndex: action.pageIndex,
    regionId: action.regionId,
    mode: action.fillMode,
    color: action.color,
  }
}

