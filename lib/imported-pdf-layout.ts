import type {
  PdfLayoutBlock,
  PdfLayoutEditState,
  PdfPatchFill,
} from "@/lib/project-schema"

const DEFAULT_LAYOUT: PdfLayoutEditState = {
  version: 1,
  deletedPages: [],
  pageOrder: [],
  visualBlocks: [],
  textOverlays: {},
  patchFills: {},
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeDeletedPages(input: unknown): number[] {
  if (!Array.isArray(input)) return []
  return Array.from(
    new Set(
      input
        .filter((value): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0)
        .sort((a, b) => a - b)
    )
  )
}

function normalizePageOrder(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.filter((value): value is string => typeof value === "string")
}

function normalizeVisualBlock(value: unknown, index: number): PdfLayoutBlock | null {
  if (typeof value !== "object" || value === null) return null
  const block = value as Partial<PdfLayoutBlock>
  if (
    typeof block.id !== "string" ||
    typeof block.pageIndex !== "number" ||
    typeof block.x !== "number" ||
    typeof block.y !== "number" ||
    typeof block.width !== "number" ||
    typeof block.height !== "number" ||
    (block.type !== "visual_region" && block.type !== "text_overlay")
  ) {
    return null
  }

  return {
    id: block.id || `block-${index}`,
    pageIndex: block.pageIndex,
    x: clamp(block.x, 0, 1),
    y: clamp(block.y, 0, 1),
    width: clamp(block.width, 0.01, 1),
    height: clamp(block.height, 0.01, 1),
    sourcePageIndex: typeof block.sourcePageIndex === "number" ? block.sourcePageIndex : undefined,
    sourceX: typeof block.sourceX === "number" ? block.sourceX : undefined,
    sourceY: typeof block.sourceY === "number" ? block.sourceY : undefined,
    sourceWidth: typeof block.sourceWidth === "number" ? block.sourceWidth : undefined,
    sourceHeight: typeof block.sourceHeight === "number" ? block.sourceHeight : undefined,
    type: block.type,
    label: typeof block.label === "string" ? block.label : undefined,
    locked: Boolean(block.locked),
    textOverlay:
      typeof block.textOverlay === "object" && block.textOverlay !== null
        ? (block.textOverlay as Record<string, unknown>)
        : undefined,
  }
}

function normalizeRecord(input: unknown): Record<string, unknown> {
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    return input as Record<string, unknown>
  }

  if (!Array.isArray(input)) return {}
  return Object.fromEntries(
    input
      .filter((item): item is { id: string } => {
        return typeof item === "object" && item !== null && typeof (item as { id?: unknown }).id === "string"
      })
      .map((item) => [item.id, item])
  )
}

function normalizePatchFills(input: unknown): Record<string, PdfPatchFill> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return {}
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).filter((entry): entry is [string, PdfPatchFill] => {
      const fill = entry[1] as Partial<PdfPatchFill>
      return (
        typeof fill === "object" &&
        fill !== null &&
        typeof fill.pageIndex === "number" &&
        (fill.mode === "transparent" ||
          fill.mode === "white" ||
          fill.mode === "sampled_background" ||
          fill.mode === "custom_color")
      )
    })
  )
}

export function normalizeImportedPdfLayout(value?: unknown): PdfLayoutEditState {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}
  const rawVisualBlocks = raw.visualBlocks

  return {
    ...DEFAULT_LAYOUT,
    deletedPages: normalizeDeletedPages(raw.deletedPages ?? raw.deletedPageIds),
    pageOrder: normalizePageOrder(raw.pageOrder),
    visualBlocks: Array.isArray(rawVisualBlocks)
      ? rawVisualBlocks.map(normalizeVisualBlock).filter((block): block is PdfLayoutBlock => block !== null)
      : [],
    textOverlays: normalizeRecord(raw.textOverlays),
    patchFills: normalizePatchFills(raw.patchFills),
  }
}

export function createDefaultImportedPdfLayout(): PdfLayoutEditState {
  return normalizeImportedPdfLayout()
}
