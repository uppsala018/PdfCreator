import type { Block, Chapter, ProjectRow } from "@/lib/project-schema"
import { repairComposerEbookContent } from "@/lib/ai-ebook/content-quality"
import { type ExportTheme, toComposerTheme } from "@/lib/export/theme-mapping"

export type ComposerBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "subheading"; text: string }
  | { type: "bullet_list"; items: string[] }
  | { type: "numbered_list"; items: string[] }
  | { type: "tip_box"; text: string }
  | { type: "warning_box"; text: string }
  | { type: "key_takeaway"; text: string }
  | { type: "prompt_block"; text: string }
  | { type: "comparison_table"; headers: string[]; rows: string[][] }
  | { type: "workflow_step"; title: string; text: string }
  | { type: "cta_box"; text: string }
  | { type: "divider" }
  | { type: "spacer"; size: "small" | "medium" | "large" }

export interface ComposerSection {
  title: string
  blocks: ComposerBlock[]
}

export interface ComposerChapter {
  title: string
  intro: string
  sections: ComposerSection[]
}

export interface ComposerEbook {
  title: string
  subtitle: string
  author: string
  brand: string
  theme: "default" | "black_gold"
  chapters: ComposerChapter[]
  back_cover_title: string
  back_cover_body: string
  back_cover_cta: string
}

export function projectToProfessionalSchema(project: ProjectRow, theme: ExportTheme): ComposerEbook {
  const chapters = extractChapters(project.content)
  const schema: ComposerEbook = {
    title: project.title ?? "Untitled Ebook",
    subtitle: project.subtitle ?? "",
    author: project.author ?? "",
    brand: "Ebook Studio",
    theme: toComposerTheme(theme),
    chapters: chapters.map(chapterToComposerChapter),
    back_cover_title: "Designed for digital products",
    back_cover_body:
      "Created with Ebook Studio's Professional Composer: structured content, table of contents, premium styling, and layout diagnostics.",
    back_cover_cta: project.website ?? "ebook.studio",
  }
  return repairComposerEbookContent(schema).ebook
}

function extractChapters(content: ProjectRow["content"]): Chapter[] {
  if (content && typeof content === "object" && Array.isArray((content as { chapters?: unknown }).chapters)) {
    return (content as { chapters: Chapter[] }).chapters
  }
  return []
}

function chapterToComposerChapter(chapter: Chapter, index: number): ComposerChapter {
  const { intro, sections } = splitChapterIntoSections(chapter.blocks)
  return {
    title: chapter.title || `Chapter ${index + 1}`,
    intro,
    sections: sections.length > 0 ? sections : [{ title: "Overview", blocks: [] }],
  }
}

function splitChapterIntoSections(blocks: Block[]): { intro: string; sections: ComposerSection[] } {
  let intro = ""
  const sections: ComposerSection[] = []
  let current: ComposerSection = { title: "Overview", blocks: [] }

  for (const block of blocks) {
    if (block.type === "heading") {
      if (current.blocks.length > 0 || sections.length > 0) sections.push(current)
      current = { title: block.content || "Section", blocks: [] }
      continue
    }

    if (!intro && block.type === "paragraph" && sections.length === 0 && current.blocks.length === 0) {
      intro = block.content
      continue
    }

    const mapped = blockToComposerBlock(block)
    if (mapped) current.blocks.push(mapped)
  }

  if (current.blocks.length > 0 || sections.length === 0) sections.push(current)
  return { intro, sections }
}

function blockToComposerBlock(block: Block): ComposerBlock | null {
  switch (block.type) {
    case "subheading":
      return { type: "subheading", text: block.content }
    case "paragraph":
      return { type: "paragraph", text: block.content }
    case "pro_tip":
      return { type: "tip_box", text: block.content }
    case "prompt_card":
      return { type: "prompt_block", text: block.content }
    case "table":
      return mapTable(block)
    case "page_break":
      return { type: "spacer", size: "large" }
    case "chapter_divider":
      return { type: "divider" }
    case "heading":
      return { type: "heading", text: block.content }
    default:
      return null
  }
}

function mapTable(block: Block): ComposerBlock {
  const rows = block.metadata?.rows?.filter((row) => row.length > 0) ?? []
  if (rows.length === 0) {
    return { type: "paragraph", text: block.content || "Table content was empty." }
  }
  const [headers, ...bodyRows] = rows
  return {
    type: "comparison_table",
    headers: headers.map(String),
    rows: bodyRows.length > 0 ? bodyRows.map((row) => row.map(String)) : [headers.map(String)],
  }
}
