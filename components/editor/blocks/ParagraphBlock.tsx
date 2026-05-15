"use client"

import { useRef, useEffect } from "react"
import BlockWrapper from "./BlockWrapper"
import { cn } from "@/lib/utils"
import type { Block, BlockMetadata } from "@/lib/project-schema"

interface Props {
  block: Block
  onChange: (updates: { content?: string; metadata?: BlockMetadata }) => void
  onDelete: () => void
  dragHandle?: React.ReactNode
}

export default function ParagraphBlock({ block, onChange, onDelete, dragHandle }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Auto-resize on content change.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [block.content])

  return (
    <BlockWrapper type="paragraph" onDelete={onDelete} dragHandle={dragHandle}>
      <textarea
        ref={ref}
        value={block.content}
        onChange={(e) => onChange({ content: e.target.value })}
        placeholder="Start writing your paragraph…"
        rows={1}
        className={cn(
          "w-full resize-none overflow-hidden bg-transparent",
          "text-sm text-slate-200 leading-relaxed placeholder:text-slate-600",
          "focus:outline-none"
        )}
      />
    </BlockWrapper>
  )
}
