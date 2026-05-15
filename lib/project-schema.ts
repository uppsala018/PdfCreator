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

export interface ProjectContent {
  chapters: Chapter[]
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
