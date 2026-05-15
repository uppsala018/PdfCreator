"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  ArrowLeft,
  FileText,
  FileDown,
  BookOpen,
  Info,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { textToBlocks, blocksToText } from "@/lib/text-converter"
import type { Block } from "@/lib/project-schema"

// ─── Public interface ─────────────────────────────────────────────────────────

export type TextMode = "edit" | "import"

export interface TextToJsonConverterProps {
  mode: TextMode
  /** Current chapter blocks — pre-populates the textarea in "edit" mode. */
  currentBlocks: Block[]
  /** Displayed in the header so the user knows which chapter they're editing. */
  chapterTitle: string
  /**
   * When provided (e.g. from AI generation), overrides the default initial
   * text for the textarea instead of deriving it from mode/currentBlocks.
   */
  initialText?: string
  /**
   * Called when the user clicks Apply / Import.
   * "replace" — overwrite the chapter's blocks (edit mode).
   * "append"  — append after the existing blocks (import mode).
   */
  onApply: (blocks: Block[], mode: "replace" | "append") => void
  onCancel: () => void
}

// ─── Syntax reference ─────────────────────────────────────────────────────────

const SYNTAX = [
  { marker: "# text",       label: "Heading" },
  { marker: "## text",      label: "Subheading" },
  { marker: "> text",       label: "Pro Tip" },
  { marker: "PROMPT: text", label: "Prompt Card" },
  { marker: "col | col",    label: "Table row" },
  { marker: "---",          label: "Page Break" },
  { marker: "===",          label: "Chapter Divider" },
]

const EDIT_PLACEHOLDER = `# Chapter Heading

## Section Title

Your paragraph text goes here.

> Pro Tip: use blank lines to separate every block.

PROMPT: Write a short story opening with a surprising twist.

Feature | Benefit
Bold    | Stands out
Tables  | Great for comparisons

---`

const IMPORT_PLACEHOLDER = `Paste your content here.

Use # for headings, ## for subheadings, > for pro tips,
PROMPT: for prompt cards, col | col for tables,
--- for page breaks, and === for chapter dividers.

Blank lines separate every block.`

// ─── Component ────────────────────────────────────────────────────────────────

export default function TextToJsonConverter({
  mode,
  currentBlocks,
  chapterTitle,
  initialText,
  onApply,
  onCancel,
}: TextToJsonConverterProps) {
  // Initialise text: respect an explicit initialText (e.g. from AI generation),
  // then fall back to edit-mode pre-population, then blank for import.
  const [text, setText] = useState<string>(() => {
    if (initialText !== undefined) return initialText
    return mode === "edit" ? blocksToText(currentBlocks) : ""
  })
  const [blockPreview, setBlockPreview] = useState<number | null>(() => {
    const initial = initialText ?? (mode === "edit" ? blocksToText(currentBlocks) : "")
    return initial.trim() ? textToBlocks(initial).length : null
  })
  const [guideOpen, setGuideOpen] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Focus & cursor on mount ────────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.focus()
    if (mode === "edit") {
      // Cursor to end so the user can start typing immediately.
      el.setSelectionRange(el.value.length, el.value.length)
    }
  }, [mode])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  const apply = useCallback(() => {
    if (!text.trim()) return
    onApply(
      textToBlocks(text),
      mode === "edit" ? "replace" : "append"
    )
  }, [text, mode, onApply])

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      // ⌘S / Ctrl+S → apply
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        apply()
        return
      }
      // Escape → cancel (only if focus is NOT inside the textarea so the user
      // can still press Esc to clear browser autocomplete, etc.)
      if (e.key === "Escape" && document.activeElement !== textareaRef.current) {
        onCancel()
      }
    }
    window.addEventListener("keydown", handle)
    return () => window.removeEventListener("keydown", handle)
  }, [apply, onCancel])

  // ── Text change ────────────────────────────────────────────────────────────
  function handleChange(value: string) {
    setText(value)
    setBlockPreview(value.trim() ? textToBlocks(value).length : null)
  }

  const canApply = text.trim().length > 0
  const isEdit = mode === "edit"

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0D1B2A]">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 border-b border-[#1e3a52] bg-[#0a1929] px-4 py-2.5">
        {/* Back button */}
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to blocks
        </button>

        <span className="text-slate-700">·</span>

        {/* Mode + chapter context */}
        <div className="flex items-center gap-2 min-w-0">
          {isEdit ? (
            <FileText className="h-4 w-4 shrink-0 text-[#C9A84C]" />
          ) : (
            <FileDown className="h-4 w-4 shrink-0 text-emerald-400" />
          )}
          <span className={cn("text-sm font-semibold", isEdit ? "text-[#C9A84C]" : "text-emerald-400")}>
            {isEdit ? "Edit as Text" : "Import Text"}
          </span>
          <span className="text-slate-700 text-sm">—</span>
          <div className="flex items-center gap-1.5 min-w-0">
            <BookOpen className="h-3.5 w-3.5 shrink-0 text-slate-600" />
            <span className="text-xs text-slate-500 truncate max-w-[200px]">
              {chapterTitle}
            </span>
          </div>
        </div>

        {/* Syntax guide toggle */}
        <button
          type="button"
          onClick={() => setGuideOpen((v) => !v)}
          className={cn(
            "ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
            guideOpen
              ? "bg-[#1e3a52] text-white"
              : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
          )}
        >
          {guideOpen ? <X className="h-3.5 w-3.5" /> : <Info className="h-3.5 w-3.5" />}
          Syntax guide
        </button>
      </div>

      {/* ── Syntax guide (collapsible) ───────────────────────────────────────── */}
      {guideOpen && (
        <div className="shrink-0 border-b border-[#1e3a52] bg-[#0a1929]/70 px-5 py-3.5">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {SYNTAX.map(({ marker, label }) => (
              <div key={marker} className="flex items-center gap-2 text-xs">
                <code className="rounded bg-[#1e3a52] px-1.5 py-0.5 font-mono text-[#C9A84C] text-[11px]">
                  {marker}
                </code>
                <span className="text-slate-500">→</span>
                <span className="text-slate-400">{label}</span>
              </div>
            ))}
          </div>
          <p className="mt-2.5 text-[11px] text-slate-600 leading-relaxed">
            Blank lines separate blocks.
            Consecutive <code className="text-slate-500">col | col</code> lines form one table.
            All other text becomes paragraph blocks.
          </p>
        </div>
      )}

      {/* ── Mode description banner ──────────────────────────────────────────── */}
      <div
        className={cn(
          "shrink-0 px-5 py-2.5 text-xs border-b",
          isEdit
            ? "bg-[#C9A84C]/5 text-[#C9A84C] border-[#C9A84C]/15"
            : "bg-emerald-500/5 text-emerald-400 border-emerald-500/15"
        )}
      >
        {isEdit ? (
          <>
            <strong>Edit mode</strong> — the entire chapter is shown as plain text below.
            Make your changes, then click <strong>Apply Changes</strong> to convert back to blocks.
            This will <strong>replace</strong> the current chapter content.
          </>
        ) : (
          <>
            <strong>Import mode</strong> — paste or type text below.
            Click <strong>Import</strong> to convert it to blocks and
            <strong> append</strong> it after the existing chapter content.
          </>
        )}
      </div>

      {/* ── Main textarea ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden p-4">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={isEdit ? EDIT_PLACEHOLDER : IMPORT_PLACEHOLDER}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          className={cn(
            "h-full w-full rounded-xl border bg-[#0a1929] p-5 pb-4",
            "font-mono text-sm leading-7 text-slate-200 placeholder:text-slate-700",
            "focus:outline-none transition-colors resize-none",
            isEdit
              ? "border-[#C9A84C]/15 focus:border-[#C9A84C]/35"
              : "border-emerald-500/15 focus:border-emerald-500/35"
          )}
        />
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between gap-4 border-t border-[#1e3a52] bg-[#0a1929] px-5 py-3">
        {/* Live preview + shortcut hint */}
        <div className="flex items-center gap-4 text-xs text-slate-600">
          {blockPreview !== null && (
            <span>
              {blockPreview === 0 ? (
                <span className="text-amber-500">No blocks detected yet</span>
              ) : (
                <>
                  Will {isEdit ? "replace with" : "append"}{" "}
                  <strong className="text-slate-300">{blockPreview}</strong>{" "}
                  block{blockPreview !== 1 ? "s" : ""}
                </>
              )}
            </span>
          )}
          <span className="hidden sm:inline opacity-60">
            ⌘/Ctrl+S to apply · Esc to cancel
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-slate-400 hover:text-white hover:bg-white/5"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={apply}
            disabled={!canApply}
            className={cn(
              "font-semibold px-5 min-w-[130px]",
              canApply
                ? isEdit
                  ? "bg-[#C9A84C] hover:bg-[#e0b85a] text-[#0D1B2A]"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-[#1e3a52] text-slate-500 cursor-not-allowed"
            )}
          >
            {isEdit ? "Apply Changes" : "Import"}
          </Button>
        </div>
      </div>
    </div>
  )
}
