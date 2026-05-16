import { v4 as uuidv4 } from "uuid"
import type { Block, Chapter } from "@/lib/project-schema"
import type { ComposerBlock, ComposerEbook } from "@/lib/export/project-to-schema"

export interface EditorDraft {
  title: string
  subtitle: string
  author: string
  chapters: Chapter[]
}

export function composerEbookToEditorDraft(ebook: ComposerEbook): EditorDraft {
  return {
    title: ebook.title,
    subtitle: ebook.subtitle,
    author: ebook.author,
    chapters: ebook.chapters.map((chapter) => ({
      id: uuidv4(),
      title: chapter.title,
      blocks: [
        ...(chapter.intro ? [block("paragraph", chapter.intro)] : []),
        ...chapter.sections.flatMap((section) => [
          block("heading", section.title),
          ...section.blocks.flatMap(composerBlockToEditorBlocks),
        ]),
      ],
    })),
  }
}

function composerBlockToEditorBlocks(source: ComposerBlock): Block[] {
  switch (source.type) {
    case "paragraph":
    case "heading":
    case "subheading":
      return [block(source.type, source.text)]
    case "tip_box":
    case "warning_box":
    case "key_takeaway":
    case "cta_box":
      return [block("pro_tip", source.text)]
    case "prompt_block":
      return [block("prompt_card", source.text)]
    case "bullet_list":
      return [block("paragraph", source.items.map((item) => `- ${item}`).join("\n"))]
    case "numbered_list":
      return [block("paragraph", source.items.map((item, index) => `${index + 1}. ${item}`).join("\n"))]
    case "workflow_step":
      return [block("subheading", source.title), block("paragraph", source.text)]
    case "comparison_table":
      return [
        {
          id: uuidv4(),
          type: "table",
          content: "",
          metadata: { rows: [source.headers, ...source.rows] },
        },
      ]
    case "divider":
      return [block("chapter_divider", "")]
    case "spacer":
      return [block("page_break", "")]
    default:
      return []
  }
}

function block(type: Block["type"], content: string): Block {
  return { id: uuidv4(), type, content }
}
