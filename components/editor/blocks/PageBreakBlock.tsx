"use client"

import { Minus, Layers } from "lucide-react"
import BlockWrapper from "./BlockWrapper"
import type { Block, BlockMetadata } from "@/lib/project-schema"

interface Props {
  block: Block
  onChange: (updates: { content?: string; metadata?: BlockMetadata }) => void
  onDelete: () => void
  dragHandle?: React.ReactNode
}

export default function PageBreakBlock({ block, onDelete, dragHandle }: Props) {
  const isChapterDivider = block.type === "chapter_divider"

  return (
    <BlockWrapper type={block.type} onDelete={onDelete} dragHandle={dragHandle}>
      <div className="flex items-center justify-center gap-3 py-2 text-slate-600">
        {isChapterDivider ? (
          <Layers className="h-4 w-4 shrink-0" />
        ) : (
          <Minus className="h-4 w-4 shrink-0" />
        )}
        <div className="flex-1 border-t border-dashed border-slate-700" />
        <span className="text-xs font-medium">
          {isChapterDivider ? "Chapter Divider" : "Page Break"}
        </span>
        <div className="flex-1 border-t border-dashed border-slate-700" />
        {isChapterDivider ? (
          <Layers className="h-4 w-4 shrink-0" />
        ) : (
          <Minus className="h-4 w-4 shrink-0" />
        )}
      </div>
    </BlockWrapper>
  )
}
