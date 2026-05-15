"use client"

import { useRef, useEffect } from "react"
import { Lightbulb } from "lucide-react"
import BlockWrapper from "./BlockWrapper"
import { cn } from "@/lib/utils"
import type { Block, BlockMetadata } from "@/lib/project-schema"

interface Props {
  block: Block
  onChange: (updates: { content?: string; metadata?: BlockMetadata }) => void
  onDelete: () => void
  dragHandle?: React.ReactNode
}

export default function ProTipBlock({ block, onChange, onDelete, dragHandle }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [block.content])

  return (
    <BlockWrapper type="pro_tip" onDelete={onDelete} dragHandle={dragHandle}>
      <div className="flex gap-3 rounded-md border-l-[3px] border-[#C9A84C] bg-[#0D1B2A] px-3 py-2.5">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A84C]" />
        <textarea
          ref={ref}
          value={block.content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="Write your pro tip here…"
          rows={1}
          className={cn(
            "w-full resize-none overflow-hidden bg-transparent",
            "text-sm text-slate-200 leading-relaxed placeholder:text-slate-600",
            "focus:outline-none"
          )}
        />
      </div>
    </BlockWrapper>
  )
}
