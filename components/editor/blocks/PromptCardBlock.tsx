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

export default function PromptCardBlock({ block, onChange, onDelete, dragHandle }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [block.content])

  return (
    <BlockWrapper type="prompt_card" onDelete={onDelete} dragHandle={dragHandle}>
      <div className="rounded-md border border-[#1e3a52] bg-[#0D1B2A] px-3 py-2.5">
        <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-emerald-500">
          PROMPT:
        </span>
        <textarea
          ref={ref}
          value={block.content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="Enter the prompt text…"
          rows={1}
          className={cn(
            "w-full resize-none overflow-hidden bg-transparent",
            "font-mono text-sm text-slate-200 leading-relaxed placeholder:text-slate-600",
            "focus:outline-none"
          )}
        />
      </div>
    </BlockWrapper>
  )
}
