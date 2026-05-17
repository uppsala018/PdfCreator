import type {
  FutureOcrAnalysis,
  FuturePixelAnalysisHooks,
  RenderedBoundingBox,
  RenderedPageAnalysis,
  RenderedPageImageMetadata,
  RenderedPageImageSource,
} from "@/lib/pdf-repair/page-analysis-types"

export type RenderedPageAnalysisPipelineStage =
  | "pdf_page_render"
  | "canvas_image_extraction"
  | "visual_issue_analysis"
  | "repair_suggestion_generation"

export const RENDERED_PAGE_ANALYSIS_PIPELINE: RenderedPageAnalysisPipelineStage[] = [
  "pdf_page_render",
  "canvas_image_extraction",
  "visual_issue_analysis",
  "repair_suggestion_generation",
]

export interface RenderedPageImageMetadataInput {
  pageIndex: number
  width: number
  height: number
  scale?: number
  rotation?: number
  source?: RenderedPageImageSource
  extractedAt?: string
}

export interface AnalyzeRenderedPageInput {
  image: RenderedPageImageMetadata
  analyzedAt?: string
}

// Current imported-PDF diagnostics are intentionally heuristic: they use stored
// layout metadata such as deleted pages, visual regions, and patch fills. This
// module is the future rendered-page visual QA boundary, where actual page
// pixels can be inspected without coupling pixel/OCR work to repair actions.
export function createRenderedPageImageMetadata(
  input: RenderedPageImageMetadataInput
): RenderedPageImageMetadata {
  return {
    pageIndex: input.pageIndex,
    pageNumber: input.pageIndex + 1,
    width: input.width,
    height: input.height,
    scale: input.scale ?? 1,
    rotation: input.rotation ?? 0,
    source: input.source ?? "future_renderer",
    extractedAt: input.extractedAt,
  }
}

export function analyzeRenderedPagePlaceholder(
  input: AnalyzeRenderedPageInput
): RenderedPageAnalysis {
  return {
    version: 1,
    pageIndex: input.image.pageIndex,
    pageNumber: input.image.pageNumber,
    image: input.image,
    renderedDimensions: {
      width: input.image.width,
      height: input.image.height,
      unit: "px",
    },
    visualIssues: [],
    ocr: createFutureOcrPlaceholder(),
    pixelAnalysis: createFuturePixelAnalysisPlaceholder(),
    analyzedAt: input.analyzedAt ?? new Date().toISOString(),
  }
}

export function analyzeRenderedPagesPlaceholder(
  images: RenderedPageImageMetadata[],
  analyzedAt?: string
): RenderedPageAnalysis[] {
  return images.map((image) => analyzeRenderedPagePlaceholder({ image, analyzedAt }))
}

export function createFutureOcrPlaceholder(): FutureOcrAnalysis {
  return {
    status: "not_implemented",
    textRuns: [],
  }
}

export function createFuturePixelAnalysisPlaceholder(): FuturePixelAnalysisHooks {
  return {
    status: "not_implemented",
    sampledBackgrounds: [],
    detectedEdges: [],
  }
}

export function normalizeRenderedBoundingBox(
  box: RenderedBoundingBox,
  dimensions: { width: number; height: number }
): RenderedBoundingBox {
  if (box.coordinateSpace === "normalized") return box

  return {
    x: safeRatio(box.x, dimensions.width),
    y: safeRatio(box.y, dimensions.height),
    width: safeRatio(box.width, dimensions.width),
    height: safeRatio(box.height, dimensions.height),
    coordinateSpace: "normalized",
    unit: "ratio",
  }
}

function safeRatio(value: number, total: number) {
  if (total <= 0) return 0
  return clamp(value / total, 0, 1)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
