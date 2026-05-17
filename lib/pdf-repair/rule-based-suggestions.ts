import type { PdfLayoutBlock, PdfLayoutEditState, PdfPatchFill } from "@/lib/project-schema"
import {
  createRepairSuggestionId,
  pageRef,
  regionFromLayoutBlock,
  type RepairSuggestion,
  type RepairSuggestionMetadata,
  type RepairSuggestionRegion,
} from "@/lib/pdf-repair/suggestions"

export interface BlankPageDiagnostic {
  pageIndex: number
  blankScore?: number
  reason?: string
}

export type PatchFillDiagnostic = PdfPatchFill

export interface SplitTableDiagnostic {
  pageIndex: number
  regionId?: string
  confidence?: number
  shouldSuggestRecompose?: boolean
  reason?: string
}

export interface RuleBasedRepairSuggestionInput {
  projectId?: string
  layout: PdfLayoutEditState
  pageCount?: number | null
  blankPages?: BlankPageDiagnostic[]
  patchFills?: PatchFillDiagnostic[]
  splitTables?: SplitTableDiagnostic[]
}

const EDGE_MARGIN = 0.02
const OVERSIZED_AREA = 0.75
const OVERSIZED_DIMENSION = 0.92
const OVERLAP_AREA = 0.01

// Suggestions are computed from the current layout state for now. A later
// persistence phase can store reviewed suggestions on layoutEditState.repairSuggestions.
export function generateRuleBasedRepairSuggestions(
  input: RuleBasedRepairSuggestionInput
): RepairSuggestion[] {
  const suggestions: RepairSuggestion[] = []
  const deletedPages = new Set(input.layout.deletedPages)
  const blocks = input.layout.visualBlocks ?? []
  const patchFills = [...Object.values(input.layout.patchFills ?? {}), ...(input.patchFills ?? [])]

  for (const blankPage of input.blankPages ?? []) {
    if (deletedPages.has(blankPage.pageIndex)) continue
    suggestions.push(
      createSuggestion({
        projectId: input.projectId,
        issueCode: "blank_page",
        type: "delete_page",
        pageIndex: blankPage.pageIndex,
        severity: "high",
        confidence: clampConfidence(blankPage.blankScore ?? 0.9),
        reason: blankPage.reason ?? `Page ${blankPage.pageIndex + 1} appears to be blank.`,
        proposedAction: {
          type: "delete_page",
          pageIndex: blankPage.pageIndex,
        },
        beforeMetadata: {
          blankScore: blankPage.blankScore ?? 0.9,
        },
      })
    )
  }

  for (const pageIndex of Array.from(deletedPages).sort((a, b) => a - b)) {
    suggestions.push(
      createSuggestion({
        projectId: input.projectId,
        issueCode: "deleted_page_review",
        type: "restore_page",
        pageIndex,
        severity: "info",
        confidence: 0.7,
        reason: `Page ${pageIndex + 1} is currently marked for deletion. Review before exporting.`,
        proposedAction: {
          type: "restore_page",
          pageIndex,
        },
        beforeMetadata: {
          deleted: true,
        },
        afterMetadata: {
          deleted: false,
        },
      })
    )
  }

  for (const patchFill of patchFills) {
    const block = patchFill.regionId ? blocks.find((candidate) => candidate.id === patchFill.regionId) : undefined
    if (patchFill.mode === "transparent") {
      suggestions.push(
        createSuggestion({
          projectId: input.projectId,
          issueCode: "transparent_patch_fill",
          type: "change_patch_fill",
          pageIndex: patchFill.pageIndex,
          region: block ? regionFromLayoutBlock(block) : undefined,
          severity: "medium",
          confidence: 0.82,
          reason: "A transparent patch fill may expose source content after a region is moved or copied.",
          proposedAction: {
            type: "change_patch_fill",
            pageIndex: patchFill.pageIndex,
            regionId: patchFill.regionId,
            fillMode: "white",
          },
          beforeMetadata: patchFillMetadata(patchFill),
          afterMetadata: {
            mode: "white",
          },
        })
      )
    }

    if (patchFill.mode === "custom_color") {
      suggestions.push(
        createSuggestion({
          projectId: input.projectId,
          issueCode: "custom_patch_color_review",
          type: "flag_manual_review",
          pageIndex: patchFill.pageIndex,
          region: block ? regionFromLayoutBlock(block) : undefined,
          severity: "low",
          confidence: 0.75,
          reason: "A custom patch color should be checked against the surrounding page background.",
          proposedAction: {
            type: "flag_manual_review",
            issueCode: "custom_patch_color_review",
          },
          beforeMetadata: patchFillMetadata(patchFill),
        })
      )
    }
  }

  for (const block of blocks) {
    if (block.type !== "visual_region") continue
    if (isOversized(block)) {
      suggestions.push(
        regionReviewSuggestion({
          projectId: input.projectId,
          issueCode: "oversized_region",
          block,
          severity: "medium",
          confidence: 0.8,
          reason: `${block.label ?? "A visual region"} covers most of page ${block.pageIndex + 1}. Review whether it should be split or recomposed.`,
          beforeMetadata: {
            width: block.width,
            height: block.height,
            area: block.width * block.height,
          },
        })
      )
    }

    if (isNearPageEdge(block)) {
      suggestions.push(
        regionReviewSuggestion({
          projectId: input.projectId,
          issueCode: "region_near_page_edge",
          block,
          severity: "medium",
          confidence: 0.78,
          reason: `${block.label ?? "A visual region"} is close to the page edge and may export with cramped spacing.`,
          beforeMetadata: {
            edgeMargin: EDGE_MARGIN,
            x: block.x,
            y: block.y,
            right: block.x + block.width,
            bottom: block.y + block.height,
          },
        })
      )
    }
  }

  for (const [first, second] of overlappingBlockPairs(blocks)) {
    const overlap = getOverlap(first, second)
    suggestions.push(
      createSuggestion({
        projectId: input.projectId,
        issueCode: "overlapping_regions",
        type: "flag_manual_review",
        pageIndex: first.pageIndex,
        region: regionFromLayoutBlock(first),
        severity: "high",
        confidence: 0.86,
        reason: `${first.label ?? first.id} overlaps ${second.label ?? second.id} on page ${first.pageIndex + 1}.`,
        proposedAction: {
          type: "flag_manual_review",
          issueCode: "overlapping_regions",
        },
        beforeMetadata: {
          firstRegionId: first.id,
          secondRegionId: second.id,
          overlapArea: overlap.area,
        },
      })
    )
  }

  for (const splitTable of input.splitTables ?? []) {
    const actionType = splitTable.shouldSuggestRecompose
      ? "suggest_recompose_in_professional_composer"
      : "flag_manual_review"
    suggestions.push(
      createSuggestion({
        projectId: input.projectId,
        issueCode: splitTable.shouldSuggestRecompose ? "split_table_recompose_candidate" : "split_table_review",
        type: actionType,
        pageIndex: splitTable.pageIndex,
        severity: splitTable.shouldSuggestRecompose ? "high" : "medium",
        confidence: clampConfidence(splitTable.confidence ?? 0.65),
        reason:
          splitTable.reason ??
          "A table appears to be split awkwardly. Review whether visual repair or recomposition is more appropriate.",
        proposedAction: splitTable.shouldSuggestRecompose
          ? {
              type: "suggest_recompose_in_professional_composer",
              reasonCode: "split_table_recompose_candidate",
            }
          : {
              type: "flag_manual_review",
              issueCode: "split_table_review",
            },
        beforeMetadata: {
          regionId: splitTable.regionId ?? null,
        },
      })
    )
  }

  return dedupeSuggestions(suggestions)
}

function createSuggestion(input: {
  projectId?: string
  issueCode: string
  type: RepairSuggestion["type"]
  pageIndex: number
  region?: RepairSuggestionRegion
  severity: RepairSuggestion["severity"]
  confidence: number
  reason: string
  proposedAction: RepairSuggestion["proposedAction"]
  beforeMetadata?: RepairSuggestionMetadata
  afterMetadata?: RepairSuggestionMetadata
}): RepairSuggestion {
  return {
    id: createRepairSuggestionId([
      input.type,
      input.issueCode,
      `page-${input.pageIndex + 1}`,
      input.region?.blockId,
    ]),
    projectId: input.projectId,
    type: input.type,
    severity: input.severity,
    confidence: clampConfidence(input.confidence),
    affectedPage: pageRef(input.pageIndex),
    affectedRegion: input.region,
    reason: input.reason,
    proposedAction: input.proposedAction,
    beforeMetadata: input.beforeMetadata,
    afterMetadata: input.afterMetadata,
    status: "pending",
    source: "rule_based",
    issueCode: input.issueCode,
  }
}

function regionReviewSuggestion(input: {
  projectId?: string
  issueCode: string
  block: PdfLayoutBlock
  severity: RepairSuggestion["severity"]
  confidence: number
  reason: string
  beforeMetadata?: RepairSuggestionMetadata
}) {
  return createSuggestion({
    projectId: input.projectId,
    issueCode: input.issueCode,
    type: "flag_manual_review",
    pageIndex: input.block.pageIndex,
    region: regionFromLayoutBlock(input.block),
    severity: input.severity,
    confidence: input.confidence,
    reason: input.reason,
    proposedAction: {
      type: "flag_manual_review",
      issueCode: input.issueCode,
    },
    beforeMetadata: {
      regionId: input.block.id,
      ...input.beforeMetadata,
    },
  })
}

function isOversized(block: PdfLayoutBlock) {
  return (
    block.width >= OVERSIZED_DIMENSION ||
    block.height >= OVERSIZED_DIMENSION ||
    block.width * block.height >= OVERSIZED_AREA
  )
}

function isNearPageEdge(block: PdfLayoutBlock) {
  return (
    block.x <= EDGE_MARGIN ||
    block.y <= EDGE_MARGIN ||
    block.x + block.width >= 1 - EDGE_MARGIN ||
    block.y + block.height >= 1 - EDGE_MARGIN
  )
}

function overlappingBlockPairs(blocks: PdfLayoutBlock[]) {
  const visualBlocks = blocks.filter((block) => block.type === "visual_region")
  const pairs: Array<[PdfLayoutBlock, PdfLayoutBlock]> = []

  for (let i = 0; i < visualBlocks.length; i += 1) {
    for (let j = i + 1; j < visualBlocks.length; j += 1) {
      const first = visualBlocks[i]
      const second = visualBlocks[j]
      if (first.pageIndex !== second.pageIndex) continue
      if (getOverlap(first, second).area >= OVERLAP_AREA) {
        pairs.push([first, second])
      }
    }
  }

  return pairs
}

function getOverlap(first: PdfLayoutBlock, second: PdfLayoutBlock) {
  const left = Math.max(first.x, second.x)
  const right = Math.min(first.x + first.width, second.x + second.width)
  const top = Math.max(first.y, second.y)
  const bottom = Math.min(first.y + first.height, second.y + second.height)
  const width = Math.max(0, right - left)
  const height = Math.max(0, bottom - top)

  return {
    width,
    height,
    area: width * height,
  }
}

function patchFillMetadata(patchFill: PatchFillDiagnostic): RepairSuggestionMetadata {
  return {
    mode: patchFill.mode,
    regionId: patchFill.regionId ?? null,
    color: patchFill.color ?? null,
  }
}

function clampConfidence(confidence: number) {
  return Math.max(0, Math.min(1, confidence))
}

function dedupeSuggestions(suggestions: RepairSuggestion[]) {
  const seen = new Set<string>()
  return suggestions.filter((suggestion) => {
    if (seen.has(suggestion.id)) return false
    seen.add(suggestion.id)
    return true
  })
}
