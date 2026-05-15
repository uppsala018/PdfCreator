"use client"

import { Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { BlockType } from "@/lib/project-schema"

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Heading",
  subheading: "Subheading",
  paragraph: "Paragraph",
  pro_tip: "Pro Tip",
  prompt_card: "Prompt Card",
  table: "Table",
  page_break: "Page Break",
  chapter_divider: "Chapter Divider",
}

export const BLOCK_COLORS: Record<BlockType, string> = {
  heading: "text-white",
  subheading: "text-slate-300",
  paragraph: "text-slate-400",
  pro_tip: "text-[#C9A84C]",
  prompt_card: "text-emerald-400",
  table: "text-blue-400",
  page_break: "text-slate-500",
  chapter_divider: "text-purple-400",
}

interface BlockWrapperProps {
  type: BlockType
  onDelete: () => void
  children: React.ReactNode
  /** Rendered drag handle — created by the sortable container, not the block. */
  dragHandle?: React.ReactNode
  className?: string
}

export default function BlockWrapper({
  type,
  onDelete,
  children,
  dragHandle,
  className,
}: BlockWrapperProps) {
  return (
    <div
      className={cn(
        "group/block rounded-lg border border-[#1e3a52] bg-[#0a1929]",
        "hover:border-[#2a4d6e] transition-colors",
        className
      )}
    >
      {/* Header row: drag handle + type label + delete */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-[#1e3a52]">
        {dragHandle && (
          <div className="shrink-0 text-slate-700 hover:text-slate-400 transition-colors cursor-grab active:cursor-grabbing">
            {dragHandle}
          </div>
        )}

        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-widest select-none",
            BLOCK_COLORS[type]
          )}
        >
          {BLOCK_LABELS[type]}
        </span>

        <button
          type="button"
          onClick={onDelete}
          className={cn(
            "ml-auto rounded p-0.5 text-slate-700 hover:text-red-400 hover:bg-red-400/10",
            "opacity-0 group-hover/block:opacity-100 transition-all"
          )}
          title="Delete block"
          aria-label="Delete block"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content area */}
      <div className="p-3">{children}</div>
    </div>
  )
}
