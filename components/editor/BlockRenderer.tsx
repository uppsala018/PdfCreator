"use client"

import type { Block, BlockMetadata } from "@/lib/project-schema"
import ParagraphBlock from "./blocks/ParagraphBlock"
import HeadingBlock from "./blocks/HeadingBlock"
import ProTipBlock from "./blocks/ProTipBlock"
import PromptCardBlock from "./blocks/PromptCardBlock"
import TableBlock from "./blocks/TableBlock"
import PageBreakBlock from "./blocks/PageBreakBlock"

export interface BlockRendererProps {
  block: Block
  onChange: (updates: { content?: string; metadata?: BlockMetadata }) => void
  onDelete: () => void
  /** Drag handle ReactNode created by the parent sortable container. */
  dragHandle?: React.ReactNode
}

export default function BlockRenderer({
  block,
  onChange,
  onDelete,
  dragHandle,
}: BlockRendererProps) {
  const shared = { block, onChange, onDelete, dragHandle }

  switch (block.type) {
    case "heading":
    case "subheading":
      return <HeadingBlock {...shared} />

    case "paragraph":
      return <ParagraphBlock {...shared} />

    case "pro_tip":
      return <ProTipBlock {...shared} />

    case "prompt_card":
      return <PromptCardBlock {...shared} />

    case "table":
      return <TableBlock {...shared} />

    case "page_break":
    case "chapter_divider":
      return <PageBreakBlock {...shared} />
  }
}
