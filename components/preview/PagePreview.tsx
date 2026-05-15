"use client"

import { cn } from "@/lib/utils"
import type { Block } from "@/lib/project-schema"

// ─── Props ────────────────────────────────────────────────────────────────────

interface PagePreviewProps {
  blocks: Block[]
  chapterTitle: string
  theme: string
  projectTitle: string
  website?: string | null
}

// ─── Theme tokens ─────────────────────────────────────────────────────────────

interface ThemeTokens {
  page: string
  headerBar: string
  headerTitle: string
  headerSite: string
  heading: string
  subheading: string
  paragraph: string
  tipBorder: string
  tipBg: string
  tipText: string
  promptBorder: string
  promptBg: string
  promptText: string
  tableHeaderBg: string
  tableHeaderText: string
  tableRowAlt: string
  tableBorder: string
  dividerColor: string
  breakColor: string
  muted: string
}

const DARK: ThemeTokens = {
  page:           "bg-[#0D1B2A]",
  headerBar:      "bg-[#0D1B2A] border-b border-[#1e3a52]",
  headerTitle:    "text-white text-[9px] font-medium",
  headerSite:     "text-[#C9A84C] text-[9px]",
  heading:        "text-white font-bold",
  subheading:     "text-[#C9A84C] font-semibold",
  paragraph:      "text-slate-300",
  tipBorder:      "border-l-[3px] border-[#C9A84C]",
  tipBg:          "bg-[#0a1929]",
  tipText:        "text-white",
  promptBorder:   "border border-[#1e3a52]",
  promptBg:       "bg-[#0a1929]",
  promptText:     "text-slate-300",
  tableHeaderBg:  "bg-[#0a1929]",
  tableHeaderText:"text-white font-semibold",
  tableRowAlt:    "bg-[#0D1B2A]/60",
  tableBorder:    "border-[#1e3a52]",
  dividerColor:   "text-[#C9A84C]",
  breakColor:     "border-[#1e3a52]",
  muted:          "text-slate-700",
}

const LIGHT: ThemeTokens = {
  page:           "bg-white",
  headerBar:      "border-b border-gray-200",
  headerTitle:    "text-slate-500 text-[9px] font-medium tracking-wide uppercase",
  headerSite:     "text-slate-400 text-[9px]",
  heading:        "text-[#1A3A5C] font-bold",
  subheading:     "text-[#1A3A5C] font-semibold",
  paragraph:      "text-slate-600",
  tipBorder:      "border-l-[3px] border-[#1A3A5C]",
  tipBg:          "bg-[#EBF4FF]",
  tipText:        "text-slate-700",
  promptBorder:   "border-l-[3px] border-[#C9A84C]",
  promptBg:       "bg-white border border-gray-200",
  promptText:     "text-slate-600",
  tableHeaderBg:  "bg-[#1A3A5C]",
  tableHeaderText:"text-white font-semibold",
  tableRowAlt:    "bg-slate-50",
  tableBorder:    "border-gray-200",
  dividerColor:   "text-[#1A3A5C]",
  breakColor:     "border-gray-300",
  muted:          "text-gray-300",
}

// ─── Individual block renderers ────────────────────────────────────────────────

function PreviewBlock({ block, t }: { block: Block; t: ThemeTokens }) {
  switch (block.type) {
    case "heading":
      return (
        <p className={cn("text-sm leading-snug", t.heading)}>
          {block.content || <em className={cn("font-normal not-italic", t.muted)}>Empty heading</em>}
        </p>
      )

    case "subheading":
      return (
        <p className={cn("text-xs leading-snug", t.subheading)}>
          {block.content || <em className={cn("font-normal not-italic", t.muted)}>Empty subheading</em>}
        </p>
      )

    case "paragraph":
      return (
        <p className={cn("text-[11px] leading-relaxed", t.paragraph)}>
          {block.content || <em className={cn("not-italic", t.muted)}>Empty paragraph</em>}
        </p>
      )

    case "pro_tip":
      return (
        <div className={cn("rounded-r px-2.5 py-2", t.tipBorder, t.tipBg)}>
          <p className={cn("text-[10px] font-semibold mb-0.5", t.subheading)}>
            PRO TIP
          </p>
          <p className={cn("text-[10px] leading-relaxed", t.tipText)}>
            {block.content || <em className={t.muted}>No tip text</em>}
          </p>
        </div>
      )

    case "prompt_card":
      return (
        <div className={cn("rounded px-2.5 py-2", t.promptBorder, t.promptBg)}>
          <p className={cn("text-[9px] font-semibold mb-0.5 uppercase tracking-wide", t.subheading)}>
            Prompt
          </p>
          <p className={cn("font-mono text-[10px] leading-relaxed", t.promptText)}>
            {block.content || <em className={cn("not-italic font-sans", t.muted)}>No prompt text</em>}
          </p>
        </div>
      )

    case "table": {
      const rows = block.metadata?.rows ?? []
      if (rows.length === 0)
        return <p className={cn("text-[10px]", t.muted)}>Empty table</p>
      return (
        <div className="overflow-x-auto rounded border" style={{ borderColor: "inherit" }}>
          <table className="w-full border-collapse text-[10px]">
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={ri}
                  className={ri % 2 === 1 ? t.tableRowAlt : ""}
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={cn(
                        "px-2 py-1 border",
                        t.tableBorder,
                        ri === 0 ? cn(t.tableHeaderBg, t.tableHeaderText) : t.paragraph
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    case "page_break":
      return (
        <div className={cn("flex items-center gap-2 py-1", t.muted)}>
          <div className={cn("flex-1 border-t border-dashed", t.breakColor)} />
          <span className="text-[9px]">page break</span>
          <div className={cn("flex-1 border-t border-dashed", t.breakColor)} />
        </div>
      )

    case "chapter_divider":
      return (
        <div className={cn("text-center py-1 text-xs", t.dividerColor)}>✦</div>
      )

    default:
      return null
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PagePreview({
  blocks,
  chapterTitle,
  theme,
  projectTitle,
  website,
}: PagePreviewProps) {
  const isDark = theme === "dark-cinematic"
  const t = isDark ? DARK : LIGHT

  return (
    <div className={cn("flex h-full flex-col overflow-hidden", t.page)}>

      {/* Mini page header — mimics the PDF header bar */}
      <div className={cn("shrink-0 flex items-center justify-between px-3 py-1.5", t.headerBar)}>
        {isDark ? (
          <>
            <span className={t.headerTitle} style={{ maxWidth: "55%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {projectTitle}
            </span>
            {website && <span className={t.headerSite}>{website}</span>}
          </>
        ) : (
          <span className={cn("w-full text-center", t.headerTitle)}>
            {chapterTitle}
          </span>
        )}
      </div>

      {/* Scrollable page body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className={cn("text-xs", t.muted)}>No blocks in this chapter.</p>
            <p className={cn("text-[10px] mt-1", t.muted)}>
              Add blocks in the editor to see a preview.
            </p>
          </div>
        ) : (
          blocks.map((block) => (
            <PreviewBlock key={block.id} block={block} t={t} />
          ))
        )}
      </div>

      {/* Mini page footer — page number */}
      <div className={cn("shrink-0 flex items-center justify-center border-t py-1.5", t.headerBar)}>
        <span className={cn("text-[9px]", t.muted)}>— preview —</span>
      </div>
    </div>
  )
}
