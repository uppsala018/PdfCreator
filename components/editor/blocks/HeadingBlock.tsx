"use client"

import BlockWrapper from "./BlockWrapper"
import { cn } from "@/lib/utils"
import type { Block, BlockMetadata } from "@/lib/project-schema"

interface Props {
  block: Block
  onChange: (updates: { content?: string; metadata?: BlockMetadata }) => void
  onDelete: () => void
  dragHandle?: React.ReactNode
}

const STYLE: Record<string, string> = {
  heading: "text-xl font-bold text-white",
  subheading: "text-base font-semibold text-slate-200",
}

const PLACEHOLDER: Record<string, string> = {
  heading: "Chapter heading…",
  subheading: "Section subheading…",
}

export default function HeadingBlock({ block, onChange, onDelete, dragHandle }: Props) {
  const type = block.type === "subheading" ? "subheading" : "heading"

  return (
    <BlockWrapper type={block.type} onDelete={onDelete} dragHandle={dragHandle}>
      <input
        type="text"
        value={block.content}
        onChange={(e) => onChange({ content: e.target.value })}
        placeholder={PLACEHOLDER[type]}
        className={cn(
          "w-full bg-transparent focus:outline-none",
          STYLE[type]
        )}
      />
    </BlockWrapper>
  )
}
