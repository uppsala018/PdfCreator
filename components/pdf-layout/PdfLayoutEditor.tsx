"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowDownToLine,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  Loader2,
  Lock,
  MousePointer2,
  RotateCcw,
  RotateCw,
  Save,
  SquareDashedMousePointer,
  Trash2,
  Undo2,
  Unlock,
  XCircle,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  applyRepairSuggestion,
  isRepairSuggestionApplicable,
} from "@/lib/pdf-repair/apply-suggestion"
import { analyzeImportedPdfLayout } from "@/lib/pdf-repair/analysis"
import type { RepairSuggestion, RepairSuggestionSeverity } from "@/lib/pdf-repair/suggestions"
import type {
  ImportedPdfInfo,
  PdfLayoutBlock,
  PdfLayoutEditState,
  PdfRepairAnalysis,
  ProjectContent,
} from "@/lib/project-schema"
import { cn } from "@/lib/utils"

type PdfDocument = {
  numPages: number
  getPage: (pageNumber: number) => Promise<PdfPage>
}

type PdfPage = {
  getViewport: (opts: { scale: number }) => { width: number; height: number }
  render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => {
    promise: Promise<void>
  }
}

type Mode = "select" | "draw"

interface PdfLayoutEditorProps {
  projectId: string
  content: ProjectContent
  importedPdf: ImportedPdfInfo
}

interface DragState {
  blockId: string
  handle: "move" | "se"
  startX: number
  startY: number
  original: PdfLayoutBlock
  originalLayout: PdfLayoutEditState
}

type SaveState = "dirty" | "saving" | "saved" | "error"
type ExportState = "idle" | "exporting" | "complete" | "error"
type SuggestionFilter = "all" | "unresolved" | "dismissed" | "reviewed"
type LocalSuggestionStatus = "pending" | "reviewed" | "dismissed" | "applied"
type SuggestionGroup = "info" | "warning" | "error"
type AnalysisStep =
  | "scanning_pages"
  | "analyzing_layout"
  | "evaluating_regions"
  | "generating_suggestions"
  | "preparing_review"
type AnalysisState =
  | { status: "idle" }
  | { status: "running"; step: AnalysisStep }
  | { status: "error"; message: string }

type RepairSuggestionWithLocalStatus = RepairSuggestion & {
  localStatus: LocalSuggestionStatus
}

const EMPTY_LAYOUT: PdfLayoutEditState = {
  version: 1,
  deletedPages: [],
  pageOrder: [],
  visualBlocks: [],
  textOverlays: {},
  patchFills: {},
}

const ANALYSIS_STEPS: AnalysisStep[] = [
  "scanning_pages",
  "analyzing_layout",
  "evaluating_regions",
  "generating_suggestions",
  "preparing_review",
]

function normalizeLayout(value: ProjectContent["layoutEditState"]): PdfLayoutEditState {
  return {
    ...EMPTY_LAYOUT,
    ...(value ?? {}),
    deletedPages: value?.deletedPages ?? [],
    visualBlocks: value?.visualBlocks ?? [],
    textOverlays: value?.textOverlays ?? {},
    patchFills: value?.patchFills ?? {},
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pointerToPagePoint(e: React.PointerEvent<HTMLElement>, el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  return {
    x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((e.clientY - rect.top) / rect.height, 0, 1),
  }
}

export default function PdfLayoutEditor({
  projectId,
  content,
  importedPdf,
}: PdfLayoutEditorProps) {
  const [pdf, setPdf] = useState<PdfDocument | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [layout, setLayout] = useState<PdfLayoutEditState>(() =>
    normalizeLayout(content.layoutEditState)
  )
  const layoutRef = useRef(layout)
  const [selectedPage, setSelectedPage] = useState(0)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>("select")
  const [saveState, setSaveState] = useState<SaveState>("saved")
  const [exportState, setExportState] = useState<ExportState>("idle")
  const [exportError, setExportError] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [draftBlock, setDraftBlock] = useState<PdfLayoutBlock | null>(null)
  const [draftOrigin, setDraftOrigin] = useState<{ x: number; y: number } | null>(null)
  const [history, setHistory] = useState<PdfLayoutEditState[]>([])
  const [redoStack, setRedoStack] = useState<PdfLayoutEditState[]>([])
  const [zoom, setZoom] = useState(1)
  const [suggestionFilter, setSuggestionFilter] = useState<SuggestionFilter>("unresolved")
  const [analysis, setAnalysis] = useState<PdfRepairAnalysis | null>(
    () => content.pdfRepairAnalysis ?? null
  )
  const [analysisState, setAnalysisState] = useState<AnalysisState>({ status: "idle" })
  const [reviewedSuggestionIds, setReviewedSuggestionIds] = useState<Set<string>>(() => new Set())
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<Set<string>>(() => new Set())
  const [appliedSuggestionIds, setAppliedSuggestionIds] = useState<Set<string>>(() => new Set())
  const [appliedSuggestionSnapshots, setAppliedSuggestionSnapshots] = useState<
    Record<string, PdfLayoutEditState>
  >({})
  const [appliedSuggestionRecords, setAppliedSuggestionRecords] = useState<
    Record<string, RepairSuggestion>
  >({})

  const selectedBlock = layout.visualBlocks.find((b) => b.id === selectedBlockId) ?? null
  const pageCount = pdf?.numPages ?? importedPdf.pageCount ?? 0
  const deletedSet = useMemo(() => new Set(layout.deletedPages), [layout.deletedPages])
  const analysisSuggestions = useMemo(() => analysis?.suggestions ?? [], [analysis])
  const repairSuggestionsWithStatus = useMemo(
    () => {
      const generatedIds = new Set(analysisSuggestions.map((suggestion) => suggestion.id))
      const mergedSuggestions = [
        ...analysisSuggestions,
        ...Object.values(appliedSuggestionRecords).filter(
          (suggestion) => !generatedIds.has(suggestion.id)
        ),
      ]

      return mergedSuggestions.map((suggestion): RepairSuggestionWithLocalStatus => {
        const localStatus = dismissedSuggestionIds.has(suggestion.id)
          ? "dismissed"
          : appliedSuggestionIds.has(suggestion.id)
            ? "applied"
            : reviewedSuggestionIds.has(suggestion.id)
              ? "reviewed"
              : "pending"

        return {
          ...suggestion,
          localStatus,
        }
      })
    },
    [
      appliedSuggestionIds,
      appliedSuggestionRecords,
      analysisSuggestions,
      dismissedSuggestionIds,
      reviewedSuggestionIds,
    ]
  )
  const filteredRepairSuggestions = useMemo(
    () =>
      repairSuggestionsWithStatus.filter((suggestion) => {
        if (suggestionFilter === "all") return true
        if (suggestionFilter === "dismissed") return suggestion.localStatus === "dismissed"
        if (suggestionFilter === "reviewed") {
          return suggestion.localStatus === "reviewed" || suggestion.localStatus === "applied"
        }
        return suggestion.localStatus === "pending"
      }),
    [repairSuggestionsWithStatus, suggestionFilter]
  )
  const groupedRepairSuggestions = useMemo(
    () => groupRepairSuggestions(filteredRepairSuggestions),
    [filteredRepairSuggestions]
  )

  useEffect(() => {
    layoutRef.current = layout
  }, [layout])

  useEffect(() => {
    let cancelled = false

    async function loadPdf() {
      setLoadError(null)
      try {
        const pdfjs = await import("pdfjs-dist/build/pdf.mjs")
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

        const task = pdfjs.getDocument(`/api/import-pdf/${projectId}/file`)
        const doc = await task.promise
        if (!cancelled) setPdf(doc as PdfDocument)
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Could not load PDF")
        }
      }
    }

    loadPdf()
    return () => {
      cancelled = true
    }
  }, [projectId])

  function markDirty() {
    setSaveState("dirty")
    setExportState("idle")
  }

  function pushHistory(snapshot: PdfLayoutEditState) {
    setHistory((prev) => [...prev.slice(-49), snapshot])
    setRedoStack([])
  }

  function commitLayout(updater: (prev: PdfLayoutEditState) => PdfLayoutEditState) {
    const previous = layoutRef.current
    const next = updater(previous)
    pushHistory(previous)
    layoutRef.current = next
    setLayout(next)
    markDirty()
  }

  function undoLayout() {
    setHistory((prev) => {
      const snapshot = prev.at(-1)
      if (!snapshot) return prev
      const current = layoutRef.current
      setRedoStack((redo) => [...redo, current])
      layoutRef.current = snapshot
      setLayout(snapshot)
      clearAppliedSuggestionState()
      markDirty()
      return prev.slice(0, -1)
    })
  }

  function redoLayout() {
    setRedoStack((prev) => {
      const snapshot = prev.at(-1)
      if (!snapshot) return prev
      const current = layoutRef.current
      setHistory((past) => [...past, current])
      layoutRef.current = snapshot
      setLayout(snapshot)
      clearAppliedSuggestionState()
      markDirty()
      return prev.slice(0, -1)
    })
  }

  function clearAppliedSuggestionState() {
    setAppliedSuggestionIds(new Set())
    setAppliedSuggestionSnapshots({})
    setAppliedSuggestionRecords({})
  }

  const updateBlock = useCallback((blockId: string, next: Partial<PdfLayoutBlock>) => {
    setLayout((prev) => {
      const updated = {
      ...prev,
      visualBlocks: prev.visualBlocks.map((block) =>
        block.id === blockId ? { ...block, ...next } : block
      ),
      }
      layoutRef.current = updated
      return updated
    })
    markDirty()
  }, [])

  useEffect(() => {
    if (!drag) return
    const currentDrag = drag

    function handleMove(e: PointerEvent) {
      const dx = e.clientX - currentDrag.startX
      const dy = e.clientY - currentDrag.startY
      const pageEl = document.querySelector<HTMLElement>(
        `[data-page-index="${currentDrag.original.pageIndex}"]`
      )
      if (!pageEl) return
      const rect = pageEl.getBoundingClientRect()
      const nx = dx / rect.width
      const ny = dy / rect.height

      if (currentDrag.handle === "move") {
        updateBlock(currentDrag.blockId, {
          x: clamp(currentDrag.original.x + nx, 0, 1 - currentDrag.original.width),
          y: clamp(currentDrag.original.y + ny, 0, 1 - currentDrag.original.height),
        })
      } else {
        updateBlock(currentDrag.blockId, {
          width: clamp(currentDrag.original.width + nx, 0.03, 1 - currentDrag.original.x),
          height: clamp(currentDrag.original.height + ny, 0.03, 1 - currentDrag.original.y),
        })
      }
    }

    function handleUp() {
      pushHistory(currentDrag.originalLayout)
      setDrag(null)
    }

    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
    }
  }, [drag, updateBlock])

  function toggleDeletePage(pageIndex: number) {
    commitLayout((prev) => {
      const next = new Set(prev.deletedPages)
      if (next.has(pageIndex)) next.delete(pageIndex)
      else next.add(pageIndex)
      return { ...prev, deletedPages: Array.from(next).sort((a, b) => a - b) }
    })
    setSelectedPage(pageIndex)
  }

  function selectRepairSuggestion(suggestion: RepairSuggestion) {
    setSelectedPage(suggestion.affectedPage.pageIndex)
    setSelectedBlockId(suggestion.affectedRegion?.blockId ?? null)
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-page-index="${suggestion.affectedPage.pageIndex}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }

  function markSuggestionReviewed(suggestionId: string) {
    setDismissedSuggestionIds((prev) => {
      const next = new Set(prev)
      next.delete(suggestionId)
      return next
    })
    setReviewedSuggestionIds((prev) => new Set(prev).add(suggestionId))
  }

  function dismissSuggestion(suggestionId: string) {
    setReviewedSuggestionIds((prev) => {
      const next = new Set(prev)
      next.delete(suggestionId)
      return next
    })
    setDismissedSuggestionIds((prev) => new Set(prev).add(suggestionId))
  }

  function applySuggestion(suggestion: RepairSuggestion) {
    if (!isRepairSuggestionApplicable(suggestion)) return
    if (
      suggestion.proposedAction.type === "delete_page" &&
      !window.confirm(`Apply suggestion and mark page ${suggestion.affectedPage.pageNumber} for deletion?`)
    ) {
      return
    }

    const previous = layoutRef.current
    const result = applyRepairSuggestion(previous, suggestion)
    if (!result.applied) return

    commitLayout(() => result.layout)
    setAppliedSuggestionSnapshots((prev) => ({
      ...prev,
      [suggestion.id]: previous,
    }))
    setAppliedSuggestionRecords((prev) => ({
      ...prev,
      [suggestion.id]: suggestion,
    }))
    setDismissedSuggestionIds((prev) => {
      const next = new Set(prev)
      next.delete(suggestion.id)
      return next
    })
    setReviewedSuggestionIds((prev) => {
      const next = new Set(prev)
      next.delete(suggestion.id)
      return next
    })
    setAppliedSuggestionIds((prev) => new Set(prev).add(suggestion.id))
  }

  function revertSuggestion(suggestionId: string) {
    const snapshot = appliedSuggestionSnapshots[suggestionId]
    if (!snapshot) return

    commitLayout(() => snapshot)
    setAppliedSuggestionIds((prev) => {
      const next = new Set(prev)
      next.delete(suggestionId)
      return next
    })
    setAppliedSuggestionSnapshots((prev) => {
      const next = { ...prev }
      delete next[suggestionId]
      return next
    })
    setAppliedSuggestionRecords((prev) => {
      const next = { ...prev }
      delete next[suggestionId]
      return next
    })
  }

  function beginDraw(e: React.PointerEvent<HTMLDivElement>, pageIndex: number) {
    if (mode !== "draw" || deletedSet.has(pageIndex)) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const start = pointerToPagePoint(e, e.currentTarget)
    const block: PdfLayoutBlock = {
      id: crypto.randomUUID(),
      pageIndex,
      x: start.x,
      y: start.y,
      width: 0,
      height: 0,
      sourcePageIndex: pageIndex,
      sourceX: start.x,
      sourceY: start.y,
      sourceWidth: 0,
      sourceHeight: 0,
      type: "visual_region",
      label: `Block ${layout.visualBlocks.length + 1}`,
    }
    setSelectedPage(pageIndex)
    setDraftOrigin(start)
    setDraftBlock(block)
  }

  function continueDraw(e: React.PointerEvent<HTMLDivElement>) {
    if (!draftBlock || !draftOrigin) return
    const point = pointerToPagePoint(e, e.currentTarget)
    setDraftBlock((prev) => {
      if (!prev) return null
      return {
        ...prev,
        x: Math.min(draftOrigin.x, point.x),
        y: Math.min(draftOrigin.y, point.y),
        width: Math.abs(point.x - draftOrigin.x),
        height: Math.abs(point.y - draftOrigin.y),
        sourceX: Math.min(draftOrigin.x, point.x),
        sourceY: Math.min(draftOrigin.y, point.y),
        sourceWidth: Math.abs(point.x - draftOrigin.x),
        sourceHeight: Math.abs(point.y - draftOrigin.y),
      }
    })
  }

  function finishDraw() {
    if (!draftBlock) return
    if (draftBlock.width > 0.02 && draftBlock.height > 0.02) {
      commitLayout((prev) => ({
        ...prev,
        visualBlocks: [...prev.visualBlocks, draftBlock],
      }))
      setSelectedBlockId(draftBlock.id)
      setMode("select")
    }
    setDraftBlock(null)
    setDraftOrigin(null)
  }

  function moveSelectedBlockToPage(pageIndex: number) {
    if (!selectedBlock || selectedBlock.locked) return
    commitLayout((prev) => ({
      ...prev,
      visualBlocks: prev.visualBlocks.map((block) =>
        block.id === selectedBlock.id ? { ...block, pageIndex } : block
      ),
    }))
    setSelectedPage(pageIndex)
  }

  function deleteSelectedBlock() {
    if (!selectedBlock) return
    commitLayout((prev) => ({
      ...prev,
      visualBlocks: prev.visualBlocks.filter((block) => block.id !== selectedBlock.id),
    }))
    setSelectedBlockId(null)
  }

  function duplicateSelectedBlock() {
    if (!selectedBlock) return
    const duplicate: PdfLayoutBlock = {
      ...selectedBlock,
      id: crypto.randomUUID(),
      label: `${selectedBlock.label ?? "Block"} copy`,
      x: clamp(selectedBlock.x + 0.03, 0, 1 - selectedBlock.width),
      y: clamp(selectedBlock.y + 0.03, 0, 1 - selectedBlock.height),
      locked: false,
    }
    commitLayout((prev) => ({
      ...prev,
      visualBlocks: [...prev.visualBlocks, duplicate],
    }))
    setSelectedBlockId(duplicate.id)
  }

  function toggleSelectedBlockLock() {
    if (!selectedBlock) return
    commitLayout((prev) => ({
      ...prev,
      visualBlocks: prev.visualBlocks.map((block) =>
        block.id === selectedBlock.id
          ? { ...block, locked: !block.locked }
          : block
      ),
    }))
  }

  const saveLayout = useCallback(async (
    layoutToSave: PdfLayoutEditState = layoutRef.current,
    analysisToSave: PdfRepairAnalysis | null = analysis
  ): Promise<boolean> => {
    setSaveState("saving")
    const nextContent: ProjectContent = {
      ...content,
      projectType: "imported_pdf",
      importedPdf,
      chapters: content.chapters ?? [],
      layoutEditState: layoutToSave,
      pdfRepairAnalysis: analysisToSave ?? undefined,
    }

    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: nextContent }),
    })

    setSaveState(res.ok ? "saved" : "error")
    return res.ok
  }, [analysis, content, importedPdf, projectId])

  useEffect(() => {
    if (saveState !== "dirty" || drag || draftBlock) return
    const id = setTimeout(() => {
      saveLayout(layoutRef.current).catch(() => setSaveState("error"))
    }, 1200)
    return () => clearTimeout(id)
  }, [saveState, layout, drag, draftBlock, saveLayout])

  async function runDocumentAnalysis() {
    if (analysisState.status === "running") return

    try {
      setAnalysisState({ status: "running", step: "scanning_pages" })
      for (const step of ANALYSIS_STEPS) {
        setAnalysisState({ status: "running", step })
        await wait(180)
      }

      const nextAnalysis = analyzeImportedPdfLayout({
        projectId,
        layout: layoutRef.current,
        pageCount,
      })

      setAnalysis(nextAnalysis)
      setSuggestionFilter("unresolved")
      setReviewedSuggestionIds(new Set())
      setDismissedSuggestionIds(new Set())
      setAnalysisState({ status: "idle" })

      const saved = await saveLayout(layoutRef.current, nextAnalysis)
      if (!saved) {
        setAnalysisState({
          status: "error",
          message: "Analysis completed, but saving the analysis summary failed.",
        })
      }
    } catch (err) {
      setAnalysisState({
        status: "error",
        message: err instanceof Error ? err.message : "Analysis failed.",
      })
    }
  }

  async function exportCorrectedPdf() {
    setExportState("exporting")
    setExportError(null)
    try {
      const saved = await saveLayout()
      if (!saved) {
        setExportError("Save failed. Fix the layout save issue, then export again.")
        setExportState("error")
        return
      }

      const res = await fetch(`/api/import-pdf/${projectId}/export`, {
        method: "POST",
      })

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        setExportError(json.error ?? `Export failed (HTTP ${res.status})`)
        setExportState("error")
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const disposition = res.headers.get("Content-Disposition") ?? ""
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? "corrected-imported-pdf.pdf"
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      anchor.style.display = "none"
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      setExportState("complete")
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Unexpected export error")
      setExportState("error")
    }
  }

  if (loadError) {
    return (
      <div className="p-6 text-sm text-red-400">
        Failed to load PDF: {loadError}
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-[#0D1B2A]">
      <aside className="w-72 shrink-0 overflow-y-auto border-r border-[#1e3a52] bg-[#0a1929] p-4">
        <h1 className="text-lg font-bold text-white">PDF Layout Editor</h1>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Draw visual regions over the original PDF. Text overlays and extracted
          text layers are reserved for a later editing pass.
        </p>
        <p className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-xs leading-5 text-amber-300">
          Imported PDF layout export preserves appearance but may flatten edited
          regions depending on the source PDF.
        </p>

        <div
          className={cn(
            "mt-4 rounded-md border px-2 py-1.5 text-xs font-semibold",
            saveState === "dirty" && "border-amber-500/20 bg-amber-500/5 text-amber-300",
            saveState === "saving" && "border-sky-500/20 bg-sky-500/5 text-sky-300",
            saveState === "saved" && "border-emerald-500/20 bg-emerald-500/5 text-emerald-300",
            saveState === "error" && "border-red-500/20 bg-red-500/5 text-red-300"
          )}
        >
          {saveState === "dirty" && "Unsaved changes"}
          {saveState === "saving" && "Saving..."}
          {saveState === "saved" && "Saved"}
          {saveState === "error" && "Save failed"}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => setMode("select")}
            className={cn(
              mode === "select"
                ? "bg-[#C9A84C] text-[#0D1B2A] hover:bg-[#e0b85a]"
                : "bg-[#1e3a52] text-slate-300 hover:bg-[#2a4d6e]"
            )}
          >
            <MousePointer2 className="mr-1.5 h-3.5 w-3.5" />
            Select
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setMode("draw")}
            className={cn(
              mode === "draw"
                ? "bg-[#C9A84C] text-[#0D1B2A] hover:bg-[#e0b85a]"
                : "bg-[#1e3a52] text-slate-300 hover:bg-[#2a4d6e]"
            )}
          >
            <SquareDashedMousePointer className="mr-1.5 h-3.5 w-3.5" />
            Draw block
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            disabled={history.length === 0}
            onClick={undoLayout}
            className="bg-[#1e3a52] text-slate-300 hover:bg-[#2a4d6e] disabled:opacity-40"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Undo
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={redoStack.length === 0}
            onClick={redoLayout}
            className="bg-[#1e3a52] text-slate-300 hover:bg-[#2a4d6e] disabled:opacity-40"
          >
            <RotateCw className="mr-1.5 h-3.5 w-3.5" />
            Redo
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => setZoom((value) => clamp(value - 0.1, 0.5, 1.8))}
            className="bg-[#1e3a52] text-slate-300 hover:bg-[#2a4d6e]"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setZoom(1)}
            className="bg-[#1e3a52] text-xs text-slate-300 hover:bg-[#2a4d6e]"
          >
            {Math.round(zoom * 100)}%
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setZoom((value) => clamp(value + 0.1, 0.5, 1.8))}
            className="bg-[#1e3a52] text-slate-300 hover:bg-[#2a4d6e]"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>

        <AnalysisPanel
          analysis={analysis}
          state={analysisState}
          onAnalyze={runDocumentAnalysis}
        />

        <div className="mt-4 rounded-lg border border-[#1e3a52] p-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Selected page
          </p>
          <p className="mt-2 text-sm text-white">Page {selectedPage + 1}</p>
          <Button
            type="button"
            size="sm"
            onClick={() => toggleDeletePage(selectedPage)}
            className={cn(
              "mt-3 w-full",
              deletedSet.has(selectedPage)
                ? "bg-emerald-700 text-white hover:bg-emerald-600"
                : "bg-red-700 text-white hover:bg-red-600"
            )}
          >
            {deletedSet.has(selectedPage) ? (
              <Undo2 className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            {deletedSet.has(selectedPage) ? "Undo delete" : "Delete page"}
          </Button>
        </div>

        <div className="mt-4 rounded-lg border border-[#1e3a52] p-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Selected block
          </p>
          {selectedBlock ? (
            <>
              <p className="mt-2 truncate text-sm text-white">
                {selectedBlock.label ?? selectedBlock.id}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={deleteSelectedBlock}
                  className="bg-red-700 text-white hover:bg-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={duplicateSelectedBlock}
                  className="bg-[#1e3a52] text-slate-300 hover:bg-[#2a4d6e]"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={toggleSelectedBlockLock}
                  className={cn(
                    selectedBlock.locked
                      ? "bg-[#C9A84C] text-[#0D1B2A] hover:bg-[#e0b85a]"
                      : "bg-[#1e3a52] text-slate-300 hover:bg-[#2a4d6e]"
                  )}
                >
                  {selectedBlock.locked ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <label className="mt-3 block text-xs text-slate-500" htmlFor="move-page">
                Move block to page
              </label>
              <select
                id="move-page"
                value={selectedBlock.pageIndex}
                disabled={selectedBlock.locked}
                onChange={(e) => moveSelectedBlockToPage(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-[#1e3a52] bg-[#0D1B2A] px-2 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {Array.from({ length: pageCount }, (_, i) => (
                  <option key={i} value={i}>
                    Page {i + 1}{deletedSet.has(i) ? " (deleted)" : ""}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No block selected</p>
          )}
        </div>

        <RepairSuggestionsPanel
          hasAnalysis={analysis !== null}
          filter={suggestionFilter}
          suggestions={groupedRepairSuggestions}
          totalCount={repairSuggestionsWithStatus.length}
          visibleCount={filteredRepairSuggestions.length}
          onFilterChange={setSuggestionFilter}
          onSelect={selectRepairSuggestion}
          onMarkReviewed={markSuggestionReviewed}
          onDismiss={dismissSuggestion}
          onApply={applySuggestion}
          onRevert={revertSuggestion}
        />

        <Button
          type="button"
          onClick={() => saveLayout()}
          disabled={saveState === "saving"}
          className="mt-4 w-full bg-[#C9A84C] font-semibold text-[#0D1B2A] hover:bg-[#e0b85a]"
        >
          {saveState === "saving" ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-4 w-4" />
          )}
          {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : saveState === "error" ? "Retry save" : "Save layout"}
        </Button>

        <Button
          type="button"
          onClick={exportCorrectedPdf}
          disabled={exportState === "exporting"}
          className="mt-2 w-full bg-emerald-700 font-semibold text-white hover:bg-emerald-600"
        >
          {exportState === "exporting" ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-4 w-4" />
          )}
          {exportState === "exporting"
            ? "Exporting..."
            : exportState === "complete"
              ? "Export complete"
              : exportState === "error"
                ? "Retry export"
                : "Export corrected PDF"}
        </Button>
        {exportState === "complete" && (
          <p className="mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5 text-xs text-emerald-300">
            Export complete/download started.
          </p>
        )}
        {exportError && (
          <p className="mt-2 rounded-md border border-red-500/20 bg-red-500/5 px-2 py-1.5 text-xs text-red-300">
            {exportError}
          </p>
        )}
      </aside>

      <main className="flex-1 overflow-auto px-6 py-6">
        {!pdf ? (
          <div className="flex h-72 items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading PDF
          </div>
        ) : (
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            {Array.from({ length: pdf.numPages }, (_, index) => (
              <PdfPageView
                key={index}
                pdf={pdf}
                pageIndex={index}
                selected={selectedPage === index}
                deleted={deletedSet.has(index)}
                blocks={layout.visualBlocks.filter((b) => b.pageIndex === index)}
                selectedBlockId={selectedBlockId}
                draftBlock={draftBlock?.pageIndex === index ? draftBlock : null}
                mode={mode}
                zoom={zoom}
                onSelectPage={() => setSelectedPage(index)}
                onDeletePage={() => toggleDeletePage(index)}
                onBeginDraw={beginDraw}
                onContinueDraw={continueDraw}
                onFinishDraw={finishDraw}
                onSelectBlock={setSelectedBlockId}
                onStartDrag={(block, handle, e) => {
                  if (block.locked) return
                  setSelectedBlockId(block.id)
                  setSelectedPage(block.pageIndex)
                  setDrag({
                    blockId: block.id,
                    handle,
                    startX: e.clientX,
                    startY: e.clientY,
                    original: block,
                    originalLayout: layoutRef.current,
                  })
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function AnalysisPanel({
  analysis,
  state,
  onAnalyze,
}: {
  analysis: PdfRepairAnalysis | null
  state: AnalysisState
  onAnalyze: () => void
}) {
  const isRunning = state.status === "running"
  const label = analysis ? "Rerun analysis" : "Analyze Document"

  return (
    <div className="mt-4 rounded-lg border border-[#1e3a52] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Document analysis
          </p>
          {analysis?.analyzedAt && (
            <p className="mt-1 text-[11px] text-slate-500">
              Last analyzed {formatAnalyzedAt(analysis.analyzedAt)}
            </p>
          )}
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        disabled={isRunning}
        onClick={onAnalyze}
        className="mt-3 w-full bg-[#C9A84C] font-semibold text-[#0D1B2A] hover:bg-[#e0b85a] disabled:opacity-50"
      >
        {isRunning && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
        {isRunning ? formatAnalysisStep(state.step) : label}
      </Button>

      {isRunning && (
        <div className="mt-3 space-y-1.5">
          {ANALYSIS_STEPS.map((step) => (
            <div
              key={step}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px]",
                step === state.step
                  ? "border-[#C9A84C] bg-[#C9A84C]/10 text-[#e0b85a]"
                  : "border-[#1e3a52] bg-[#0D1B2A] text-slate-500"
              )}
            >
              {formatAnalysisStep(step)}
            </div>
          ))}
        </div>
      )}

      {state.status === "error" && (
        <p className="mt-3 rounded-md border border-red-500/20 bg-red-500/5 px-2 py-1.5 text-xs text-red-300">
          {state.message}
        </p>
      )}

      {analysis && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <SummaryMetric label="Pages" value={analysis.summary.pagesAnalyzed} />
          <SummaryMetric label="Issues" value={analysis.summary.issuesFound} />
          <SummaryMetric label="Suggestions" value={analysis.summary.suggestionsGenerated} />
          <SummaryMetric
            label="Warn/Error"
            value={`${analysis.summary.warningsCount}/${analysis.summary.errorsCount}`}
          />
        </div>
      )}
    </div>
  )
}

function SummaryMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-[#1e3a52] bg-[#0D1B2A] px-2 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function RepairSuggestionsPanel({
  hasAnalysis,
  filter,
  suggestions,
  totalCount,
  visibleCount,
  onFilterChange,
  onSelect,
  onMarkReviewed,
  onDismiss,
  onApply,
  onRevert,
}: {
  hasAnalysis: boolean
  filter: SuggestionFilter
  suggestions: Record<SuggestionGroup, RepairSuggestionWithLocalStatus[]>
  totalCount: number
  visibleCount: number
  onFilterChange: (filter: SuggestionFilter) => void
  onSelect: (suggestion: RepairSuggestionWithLocalStatus) => void
  onMarkReviewed: (suggestionId: string) => void
  onDismiss: (suggestionId: string) => void
  onApply: (suggestion: RepairSuggestionWithLocalStatus) => void
  onRevert: (suggestionId: string) => void
}) {
  return (
    <div className="mt-4 rounded-lg border border-[#1e3a52] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Repair suggestions
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {visibleCount} shown / {totalCount} total
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {(["unresolved", "all", "reviewed", "dismissed"] as const).map((nextFilter) => (
          <button
            key={nextFilter}
            type="button"
            onClick={() => onFilterChange(nextFilter)}
            className={cn(
              "rounded-md border px-2 py-1 text-xs font-semibold capitalize transition-colors",
              filter === nextFilter
                ? "border-[#C9A84C] bg-[#C9A84C] text-[#0D1B2A]"
                : "border-[#1e3a52] bg-[#0D1B2A] text-slate-400 hover:border-slate-600 hover:text-white"
            )}
          >
            {nextFilter}
          </button>
        ))}
      </div>

      {!hasAnalysis ? (
        <p className="mt-3 rounded-md border border-[#1e3a52] bg-[#0D1B2A] px-2 py-1.5 text-xs text-slate-500">
          Run Analyze Document to generate diagnostics and repair suggestions.
        </p>
      ) : totalCount === 0 ? (
        <p className="mt-3 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5 text-xs text-emerald-300">
          No rule-based repair suggestions for the current layout.
        </p>
      ) : visibleCount === 0 ? (
        <p className="mt-3 rounded-md border border-[#1e3a52] bg-[#0D1B2A] px-2 py-1.5 text-xs text-slate-500">
          No suggestions match this filter.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {(["error", "warning", "info"] as const).map((group) => (
            <RepairSuggestionGroup
              key={group}
              group={group}
              suggestions={suggestions[group]}
              onSelect={onSelect}
              onMarkReviewed={onMarkReviewed}
              onDismiss={onDismiss}
              onApply={onApply}
              onRevert={onRevert}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RepairSuggestionGroup({
  group,
  suggestions,
  onSelect,
  onMarkReviewed,
  onDismiss,
  onApply,
  onRevert,
}: {
  group: SuggestionGroup
  suggestions: RepairSuggestionWithLocalStatus[]
  onSelect: (suggestion: RepairSuggestionWithLocalStatus) => void
  onMarkReviewed: (suggestionId: string) => void
  onDismiss: (suggestionId: string) => void
  onApply: (suggestion: RepairSuggestionWithLocalStatus) => void
  onRevert: (suggestionId: string) => void
}) {
  if (suggestions.length === 0) return null

  return (
    <section>
      <p className={cn("text-xs font-semibold uppercase tracking-widest", groupTextClass(group))}>
        {group}
      </p>
      <div className="mt-2 space-y-2">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className={cn(
              "rounded-md border bg-[#0D1B2A] p-2",
              groupBorderClass(group),
              suggestion.localStatus !== "pending" && "opacity-70"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words text-xs font-semibold text-white">
                  {formatActionType(suggestion.type)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Page {suggestion.affectedPage.pageNumber}
                  {suggestion.affectedRegion?.blockId
                    ? ` / ${suggestion.affectedRegion.blockId}`
                    : ""}
                </p>
              </div>
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", statusClass(suggestion.localStatus))}>
                {suggestion.localStatus}
              </span>
            </div>

            <p className="mt-2 text-xs leading-5 text-slate-300">{suggestion.reason}</p>
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
              <span>{Math.round(suggestion.confidence * 100)}% confidence</span>
              {suggestion.affectedRegion && (
                <span>
                  {Math.round(suggestion.affectedRegion.width * 100)}% x{" "}
                  {Math.round(suggestion.affectedRegion.height * 100)}%
                </span>
              )}
            </div>

            <div className="mt-2 grid grid-cols-4 gap-1.5">
              <Button
                type="button"
                size="sm"
                onClick={() => onSelect(suggestion)}
                className="bg-[#1e3a52] px-2 text-slate-300 hover:bg-[#2a4d6e]"
                title="Show affected page or region"
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              {suggestion.localStatus === "applied" ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onRevert(suggestion.id)}
                  className="bg-[#1e3a52] px-2 text-slate-300 hover:bg-[#2a4d6e]"
                  title="Revert applied suggestion"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={!isRepairSuggestionApplicable(suggestion)}
                  onClick={() => onApply(suggestion)}
                  className="bg-[#C9A84C] px-2 text-[#0D1B2A] hover:bg-[#e0b85a] disabled:opacity-40"
                  title={
                    isRepairSuggestionApplicable(suggestion)
                      ? "Apply suggestion"
                      : "This suggestion cannot be applied yet"
                  }
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={() => onMarkReviewed(suggestion.id)}
                className="bg-emerald-700 px-2 text-white hover:bg-emerald-600"
                title="Mark reviewed"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onDismiss(suggestion.id)}
                className="bg-red-700 px-2 text-white hover:bg-red-600"
                title="Dismiss suggestion"
              >
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function groupRepairSuggestions(suggestions: RepairSuggestionWithLocalStatus[]) {
  return suggestions.reduce<Record<SuggestionGroup, RepairSuggestionWithLocalStatus[]>>(
    (groups, suggestion) => {
      groups[getSuggestionGroup(suggestion.severity)].push(suggestion)
      return groups
    },
    {
      info: [],
      warning: [],
      error: [],
    }
  )
}

function getSuggestionGroup(severity: RepairSuggestionSeverity): SuggestionGroup {
  if (severity === "critical" || severity === "high") return "error"
  if (severity === "medium") return "warning"
  return "info"
}

function formatActionType(actionType: string) {
  return actionType.replace(/_/g, " ")
}

function formatAnalysisStep(step: AnalysisStep) {
  return step.replace(/_/g, " ")
}

function formatAnalyzedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function groupTextClass(group: SuggestionGroup) {
  if (group === "error") return "text-red-300"
  if (group === "warning") return "text-amber-300"
  return "text-sky-300"
}

function groupBorderClass(group: SuggestionGroup) {
  if (group === "error") return "border-red-500/25"
  if (group === "warning") return "border-amber-500/25"
  return "border-sky-500/25"
}

function statusClass(status: LocalSuggestionStatus) {
  if (status === "applied") return "bg-[#C9A84C]/10 text-[#e0b85a]"
  if (status === "reviewed") return "bg-emerald-500/10 text-emerald-300"
  if (status === "dismissed") return "bg-red-500/10 text-red-300"
  return "bg-slate-500/10 text-slate-300"
}

function PdfPageView({
  pdf,
  pageIndex,
  selected,
  deleted,
  blocks,
  selectedBlockId,
  draftBlock,
  mode,
  zoom,
  onSelectPage,
  onDeletePage,
  onBeginDraw,
  onContinueDraw,
  onFinishDraw,
  onSelectBlock,
  onStartDrag,
}: {
  pdf: PdfDocument
  pageIndex: number
  selected: boolean
  deleted: boolean
  blocks: PdfLayoutBlock[]
  selectedBlockId: string | null
  draftBlock: PdfLayoutBlock | null
  mode: Mode
  zoom: number
  onSelectPage: () => void
  onDeletePage: () => void
  onBeginDraw: (e: React.PointerEvent<HTMLDivElement>, pageIndex: number) => void
  onContinueDraw: (e: React.PointerEvent<HTMLDivElement>) => void
  onFinishDraw: () => void
  onSelectBlock: (id: string) => void
  onStartDrag: (
    block: PdfLayoutBlock,
    handle: "move" | "se",
    e: React.PointerEvent<HTMLDivElement>
  ) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [page, setPage] = useState<PdfPage | null>(null)
  const [size, setSize] = useState({ width: 612, height: 792 })

  useEffect(() => {
    let cancelled = false
    pdf.getPage(pageIndex + 1).then((nextPage) => {
      if (cancelled) return
      setPage(nextPage)
      const viewport = nextPage.getViewport({ scale: 1 })
      setSize({ width: viewport.width, height: viewport.height })
    })
    return () => {
      cancelled = true
    }
  }, [pdf, pageIndex])

  useEffect(() => {
    if (!page || !canvasRef.current) return
    const canvas = canvasRef.current
    const maxWidth = 860
    const scale = maxWidth / size.width
    const viewport = page.getViewport({ scale })
    const context = canvas.getContext("2d")
    if (!context) return

    canvas.width = viewport.width
    canvas.height = viewport.height
    canvas.style.width = "100%"
    canvas.style.height = "100%"

    page.render({ canvasContext: context, viewport }).promise.catch(() => {})
  }, [page, size.height, size.width])

  return (
    <section
      className={cn(
        "rounded-xl border bg-[#0a1929] p-3 shadow-xl",
        selected ? "border-[#C9A84C]" : "border-[#1e3a52]",
        deleted && "opacity-50"
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onSelectPage}
          className="text-sm font-semibold text-white hover:text-[#C9A84C]"
        >
          Page {pageIndex + 1}
        </button>
        <Button
          type="button"
          size="sm"
          onClick={onDeletePage}
          className={cn(
            deleted
              ? "bg-emerald-700 text-white hover:bg-emerald-600"
              : "bg-[#1e3a52] text-slate-300 hover:bg-red-700 hover:text-white"
          )}
        >
          {deleted ? <Undo2 className="mr-1.5 h-3.5 w-3.5" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
          {deleted ? "Undo delete" : "Delete page"}
        </Button>
      </div>

      <div
        data-page-index={pageIndex}
        className={cn(
          "relative mx-auto overflow-hidden bg-white",
          mode === "draw" && !deleted ? "cursor-crosshair" : "cursor-default"
        )}
        style={{ aspectRatio: `${size.width} / ${size.height}`, width: 860 * zoom }}
        onPointerDown={(e) => {
          onSelectPage()
          onBeginDraw(e, pageIndex)
        }}
        onPointerMove={onContinueDraw}
        onPointerUp={onFinishDraw}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {deleted && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/55 text-lg font-bold text-white">
            Marked for deletion
          </div>
        )}

        {[...blocks, ...(draftBlock ? [draftBlock] : [])].map((block) => {
          const isSelected = block.id === selectedBlockId
          return (
            <div
              key={block.id}
              role="button"
              tabIndex={0}
              onPointerDown={(e) => {
                e.stopPropagation()
                onSelectBlock(block.id)
                onStartDrag(block, "move", e)
              }}
              className={cn(
                "absolute z-20 border-2 bg-sky-400/15",
                isSelected ? "border-[#C9A84C]" : "border-sky-400",
                draftBlock?.id === block.id && "border-dashed",
                block.locked && "border-slate-500 bg-slate-500/10"
              )}
              style={{
                left: `${block.x * 100}%`,
                top: `${block.y * 100}%`,
                width: `${block.width * 100}%`,
                height: `${block.height * 100}%`,
              }}
            >
              <span className="absolute left-1 top-1 rounded bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {block.locked ? "Locked" : block.label ?? "visual_region"}
              </span>
              {isSelected && !block.locked && (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Resize visual block"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    onStartDrag(block, "se", e)
                  }}
                  className="absolute bottom-0 right-0 flex h-4 w-4 translate-x-1/2 translate-y-1/2 cursor-se-resize items-center justify-center rounded-sm bg-[#C9A84C] text-[#0D1B2A]"
                >
                  <ArrowDownToLine className="h-3 w-3 -rotate-45" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
