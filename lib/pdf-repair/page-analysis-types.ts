export type RenderedPageImageSource =
  | "pdfjs_canvas"
  | "server_render"
  | "uploaded_raster"
  | "future_renderer"

export type RenderedBoundingBoxCoordinateSpace = "rendered_pixels" | "normalized"

export interface RenderedBoundingBox {
  x: number
  y: number
  width: number
  height: number
  coordinateSpace: RenderedBoundingBoxCoordinateSpace
  unit: "px" | "ratio"
}

export interface RenderedPageImageMetadata {
  pageIndex: number
  pageNumber: number
  width: number
  height: number
  scale: number
  rotation: number
  source: RenderedPageImageSource
  extractedAt?: string
}

export type PageVisualIssueSeverity = "info" | "low" | "medium" | "high" | "critical"

export interface PageVisualIssueBase {
  id: string
  pageIndex: number
  pageNumber: number
  severity: PageVisualIssueSeverity
  confidence: number
  boundingBox?: RenderedBoundingBox
  message: string
  evidence?: Record<string, string | number | boolean | null>
}

export interface VisualOverlapRisk extends PageVisualIssueBase {
  kind: "visual_overlap_risk"
  overlappingBoxes: RenderedBoundingBox[]
}

export interface ContrastRisk extends PageVisualIssueBase {
  kind: "contrast_risk"
  foregroundSample?: string
  backgroundSample?: string
  contrastRatio?: number
}

export interface SparsePageRisk extends PageVisualIssueBase {
  kind: "sparse_page_risk"
  estimatedInkCoverage?: number
}

export interface EdgeOverflowRisk extends PageVisualIssueBase {
  kind: "edge_overflow_risk"
  edge: "top" | "right" | "bottom" | "left" | "multiple"
}

export type PageVisualIssue =
  | VisualOverlapRisk
  | ContrastRisk
  | SparsePageRisk
  | EdgeOverflowRisk

export interface FutureOcrTextRun {
  text: string
  boundingBox: RenderedBoundingBox
  confidence?: number
  language?: string
}

export interface FutureOcrAnalysis {
  status: "not_implemented" | "not_requested" | "ready"
  textRuns: FutureOcrTextRun[]
  engine?: "future_local_ocr" | "future_ai_ocr"
}

export interface FuturePixelAnalysisHooks {
  status: "not_implemented" | "ready"
  sampledBackgrounds: RenderedBoundingBox[]
  detectedEdges: RenderedBoundingBox[]
  detectedInkBounds?: RenderedBoundingBox
}

export interface RenderedPageAnalysis {
  version: 1
  pageIndex: number
  pageNumber: number
  image: RenderedPageImageMetadata
  renderedDimensions: {
    width: number
    height: number
    unit: "px"
  }
  visualIssues: PageVisualIssue[]
  ocr: FutureOcrAnalysis
  pixelAnalysis: FuturePixelAnalysisHooks
  analyzedAt: string
}
