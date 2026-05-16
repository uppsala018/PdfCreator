"use client"

import {
  useState, useCallback, useEffect, useRef,
  forwardRef, useImperativeHandle,
} from "react"
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
  Upload,
  X,
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

export interface BlockEditorRef {
  requestSave: () => Promise<void>
  replaceChapters: (chapters: Chapter[]) => void
  getChapters: () => Chapter[]
}

export interface BlockEditorProps {
  projectId: string
  initialChapters: Chapter[]
  theme?: string
  projectTitle?: string
  website?: string | null
  onSave: (chapters: Chapter[]) => Promise<void>
  onDirtyChange?: (dirty: boolean) => void
  onRequestImportPdf?: () => void
  onRequestProfessionalExport?: () => void
}

type SaveStatus = "idle" | "saving" | "saved" | "error"

// ─── File-reading helper ──────────────────────────────────────────────────────

const ALLOWED_EXT = [".txt", ".md"]

/**
 * Validate extension and read a File as UTF-8 text.
 * Rejects with a user-friendly message for unsupported types or read errors.
 */
function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const name  = file.name.toLowerCase()
    const ext   = name.slice(name.lastIndexOf("."))
    if (!ALLOWED_EXT.includes(ext)) {
      reject(
        new Error(
          `Only .txt and .md files are supported — got "${file.name}"`
        )
      )
      return
    }
    const reader = new FileReader()
    reader.onload  = (e) => resolve((e.target?.result as string) ?? "")
    reader.onerror = () => reject(new Error(`Could not read file: ${file.name}`))
    reader.readAsText(file, "utf-8")
  })
}

// ─── Block type menu ──────────────────────────────────────────────────────────

const BLOCK_MENU: Array<{ type: BlockType; label: string; separator?: boolean }> = [
  { type: "heading",         label: "Heading" },
  { type: "subheading",      label: "Subheading" },
  { type: "paragraph",       label: "Paragraph",       separator: true },
  { type: "pro_tip",         label: "Pro Tip" },
  { type: "prompt_card",     label: "Prompt Card",     separator: true },
  { type: "table",           label: "Table",           separator: true },
  { type: "page_break",      label: "Page Break" },
  { type: "chapter_divider", label: "Chapter Divider" },
]

const ONBOARDING_ACTIONS = [
  {
    title: "Generate AI Draft",
    description: "Create a structured starting point with chapters, callouts, and CTAs.",
    tone: "accent" as const,
  },
  {
    title: "Start Writing",
    description: "Open the text editor and build the chapter by hand.",
    tone: "neutral" as const,
  },
  {
    title: "Import PDF",
    description: "Return to the dashboard to import a finished PDF for repair.",
    tone: "muted" as const,
  },
  {
    title: "Professional Composer Export",
    description: "Export the current project as a polished premium PDF.",
    tone: "gold" as const,
  },
] as const

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
      <BlockRenderer
        block={block}
        onChange={onChange}
        onDelete={onDelete}
        dragHandle={dragHandle}
      />
    </div>
  )
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

function EmptyStateOnboarding({
  onGenerateDraft,
  onStartWriting,
  onImportPdf,
  onProfessionalExport,
}: {
  onGenerateDraft: () => void
  onStartWriting: () => void
  onImportPdf: () => void
  onProfessionalExport: () => void
}) {
  return (
    <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[#1e3a52] bg-[#07111f] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.22)] sm:p-5">
      <div className="flex flex-col gap-2 border-b border-[#1e3a52] pb-4">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Getting started</p>
        <h2 className="text-lg font-semibold text-white">Choose your first workflow</h2>
        <p className="max-w-2xl text-sm leading-6 text-slate-400">
          Start from a draft, write from scratch, import a finished PDF for repair, or export with the Professional Composer.
        </p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {ONBOARDING_ACTIONS.map((action) => (
          <div
            key={action.title}
            className={cn(
              "rounded-xl border p-3",
              action.tone === "accent" && "border-teal-400/20 bg-teal-400/5",
              action.tone === "neutral" && "border-[#1e3a52] bg-white/[0.02]",
              action.tone === "muted" && "border-slate-700/70 bg-slate-950/20",
              action.tone === "gold" && "border-[#C9A84C]/20 bg-[#C9A84C]/5"
            )}
          >
            <p className="text-sm font-medium text-white">{action.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{action.description}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button type="button" onClick={onGenerateDraft} className="justify-start bg-teal-500 text-[#07111f] hover:bg-teal-400">
          <Sparkles className="mr-2 h-3.5 w-3.5" />
          Generate AI Draft
        </Button>
        <Button type="button" onClick={onStartWriting} variant="outline" className="justify-start border-[#1e3a52] bg-transparent text-slate-200 hover:bg-white/5 hover:text-white">
          <FileText className="mr-2 h-3.5 w-3.5" />
          Start Writing
        </Button>
        <Button type="button" onClick={onImportPdf} variant="outline" className="justify-start border-[#1e3a52] bg-transparent text-slate-200 hover:bg-white/5 hover:text-white">
          <Upload className="mr-2 h-3.5 w-3.5" />
          Import PDF
        </Button>
        <Button type="button" onClick={onProfessionalExport} className="justify-start bg-[#C9A84C] text-[#07111f] hover:bg-[#e0b85a]">
          <FileDown className="mr-2 h-3.5 w-3.5" />
          Professional Composer Export
        </Button>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Tip: AI draft generation gives you a structured start, while the Professional Composer produces the polished export.
      </p>
    </div>
  )
}

// ─── Primary action buttons ───────────────────────────────────────────────────
// Four cards: Edit as Text · Import Text (paste) · Upload File · Generate with AI
// Laid out in a 2×2 grid so "Import Text" and "Upload File" sit side-by-side.

interface TextModeButtonsProps {
  onEdit: () => void
  onImport: () => void
  onAi: () => void
  /** Called with the raw file text once a valid .txt/.md file is selected. */
  onFileRead: (text: string) => void
  /** Called when the selected file is invalid or cannot be read. */
  onFileError: (msg: string) => void
  disabled: boolean
}

function TextModeButtons({
  onEdit,
  onImport,
  onAi,
  onFileRead,
  onFileError,
  disabled,
}: TextModeButtonsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset so the same file can be re-selected after an error.
    e.target.value = ""
    try {
      const text = await readTextFile(file)
      onFileRead(text)
    } catch (err) {
      onFileError(err instanceof Error ? err.message : "Failed to read file")
    }
  }

  const cardBase = "group flex flex-col gap-2 rounded-xl border p-4 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed"

  return (
    <div className="shrink-0 grid grid-cols-2 gap-3 px-4 py-3 border-b border-[#1e3a52] bg-[#0a1929]/60">

      {/* Edit as Text */}
      <button
        type="button"
        onClick={onEdit}
        disabled={disabled}
        className={cn(cardBase,
          "border-[#C9A84C]/20 bg-[#C9A84C]/5 hover:border-[#C9A84C]/50 hover:bg-[#C9A84C]/10"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#C9A84C]/15 border border-[#C9A84C]/30 group-hover:bg-[#C9A84C]/25 transition-colors">
            <FileText className="h-4 w-4 text-[#C9A84C]" />
          </div>
          <span className="font-semibold text-sm text-white">Edit as Text</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          View and edit the full chapter as plain text, then convert back to blocks.
        </p>
      </button>

      {/* Import Text (paste) */}
      <button
        type="button"
        onClick={onImport}
        disabled={disabled}
        className={cn(cardBase,
          "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 hover:bg-emerald-500/10"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/25 group-hover:bg-emerald-500/25 transition-colors">
            <FileDown className="h-4 w-4 text-emerald-400" />
          </div>
          <span className="font-semibold text-sm text-white">Import Text</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Paste plain text and convert it to blocks, appended to the chapter.
        </p>
      </button>

      {/* Upload File (.txt / .md) — hidden input + trigger button */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className={cn(cardBase,
          "border-sky-500/20 bg-sky-500/5 hover:border-sky-500/40 hover:bg-sky-500/10"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 border border-sky-500/25 group-hover:bg-sky-500/25 transition-colors">
            <Upload className="h-4 w-4 text-sky-400" />
          </div>
          <span className="font-semibold text-sm text-white">Upload File</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Open a <code className="text-sky-400">.txt</code> or{" "}
          <code className="text-sky-400">.md</code> file and convert it to blocks.
        </p>
      </button>

      {/* Generate with AI */}
      <button
        type="button"
        onClick={onAi}
        disabled={disabled}
        className={cn(cardBase,
          "border-violet-500/20 bg-violet-500/5 hover:border-violet-500/40 hover:bg-violet-500/10"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 border border-violet-500/25 group-hover:bg-violet-500/25 transition-colors">
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

const BlockEditor = forwardRef<BlockEditorRef, BlockEditorProps>(
  function BlockEditor(
    {
      initialChapters,
      theme = "dark-cinematic",
      projectTitle = "Untitled",
      website,
      onSave,
      onDirtyChange,
      onRequestImportPdf,
      onRequestProfessionalExport,
    },
    ref
  ) {
    const [chapters, setChapters] = useState<Chapter[]>(() =>
      initialChapters.length > 0 ? initialChapters : [makeChapter(1)]
    )
    const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
      () => (initialChapters.length > 0 ? initialChapters[0].id : null)
    )
    const [dirtyChapterIds, setDirtyChapterIds] = useState<Set<string>>(new Set())
    const [saveStatus,     setSaveStatus]     = useState<SaveStatus>("idle")
    const [textMode,       setTextMode]       = useState<TextMode | null>(null)
    const [showAiDialog,   setShowAiDialog]   = useState(false)
    const [aiPrefillText,  setAiPrefillText]  = useState<string | undefined>(undefined)

    // ── File import state ─────────────────────────────────────────────────────
    const [fileImportError, setFileImportError] = useState<string | null>(null)
    // isDragOver controls the drop-zone overlay.
    const [isDragOver,      setIsDragOver]      = useState(false)
    // Counter-based tracking avoids flicker when the cursor moves over children.
    const dragCounterRef = useRef(0)

    // Always-current refs for stable callbacks.
    const chaptersRef = useRef(chapters)
    chaptersRef.current = chapters
    const isDirty     = dirtyChapterIds.size > 0
    const isDirtyRef  = useRef(isDirty)
    isDirtyRef.current = isDirty

    const selectedChapter = chapters.find((c) => c.id === selectedChapterId) ?? null

    // ── DnD sensors ───────────────────────────────────────────────────────────
    const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    // ── Notify parent on dirty change ─────────────────────────────────────────
    const prevDirtyRef = useRef(false)
    useEffect(() => {
      if (prevDirtyRef.current !== isDirty) {
        prevDirtyRef.current = isDirty
        onDirtyChange?.(isDirty)
      }
    }, [isDirty, onDirtyChange])

    // ── Save ──────────────────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
      if (!isDirtyRef.current) return
      setSaveStatus("saving")
      try {
        await onSave(chaptersRef.current)
        setDirtyChapterIds(new Set())
        setSaveStatus("saved")
      } catch {
        setSaveStatus("error")
      }
    }, [onSave])

    const replaceChapters = useCallback((nextChapters: Chapter[]) => {
      const safeChapters = nextChapters.length > 0 ? nextChapters : [makeChapter(1)]
      setChapters(safeChapters)
      setSelectedChapterId(safeChapters[0]?.id ?? null)
      setDirtyChapterIds(new Set())
      setSaveStatus("saved")
      setTextMode(null)
      setAiPrefillText(undefined)
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        requestSave: handleSave,
        replaceChapters,
        getChapters: () => chaptersRef.current,
      }),
      [handleSave, replaceChapters]
    )

    // True 30-second auto-save — stable interval, never reset by edits.
    useEffect(() => {
      const id = setInterval(() => {
        if (isDirtyRef.current) handleSave()
      }, 30_000)
      return () => clearInterval(id)
    }, [handleSave])

    // ── File import entry point ───────────────────────────────────────────────
    // Shared by the upload button and the drop handler.
    function openFileImport(text: string) {
      if (!selectedChapterId) {
        setFileImportError(
          "Select a chapter first, then upload or drop a file to import into it."
        )
        return
      }
      setFileImportError(null)
      setAiPrefillText(text)
      setTextMode("import")
    }

    // ── Drag-and-drop handlers ────────────────────────────────────────────────
    // Only active when no text mode is open (avoids clashing with the text editor).

    function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
      if (textMode) return
      e.preventDefault()
      dragCounterRef.current += 1
      if (dragCounterRef.current === 1) setIsDragOver(true)
    }

    function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
      if (textMode) return
      e.preventDefault()
      dragCounterRef.current -= 1
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0
        setIsDragOver(false)
      }
    }

    function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
      if (textMode) return
      e.preventDefault()
      e.dataTransfer.dropEffect = "copy"
    }

    async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
      e.preventDefault()
      dragCounterRef.current = 0
      setIsDragOver(false)
      if (textMode) return

      // ── Priority 1: a file was dropped ─────────────────────────────────────
      const file = e.dataTransfer.files[0]
      if (file) {
        try {
          const text = await readTextFile(file)
          openFileImport(text)
        } catch (err) {
          setFileImportError(
            err instanceof Error ? err.message : "Failed to read dropped file"
          )
        }
        return
      }

      // ── Priority 2: plain text dragged from another app ────────────────────
      const plain = e.dataTransfer.getData("text/plain")
      if (plain.trim()) {
        openFileImport(plain)
        return
      }

      setFileImportError(
        "Only .txt and .md files are supported — or drag plain text directly."
      )
    }

    // ── Chapter mutations ─────────────────────────────────────────────────────
    function markDirty(chapterId: string) {
      setDirtyChapterIds((p) => new Set(Array.from(p).concat(chapterId)))
      setSaveStatus("idle")
    }

    function addChapter() {
      const ch = makeChapter(chapters.length + 1)
      setChapters((p) => [...p, ch])
      setSelectedChapterId(ch.id)
      setTextMode(null)
      setDirtyChapterIds((p) => new Set(Array.from(p).concat(ch.id)))
      setSaveStatus("idle")
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
      setDirtyChapterIds((p) => {
        const next = new Set(p)
        next.delete(id)
        const remaining = chapters.filter((c) => c.id !== id)
        if (remaining.length > 0) next.add(remaining[0].id)
        return next
      })
      setSaveStatus("idle")
      setTextMode(null)
    }

    function renameChapter(id: string, title: string) {
      setChapters((p) => p.map((c) => (c.id === id ? { ...c, title } : c)))
      markDirty(id)
    }

    function reorderChapters(reordered: Chapter[]) {
      setChapters(reordered)
      setDirtyChapterIds(new Set(reordered.map((c) => c.id)))
      setSaveStatus("idle")
    }

    function selectChapter(id: string) {
      setSelectedChapterId(id)
      setTextMode(null)
    }

    // ── Block mutations ───────────────────────────────────────────────────────
    function updateBlock(
      chapterId: string,
      blockId: string,
      updates: { content?: string; metadata?: BlockMetadata }
    ) {
      setChapters((p) =>
        p.map((c) =>
          c.id !== chapterId
            ? c
            : {
                ...c,
                blocks: c.blocks.map((b) =>
                  b.id !== blockId ? b : { ...b, ...updates }
                ),
              }
        )
      )
      markDirty(chapterId)
    }

    function deleteBlock(chapterId: string, blockId: string) {
      setChapters((p) =>
        p.map((c) =>
          c.id !== chapterId
            ? c
            : { ...c, blocks: c.blocks.filter((b) => b.id !== blockId) }
        )
      )
      markDirty(chapterId)
    }

    function addBlock(type: BlockType) {
      if (!selectedChapterId) return
      const block = makeBlock(type)
      setChapters((p) =>
        p.map((c) =>
          c.id !== selectedChapterId
            ? c
            : { ...c, blocks: [...c.blocks, block] }
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

    // ── Text converter apply ──────────────────────────────────────────────────
    function handleTextApply(blocks: Block[], applyMode: "replace" | "append") {
      if (!selectedChapterId) return
      setChapters((p) =>
        p.map((c) =>
          c.id !== selectedChapterId
            ? c
            : {
                ...c,
                blocks:
                  applyMode === "replace" ? blocks : [...c.blocks, ...blocks],
              }
        )
      )
      markDirty(selectedChapterId)
      setAiPrefillText(undefined)
      setTextMode(null)
    }

    function handleAiGenerated(generatedText: string) {
      setAiPrefillText(generatedText)
      setTextMode("import")
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
      <div className="flex h-full overflow-hidden bg-[#0D1B2A]">

        {/* ── Panel 1: Chapter list ────────────────────────────────────────── */}
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

        {/* ── Panel 2: Editor — drag-and-drop zone ─────────────────────────── */}
        <div
          className="relative flex flex-1 flex-col overflow-hidden"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drop overlay — visible only while a file is being dragged over */}
          {isDragOver && !textMode && (
            <div className="pointer-events-none absolute inset-0 z-20 m-1 flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-sky-400/70 bg-[#0D1B2A]/88 backdrop-blur-sm">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-500/10">
                <Upload className="h-8 w-8 text-sky-400" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-white">Drop to import</p>
                <p className="mt-1 text-sm text-slate-400">
                  .txt and .md files · plain text from any app
                </p>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="shrink-0 flex items-center justify-between gap-3 border-b border-[#1e3a52] bg-[#0a1929] px-4 py-2.5">
            {textMode ? (
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
              <span className="text-sm text-slate-500 truncate min-w-0">
                {selectedChapter?.title ?? "Select a chapter"}
              </span>
            )}

            <SaveButton
              saveStatus={saveStatus}
              isDirty={isDirty}
              onSave={handleSave}
            />
          </div>

          {/* Text editor mode */}
          {textMode && selectedChapter ? (
            <div className="flex-1 overflow-hidden">
              <TextToJsonConverter
                mode={textMode}
                currentBlocks={selectedChapter.blocks}
                chapterTitle={selectedChapter.title}
                initialText={aiPrefillText}
                onApply={handleTextApply}
                onCancel={() => {
                  setTextMode(null)
                  setAiPrefillText(undefined)
                }}
              />
            </div>
          ) : (
            <>
              {/* Unsaved changes banner */}
              {isDirty && (
                <div className="shrink-0 bg-[#C9A84C]/5 border-b border-[#C9A84C]/15 px-4 py-1.5 text-xs text-[#C9A84C] flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#C9A84C]" />
                  Unsaved changes — auto-saves every 30 seconds
                </div>
              )}

              {/* File import error banner */}
              {fileImportError && (
                <div className="shrink-0 flex items-center justify-between gap-3 border-b border-red-500/20 bg-red-500/5 px-4 py-2">
                  <div className="flex items-center gap-2 text-xs text-red-400 min-w-0">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{fileImportError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFileImportError(null)}
                    aria-label="Dismiss"
                    className="shrink-0 text-red-500 hover:text-red-300 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <TextModeButtons
                onEdit={() => setTextMode("edit")}
                onImport={() => setTextMode("import")}
                onAi={() => setShowAiDialog(true)}
                onFileRead={(text) => openFileImport(text)}
                onFileError={(msg) => setFileImportError(msg)}
                disabled={!selectedChapter}
              />

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
                {!selectedChapter ? (
                  <p className="flex h-40 items-center justify-center text-sm text-slate-600">
                    Select a chapter to edit its blocks
                  </p>
                ) : selectedChapter.blocks.length === 0 ? (
                  <div className="space-y-4 py-2">
                    <EmptyStateOnboarding
                      onGenerateDraft={() => setShowAiDialog(true)}
                      onStartWriting={() => setTextMode("edit")}
                      onImportPdf={() => onRequestImportPdf?.()}
                      onProfessionalExport={() => onRequestProfessionalExport?.()}
                    />
                    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#1e3a52] bg-white/[0.02] px-4 py-5 text-center text-sm text-slate-500">
                      <p className="text-slate-300">This chapter has no blocks yet.</p>
                      <p className="max-w-xl text-xs leading-5 text-slate-500">
                        Use the actions above to generate a draft, start writing, import a finished PDF, or export professionally.
                      </p>
                      <AddBlockButton onAdd={addBlock} />
                    </div>
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
                          onChange={(u) =>
                            updateBlock(selectedChapterId!, block.id, u)
                          }
                          onDelete={() =>
                            deleteBlock(selectedChapterId!, block.id)
                          }
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

        {/* ── Panel 3: Preview ─────────────────────────────────────────────── */}
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
)

export default BlockEditor

// ─── Save button ──────────────────────────────────────────────────────────────

interface SaveButtonProps {
  saveStatus: SaveStatus
  isDirty: boolean
  onSave: () => void
}

function SaveButton({ saveStatus, isDirty, onSave }: SaveButtonProps) {
  const isSaving = saveStatus === "saving"
  const isError  = saveStatus === "error"
  const isSaved  = saveStatus === "saved" && !isDirty

  const label = isSaving
    ? "Saving…"
    : isError
      ? "Save failed — Retry"
      : isDirty
        ? "Unsaved changes"
        : "Saved"

  return (
    <Button
      type="button"
      size="sm"
      onClick={onSave}
      disabled={isSaving || (!isDirty && !isError)}
      className={cn(
        "font-semibold min-w-[150px] transition-all",
        isSaving                       && "bg-[#1e3a52] text-slate-400 cursor-not-allowed",
        isSaved                        && "bg-[#1e3a52] text-emerald-400 cursor-default",
        isError                        && "bg-red-900/40 text-red-400 border border-red-500/20 hover:bg-red-900/60",
        isDirty && !isSaving && !isError && "bg-[#C9A84C] hover:bg-[#e0b85a] text-[#0D1B2A]",
        !isDirty && saveStatus === "idle" && "bg-[#1e3a52] text-slate-400 cursor-default",
      )}
    >
      {isSaving && <Loader2    className="h-3.5 w-3.5 animate-spin mr-1.5" />}
      {isSaved  && <CheckCircle2 className="h-3.5 w-3.5 mr-1.5"           />}
      {isError  && <AlertCircle  className="h-3.5 w-3.5 mr-1.5"           />}
      {isDirty && !isSaving && !isError && (
        <span className="h-1.5 w-1.5 rounded-full bg-[#0D1B2A] mr-1.5 inline-block shrink-0" />
      )}
      {!isSaving && !isSaved && !isError && !isDirty && (
        <Save className="h-3.5 w-3.5 mr-1.5" />
      )}
      {label}
    </Button>
  )
}
