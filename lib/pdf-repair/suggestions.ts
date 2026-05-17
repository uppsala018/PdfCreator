import type { PdfLayoutBlock } from "@/lib/project-schema"

export type RepairSuggestionActionType =
  | "delete_page"
  | "restore_page"
  | "change_patch_fill"
  | "flag_manual_review"
  | "move_region"
  | "resize_region"
  | "add_text_overlay"
  | "edit_text_overlay"
  | "add_image_overlay"
  | "suggest_recompose_in_professional_composer"

export type AppliedRepairSuggestionActionType =
  | "delete_page"
  | "restore_page"
  | "change_patch_fill"

export type FutureRepairSuggestionActionType = Exclude<
  RepairSuggestionActionType,
  AppliedRepairSuggestionActionType
>

export type RepairSuggestionSeverity = "info" | "low" | "medium" | "high" | "critical"

export type RepairSuggestionStatus = "pending" | "applied" | "skipped" | "dismissed"

export type RepairSuggestionConfidence = number

export type RepairSuggestionSource = "rule_based" | "ai_semantic" | "visual_qa" | "manual"

export type RepairSuggestionCoordinateSpace = "normalized" | "pdf_points" | "rendered_pixels"

export interface RepairSuggestionPageRef {
  pageIndex: number
  pageNumber: number
}

export interface RepairSuggestionRegion {
  pageIndex: number
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
  coordinateSpace: RepairSuggestionCoordinateSpace
  blockId?: string
}

export type RepairSuggestionMetadataValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | Record<string, unknown>

export type RepairSuggestionMetadata = Record<string, RepairSuggestionMetadataValue>

export interface DeletePageRepairAction {
  type: "delete_page"
  pageIndex: number
}

export interface RestorePageRepairAction {
  type: "restore_page"
  pageIndex: number
}

export interface ChangePatchFillRepairAction {
  type: "change_patch_fill"
  pageIndex: number
  regionId?: string
  fillMode: "white" | "sampled_background" | "custom_color"
  color?: string
}

export interface FlagManualReviewRepairAction {
  type: "flag_manual_review"
  issueCode: string
}

export interface MoveRegionRepairAction {
  type: "move_region"
  regionId: string
  x: number
  y: number
}

export interface ResizeRegionRepairAction {
  type: "resize_region"
  regionId: string
  width: number
  height: number
}

export interface AddTextOverlayRepairAction {
  type: "add_text_overlay"
  pageIndex: number
  text: string
  region?: RepairSuggestionRegion
}

export interface EditTextOverlayRepairAction {
  type: "edit_text_overlay"
  overlayId: string
  text: string
}

export interface AddImageOverlayRepairAction {
  type: "add_image_overlay"
  pageIndex: number
  imageAssetId?: string
  region?: RepairSuggestionRegion
}

export interface SuggestRecomposeRepairAction {
  type: "suggest_recompose_in_professional_composer"
  reasonCode: string
}

export type RepairSuggestionAction =
  | DeletePageRepairAction
  | RestorePageRepairAction
  | ChangePatchFillRepairAction
  | FlagManualReviewRepairAction
  | MoveRegionRepairAction
  | ResizeRegionRepairAction
  | AddTextOverlayRepairAction
  | EditTextOverlayRepairAction
  | AddImageOverlayRepairAction
  | SuggestRecomposeRepairAction

export interface RepairSuggestion {
  id: string
  projectId?: string
  type: RepairSuggestionActionType
  severity: RepairSuggestionSeverity
  confidence: RepairSuggestionConfidence
  affectedPage: RepairSuggestionPageRef
  affectedRegion?: RepairSuggestionRegion
  reason: string
  proposedAction: RepairSuggestionAction
  beforeMetadata?: RepairSuggestionMetadata
  afterMetadata?: RepairSuggestionMetadata
  status: RepairSuggestionStatus
  source: RepairSuggestionSource
  issueCode: string
  createdAt?: string
  appliedAt?: string
}

export function pageRef(pageIndex: number): RepairSuggestionPageRef {
  return {
    pageIndex,
    pageNumber: pageIndex + 1,
  }
}

export function regionFromLayoutBlock(block: PdfLayoutBlock): RepairSuggestionRegion {
  return {
    pageIndex: block.pageIndex,
    pageNumber: block.pageIndex + 1,
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height,
    coordinateSpace: "normalized",
    blockId: block.id,
  }
}

export function createRepairSuggestionId(parts: Array<string | number | undefined | null>) {
  return parts
    .filter((part) => part !== undefined && part !== null && String(part).length > 0)
    .map((part) =>
      String(part)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    )
    .filter(Boolean)
    .join(":")
}
