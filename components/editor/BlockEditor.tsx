"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Plus,
  Save,
  GripVertical,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronDown,
  FileText,
  FileDown,
  Sparkles,
} from "lucide-react"
import { v4 as uuidv4 } from "uuid"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { Block, BlockType, Chapter, BlockMetadata } from "@/lib/project-schema"
import BlockRenderer from "./BlockRenderer"
import ChapterList from "./ChapterList"
import TextToJsonConverter, { type TextMode } from "./TextToJsonConverter"
import AiGenerateDialog from "./AiGenerateDialog"
import PagePreview from "@/components/preview/PagePreview"
import { blocksToText } from "@/lib/text-converter"

// ─── Public interface ─────────────────────────────────────────────────────────

export interface BlockEditorProps {
  projectId: string
  initialChapters: Chapter[]
  /** Visual theme — forwarded to the preview panel. */
  theme?: string
  projectTitle?: string
  website?: string | null
  onSave: (chapters: Chapter[]) => Promise<void>
  /** Called whenever the dirty state changes so a parent can gate navigation. */
  onDirtyChange?: (dirty: boolean) => void
}

type SaveStatus = "idle" | "saving" | "saved" | "error"

// ─── Block type menu ──────────────────────────────────────────────────────────

const BLOCK_MENU: Array<{ type: BlockType; label: string; separator?: boolean }> = [
  { type: "heading",          label: "Heading" },
  { type: "subheading",       label: "Subheading" },
  { type: "paragraph",        label: "Paragraph",        separator: true },
  { type: "pro_tip",          label: "Pro Tip" },
  { type: "prompt_card",      label: "Prompt Card",      separator: true },
  { type: "table",            label: "Table",            separator: true },
  { type: "page_break",       label: "Page Break" },
  { type: "chapter_divider",  label: "Chapter Divider" },
]

function makeBlock(type: BlockType): Block {
  const base = { id: uuidv4(), type, content: "" }
  if (type === "table")
    return { ...base, metadata: { rows: [["Column 1", "Column 2"], ["", ""]] } }
  if (type === "heading")    return { ...base, content: "New Heading" }
  if (type === "subheading") return { ...base, content: "New Subheading" }
  return base
}

function makeChapter(index: number): Chapter {
  return { id: uuidv4(), title: `Chapter ${index}`, blocks: [] }
}

// ─── Sortable block wrapper ───────────────────────────────────────────────────

interface SortableBlockItemProps {
  block: Block
  onChange: (u: { content?: string; metadata?: BlockMetadata }) => void
  onDelete: () => void
}

function SortableBlockItem({ block, onChange, onDelete }: SortableBlockItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id })

  const dragHandle = (
    <button
      type="button"
      aria-label="Drag to reorder block"
      className="touch-none"
      {...listeners}
      {...attributes}
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  )

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <BlockRenderer block={block} onChange={onChange} onDelete={onDelete} dragHandle={dragHandle} />
    </div>
  )
}

// ─── Save status indicator ────────────────────────────────────────────────────

function SaveIndicator({ status, isDirty }: { status: SaveStatus; isDirty: boolean }) {
  if (status === "saving")
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
      </span>
    )
  if (status === "error")
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-400">
        <AlertCircle className="h-3.5 w-3.5" /> Save failed
      </span>
    )
  if (status === "saved" && !isDirty)
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> Saved
      </span>
    )
  if (isDirty)
    return (
      <span className="flex items-center gap-1.5 text-xs text-[#C9A84C]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#C9A84C]" />
        Unsaved changes
      </span>
    )
  return null
}

// ─── Add-block dropdown ───────────────────────────────────────────────────────

function AddBlockButton({ onAdd }: { onAdd: (t: BlockType) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-dashed border-[#1e3a52] bg-transparent text-slate-500 hover:text-white hover:border-[#2a4d6e] hover:bg-white/5"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add block
          <ChevronDown className="ml-1.5 h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        className="bg-[#0a1929] border-[#1e3a52] text-slate-200 min-w-[160px]"
      >
        {BLOCK_MENU.map(({ type, label, separator }) => (
          <span key={type}>
            {separator && <DropdownMenuSeparator className="bg-[#1e3a52]" />}
            <DropdownMenuItem
              onClick={() => onAdd(type)}
              className="cursor-pointer hover:bg-white/5 focus:bg-white/5 focus:text-white"
            >
              {label}
            </DropdownMenuItem>
          </span>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Prominent text-mode entry buttons ───────────────────────────────────────
// These sit above the block list and are the PRIMARY editing CTAs.

function TextModeButtons({
  onEdit,
  onImport,
  onAi,
  disabled,
}: {
  onEdit: () => void
  onImport: () => void
  onAi: () => void
  disabled: boolean
}) {
  return (
    <div className="shrink-0 grid grid-cols-3 gap-3 px-4 py-3 border-b border-[#1e3a52] bg-[#0a1929]/60">
      {/* Edit as Text */}
      <button
        type="button"
        onClick={onEdit}
        disabled={disabled}
        className={cn(
          "group flex flex-col gap-2 rounded-xl border border-[#C9A84C]/20 bg-[#C9A84C]/5",
          "p-4 text-left transition-all",
          "hover:border-[#C9A84C]/50 hover:bg-[#C9A84C]/10",
          "disabled:opacity-40 disabled:cursor-not-allowed"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C9A84C]/15 border border-[#C9A84C]/30 group-hover:bg-[#C9A84C]/25 transition-colors">
            <FileText className="h-4 w-4 text-[#C9A84C]" />
          </div>
          <span className="font-semibold text-sm text-white">Edit as Text</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          View and edit the full chapter as plain text, then convert back to blocks.
        </p>
      </button>

      {/* Import Text */}
      <button
        type="button"
        onClick={onImport}
        disabled={disabled}
        className={cn(
          "group flex flex-col gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5",
          "p-4 text-left transition-all",
          "hover:border-emerald-500/40 hover:bg-emerald-500/10",
          "disabled:opacity-40 disabled:cursor-not-allowed"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/25 group-hover:bg-emerald-500/25 transition-colors">
            <FileDown className="h-4 w-4 text-emerald-400" />
          </div>
          <span className="font-semibold text-sm text-white">Import Text</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Paste plain text and convert it to blocks, appended to the chapter.
        </p>
      </button>

      {/* Generate with AI */}
      <button
        type="button"
        onClick={onAi}
        disabled={disabled}
        className={cn(
          "group flex flex-col gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5",
          "p-4 text-left transition-all",
          "hover:border-violet-500/40 hover:bg-violet-500/10",
          "disabled:opacity-40 disabled:cursor-not-allowed"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 border border-violet-500/25 group-hover:bg-violet-500/25 transition-colors">
            <Sparkles className="h-4 w-4 text-violet-400" />
          </div>
          <span className="font-semibold text-sm text-white">Generate with AI</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Describe what to write — AI generates text you review before adding.
        </p>
      </button>
    </div>
  )
}

// ─── Main editor ──────────────────────────────────────────────────────────────

export default function BlockEditor({
  initialChapters,
  theme = "dark-cinematic",
  projectTitle = "Untitled",
  website,
  onSave,
  onDirtyChange,
}: BlockEditorProps) {
  const [chapters, setChapters] = useState<Chapter[]>(() =>
    initialChapters.length > 0 ? initialChapters : [makeChapter(1)]
  )
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
    () => (initialChapters.length > 0 ? initialChapters[0].id : null)
  )
  const [dirtyChapterIds, setDirtyChapterIds] = useState<Set<string>>(new Set())
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [textMode, setTextMode] = useState<TextMode | null>(null)
  const [showAiDialog,  setShowAiDialog]  = useState(false)
  const [aiPrefillText, setAiPrefillText] = useState<string | undefined>(undefined)

  const chaptersRef = useRef(chapters)
  chaptersRef.current = chapters

  const isDirty = dirtyChapterIds.size > 0
  const selectedChapter = chapters.find((c) => c.id === selectedChapterId) ?? null

  // ── DnD sensors ────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Notify parent when dirty state changes.
  const prevDirtyRef = useRef(false)
  useEffect(() => {
    if (prevDirtyRef.current !== isDirty) {
      prevDirtyRef.current = isDirty
      onDirtyChange?.(isDirty)
    }
  }, [isDirty, onDirtyChange])

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaveStatus("saving")
    try {
      await onSave(chaptersRef.current)
      setDirtyChapterIds(new Set())
      setSaveStatus("saved")
    } catch {
      setSaveStatus("error")
    }
  }, [onSave])

  // Auto-save every 30 s while dirty.
  useEffect(() => {
    if (!isDirty) return
    const id = setInterval(() => {
      if (dirtyChapterIds.size > 0) handleSave()
    }, 30_000)
    return () => clearInterval(id)
  }, [isDirty, handleSave, dirtyChapterIds])

  // ── Chapter mutations ──────────────────────────────────────────────────────
  function markDirty(chapterId: string) {
    setDirtyChapterIds((p) => new Set(Array.from(p).concat(chapterId)))
    setSaveStatus("idle")
  }

  function addChapter() {
    const ch = makeChapter(chapters.length + 1)
    setChapters((p) => [...p, ch])
    setSelectedChapterId(ch.id)
    setTextMode(null)
  }

  function deleteChapter(id: string) {
    setChapters((prev) => {
      const next = prev.filter((c) => c.id !== id)
      if (next.length === 0) {
        const ch = makeChapter(1)
        setSelectedChapterId(ch.id)
        return [ch]
      }
      if (selectedChapterId === id) setSelectedChapterId(next[0].id)
      return next
    })
    setDirtyChapterIds((p) => { const n = new Set(p); n.delete(id); return n })
    setTextMode(null)
  }

  function renameChapter(id: string, title: string) {
    setChapters((p) => p.map((c) => (c.id === id ? { ...c, title } : c)))
    markDirty(id)
  }

  function reorderChapters(reordered: Chapter[]) {
    setChapters(reordered)
    setSaveStatus("idle")
    setDirtyChapterIds((p) => {
      if (p.size === 0) return p
      return new Set(reordered.map((c) => c.id))
    })
  }

  // Switching chapters exits text mode to avoid confusion.
  function selectChapter(id: string) {
    setSelectedChapterId(id)
    setTextMode(null)
  }

  // ── Block mutations ────────────────────────────────────────────────────────
  function updateBlock(
    chapterId: string,
    blockId: string,
    updates: { content?: string; metadata?: BlockMetadata }
  ) {
    setChapters((p) =>
      p.map((c) =>
        c.id !== chapterId
          ? c
          : { ...c, blocks: c.blocks.map((b) => (b.id !== blockId ? b : { ...b, ...updates })) }
      )
    )
    markDirty(chapterId)
  }

  function deleteBlock(chapterId: string, blockId: string) {
    setChapters((p) =>
      p.map((c) =>
        c.id !== chapterId ? c : { ...c, blocks: c.blocks.filter((b) => b.id !== blockId) }
      )
    )
    markDirty(chapterId)
  }

  function addBlock(type: BlockType) {
    if (!selectedChapterId) return
    const block = makeBlock(type)
    setChapters((p) =>
      p.map((c) =>
        c.id !== selectedChapterId ? c : { ...c, blocks: [...c.blocks, block] }
      )
    )
    markDirty(selectedChapterId)
  }

  function handleBlockDragEnd(event: DragEndEvent) {
    if (!selectedChapterId) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    setChapters((p) =>
      p.map((c) => {
        if (c.id !== selectedChapterId) return c
        const oi = c.blocks.findIndex((b) => b.id === active.id)
        const ni = c.blocks.findIndex((b) => b.id === over.id)
        return { ...c, blocks: arrayMove(c.blocks, oi, ni) }
      })
    )
    markDirty(selectedChapterId)
  }

  // ── Text converter apply ───────────────────────────────────────────────────
  function handleTextApply(blocks: Block[], applyMode: "replace" | "append") {
    if (!selectedChapterId) return
    setChapters((p) =>
      p.map((c) =>
        c.id !== selectedChapterId
          ? c
          : { ...c, blocks: applyMode === "replace" ? blocks : [...c.blocks, ...blocks] }
      )
    )
    markDirty(selectedChapterId)
    setAiPrefillText(undefined)
    setTextMode(null)   // return to block view after applying
  }

  // ── AI generation result ──────────────────────────────────────────────────
  // Opens the TextToJsonConverter in "import" mode with the generated text
  // pre-filled so the user can review and optionally edit before importing.
  function handleAiGenerated(generatedText: string) {
    setAiPrefillText(generatedText)
    setTextMode("import")
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden bg-[#0D1B2A]">

      {/* ── Panel 1: Chapter list ──────────────────────────────────────────── */}
      <aside className="w-52 shrink-0 border-r border-[#1e3a52] flex flex-col overflow-hidden">
        <ChapterList
          chapters={chapters}
          selectedChapterId={selectedChapterId}
          dirtyChapterIds={dirtyChapterIds}
          onSelectChapter={selectChapter}
          onAddChapter={addChapter}
          onDeleteChapter={deleteChapter}
          onRenameChapter={renameChapter}
          onReorderChapters={reorderChapters}
        />
      </aside>

      {/* ── Panel 2: Editor (block list OR text editor) ────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Global toolbar — always visible */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-b border-[#1e3a52] bg-[#0a1929] px-4 py-2.5">
          {textMode ? (
            // In text mode: show mode context in the toolbar
            <span className={cn(
              "flex items-center gap-2 text-sm font-medium",
              textMode === "edit" ? "text-[#C9A84C]" : "text-emerald-400"
            )}>
              {textMode === "edit"
                ? <FileText className="h-4 w-4" />
                : <FileDown className="h-4 w-4" />}
              {textMode === "edit" ? "Text editor active" : "Import text active"}
              <span className="text-xs font-normal text-slate-500 ml-1">
                (⌘/Ctrl+S to apply · Esc to cancel)
              </span>
            </span>
          ) : (
            // In block mode: show chapter title
            <span className="text-sm text-slate-500 truncate min-w-0">
              {selectedChapter?.title ?? "Select a chapter"}
            </span>
          )}

          <div className="flex items-center gap-3 shrink-0">
            <SaveIndicator status={saveStatus} isDirty={isDirty} />
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saveStatus === "saving" || !isDirty}
              className={cn(
                "font-semibold min-w-[80px]",
                isDirty
                  ? "bg-[#C9A84C] hover:bg-[#e0b85a] text-[#0D1B2A]"
                  : "bg-[#1e3a52] text-slate-500 cursor-default"
              )}
            >
              {saveStatus === "saving" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ── Text editor mode — takes over the entire content area ─────── */}
        {textMode && selectedChapter ? (
          <div className="flex-1 overflow-hidden">
            <TextToJsonConverter
              mode={textMode}
              currentBlocks={selectedChapter.blocks}
              chapterTitle={selectedChapter.title}
              initialText={aiPrefillText}
              onApply={handleTextApply}
              onCancel={() => { setTextMode(null); setAiPrefillText(undefined) }}
            />
          </div>
        ) : (
          /* ── Block editor mode ──────────────────────────────────────────── */
          <>
            {/* Unsaved changes banner */}
            {isDirty && (
              <div className="shrink-0 bg-[#C9A84C]/5 border-b border-[#C9A84C]/15 px-4 py-1.5 text-xs text-[#C9A84C] flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C9A84C]" />
                Unsaved changes
              </div>
            )}

            {/* ── PRIMARY EDITING BUTTONS — always visible, never buried ─── */}
            <TextModeButtons
              onEdit={() => setTextMode("edit")}
              onImport={() => setTextMode("import")}
              onAi={() => setShowAiDialog(true)}
              disabled={!selectedChapter}
            />

            {/* Block list */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {!selectedChapter ? (
                <p className="flex h-40 items-center justify-center text-sm text-slate-600">
                  Select a chapter to edit its blocks
                </p>
              ) : selectedChapter.blocks.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-3 text-sm text-slate-600">
                  <p>This chapter has no blocks yet.</p>
                  <p className="text-xs text-slate-700">
                    Use <span className="text-[#C9A84C]">Edit as Text</span> above to write quickly,
                    or add individual blocks below.
                  </p>
                  <AddBlockButton onAdd={addBlock} />
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleBlockDragEnd}
                >
                  <SortableContext
                    items={selectedChapter.blocks.map((b) => b.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {selectedChapter.blocks.map((block) => (
                      <SortableBlockItem
                        key={block.id}
                        block={block}
                        onChange={(u) => updateBlock(selectedChapterId!, block.id, u)}
                        onDelete={() => deleteBlock(selectedChapterId!, block.id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}

              {selectedChapter && selectedChapter.blocks.length > 0 && (
                <div className="flex justify-center pt-2">
                  <AddBlockButton onAdd={addBlock} />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Panel 3: Page preview ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-64 shrink-0 border-l border-[#1e3a52] flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-[#1e3a52]">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
            Preview
          </span>
          {selectedChapter && (
            <span className="text-[10px] text-slate-700 truncate max-w-[120px]">
              {selectedChapter.title}
            </span>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <PagePreview
            blocks={selectedChapter?.blocks ?? []}
            chapterTitle={selectedChapter?.title ?? ""}
            theme={theme}
            projectTitle={projectTitle}
            website={website}
          />
        </div>
      </aside>

      {/* ── AI Generate dialog ────────────────────────────────────────────── */}
      <AiGenerateDialog
        open={showAiDialog}
        onOpenChange={setShowAiDialog}
        chapterContext={
          selectedChapter ? blocksToText(selectedChapter.blocks) : ""
        }
        onGenerated={handleAiGenerated}
      />
    </div>
  )
}
