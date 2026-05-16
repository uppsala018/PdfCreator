import type { ComposerBlock, ComposerEbook } from "@/lib/export/project-to-schema"
import type { ExportTheme } from "@/lib/export/theme-mapping"

export type AiEbookFormat =
  | "luxury-lead-magnet"
  | "workbook"
  | "consultant-guide"
  | "cinematic-ebook"
  | "educational-handbook"

export type AiBlockType = ComposerBlock["type"]

export const AI_BLOCK_TYPES: readonly AiBlockType[] = [
  "paragraph",
  "heading",
  "subheading",
  "bullet_list",
  "numbered_list",
  "tip_box",
  "warning_box",
  "key_takeaway",
  "prompt_block",
  "comparison_table",
  "workflow_step",
  "cta_box",
  "divider",
  "spacer",
] as const

export interface AiGenerationRequest {
  topic: string
  audience?: string
  outcome?: string
  author?: string
  brand?: string
  format?: AiEbookFormat
  theme?: ExportTheme
  chapterCount?: number
}

export interface AiEbookGeneration {
  title?: string
  subtitle?: string
  author?: string
  brand?: string
  theme?: ExportTheme
  format?: AiEbookFormat
  chapters?: AiChapterGeneration[]
  cta?: AiCtaGeneration
  metadata?: Record<string, unknown>
}

export interface AiChapterGeneration {
  title?: string
  intro?: string
  sections?: AiSectionGeneration[]
}

export interface AiSectionGeneration {
  title?: string
  blocks?: AiBlockGeneration[]
}

export type AiBlockGeneration =
  | { type?: "paragraph" | "heading" | "subheading" | "tip_box" | "warning_box" | "key_takeaway" | "prompt_block" | "cta_box"; text?: string; title?: string }
  | { type?: "bullet_list" | "numbered_list"; items?: unknown[]; text?: string }
  | { type?: "workflow_step"; title?: string; text?: string }
  | { type?: "comparison_table"; headers?: unknown[]; rows?: unknown[][]; text?: string }
  | { type?: "divider" }
  | { type?: "spacer"; size?: "small" | "medium" | "large" | string }
  | { type?: string; text?: string; title?: string; items?: unknown[]; headers?: unknown[]; rows?: unknown[][]; size?: string }

export interface AiCtaGeneration {
  title?: string
  body?: string
  action?: string
  url?: string
}

export type AiSeverity = "info" | "warning" | "error"

export interface AiStructureIssue {
  code: string
  severity: AiSeverity
  component?: string
  message: string
  suggestedFix: string
}

export interface NormalizedAiEbook {
  ebook: ComposerEbook
  issues: AiStructureIssue[]
}
