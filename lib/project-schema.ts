// ─── Block types ────────────────────────────────────────────────────────────

export type BlockType =
  | "heading"
  | "subheading"
  | "paragraph"
  | "prompt_card"
  | "pro_tip"
  | "table"
  | "page_break"
  | "chapter_divider"

export interface BlockMetadata {
  rows?: string[][]   // table rows: outer array = rows, inner = cells
  level?: number      // reserved for future heading levels
}

export interface Block {
  id: string
  type: BlockType
  content: string
  metadata?: BlockMetadata
}

// ─── Chapter ─────────────────────────────────────────────────────────────────

export interface Chapter {
  id: string
  title: string
  blocks: Block[]
}

// ─── Project ─────────────────────────────────────────────────────────────────

export type Theme = "dark-cinematic" | "clean-minimal"

export interface Project {
  title: string
  subtitle: string
  author: string
  website: string
  theme: Theme
  template: string
  chapters: Chapter[]
}

// ─── Project as stored in the `content` JSONB column ─────────────────────────

export type ProjectType = "ebook" | "imported_pdf"

export interface ImportedPdfPageSize {
  width: number
  height: number
  unit: "pt"
}

export interface ImportedPdfInfo {
  status: "imported"
  originalFilename: string
  storageBucket: string
  storagePath: string
  pageCount: number | null
  pageSize: ImportedPdfPageSize | null
  importedAt: string
}

export type PdfLayoutBlockType = "visual_region" | "text_overlay"

export interface PdfLayoutBlock {
  id: string
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
  sourcePageIndex?: number
  sourceX?: number
  sourceY?: number
  sourceWidth?: number
  sourceHeight?: number
  type: PdfLayoutBlockType
  label?: string
  locked?: boolean
  // Future text editing can attach extracted text, replacement text,
  // font metadata, and overlay rendering instructions here.
  textOverlay?: Record<string, unknown>
}

export interface PdfLayoutEditState {
  version: 1
  deletedPageIds?: string[]
  deletedPages: number[]
  pageOrder: string[]
  visualBlocks: PdfLayoutBlock[]
  textOverlays: Record<string, unknown>
}

export interface ProjectContent {
  projectType?: ProjectType
  chapters: Chapter[]
  importedPdf?: ImportedPdfInfo
  layoutEditState?: PdfLayoutEditState
}

// ─── Database row shape (mirrors 001_initial.sql exactly) ────────────────────

export interface ProjectRow {
  id: string
  user_id: string
  title: string
  subtitle: string | null
  author: string | null
  website: string | null
  theme: string
  template: string
  content: ProjectContent
  created_at: string
  updated_at: string
}

export interface ExportRow {
  id: string
  project_id: string
  user_id: string
  file_path: string | null
  created_at: string
}
