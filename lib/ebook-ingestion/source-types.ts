export type SourceInputKind = "plain_text" | "markdown"

export type SourceBlockType = "heading" | "paragraph" | "list" | "thematic_break"

export interface SourceMetadata {
  title?: string
  inputKind: SourceInputKind
  originalLength: number
  sanitizedLength: number
  wordCount: number
  lineCount: number
}

export interface SourceHeading {
  text: string
  depth: number
  lineNumber: number
}

export interface SourceBlock {
  id: string
  type: SourceBlockType
  text: string
  lineStart: number
  lineEnd: number
  headingDepth?: number
  listItems?: string[]
}

export interface SourceSection {
  id: string
  title: string
  depth: number
  lineStart: number
  lineEnd: number
  blocks: SourceBlock[]
  likelyChapterBreak: boolean
}

export interface SourceHierarchyEstimate {
  headings: SourceHeading[]
  maxDepth: number
  likelyChapterTitles: string[]
  hasExplicitStructure: boolean
}

export type IngestionDiagnosticSeverity = "info" | "warning" | "error"

export interface IngestionDiagnostic {
  code:
    | "empty_source"
    | "empty_section"
    | "giant_paragraph"
    | "malformed_markdown"
    | "excessive_heading_depth"
    | "sparse_source"
  severity: IngestionDiagnosticSeverity
  message: string
  lineNumber?: number
  sectionId?: string
}

export interface SourceDocument {
  id: string
  metadata: SourceMetadata
  rawText: string
  sanitizedText: string
  sections: SourceSection[]
  hierarchy: SourceHierarchyEstimate
  diagnostics: IngestionDiagnostic[]
}

export interface SourceChunk {
  id: string
  sectionIds: string[]
  text: string
  wordCount: number
  estimatedTokens: number
}

export interface ChunkingOptions {
  targetWords?: number
  maxWords?: number
}
