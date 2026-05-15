"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileOutput,
  Loader2,
  X,
} from "lucide-react"
import BlockEditor, { type BlockEditorRef } from "@/components/editor/BlockEditor"
import type { Tables } from "@/lib/supabase/database.types"
import type { Chapter } from "@/lib/project-schema"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectRow = Tables<"projects">

interface EditorShellProps {
  project: ProjectRow
}

const THEME_LABEL: Record<string, string> = {
  "dark-cinematic": "Dark Cinematic",
  "clean-minimal":  "Clean Minimal",
}

type ExportPhase = "idle" | "exporting" | "success" | "error"
interface ExportState {
  phase: ExportPhase
  error?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractChapters(content: unknown): Chapter[] {
  if (
    typeof content === "object" &&
    content !== null &&
    "chapters" in content &&
    Array.isArray((content as { chapters: unknown }).chapters)
  ) {
    return (content as { chapters: Chapter[] }).chapters
  }
  return []
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditorShell({ project }: EditorShellProps) {
  const router = useRouter()
  const initialChapters = extractChapters(project.content)

  const [isDirty,     setIsDirty]     = useState(false)
  const [exportState, setExportState] = useState<ExportState>({ phase: "idle" })

  // Ref to BlockEditor — lets us call requestSave() before navigating away.
  const editorRef = useRef<BlockEditorRef>(null)

  // Stable ref so event handlers always read the latest isDirty value
  // without being re-registered on every state change.
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  // ── Save callback (passed to BlockEditor) ─────────────────────────────────
  const handleSave = useCallback(
    async (chapters: Chapter[]) => {
      const res = await fetch(`/api/projects/${project.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ content: { chapters } }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(
          (json as { error?: string }).error ??
            `Save failed (HTTP ${res.status})`
        )
      }

      setIsDirty(false)
    },
    [project.id]
  )

  // ── Guard: browser close / hard refresh ───────────────────────────────────
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirtyRef.current) return
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [])  // no deps — reads isDirtyRef which is always current

  // ── Save on tab hide (visibilitychange) ───────────────────────────────────
  // Fires when the user switches tabs, minimises the window, or navigates
  // away in some mobile browsers.  Uses fetch keepalive so the request
  // completes even if the page is suspended immediately after.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden" && isDirtyRef.current) {
        editorRef.current?.requestSave().catch(() => {/* best-effort */})
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])  // no deps — reads refs which are always current

  // ── Navigate back — save first if dirty ──────────────────────────────────
  // The Link component uses the Next.js client router which does NOT fire
  // beforeunload, so we intercept the click manually.
  async function handleNavigateBack() {
    if (isDirtyRef.current) {
      try {
        await editorRef.current?.requestSave()
      } catch {
        // Save failed — navigate anyway so the user is never trapped.
      }
    }
    router.push("/dashboard")
  }

  // ── Auto-reset export button after success ────────────────────────────────
  useEffect(() => {
    if (exportState.phase !== "success") return
    const id = setTimeout(() => setExportState({ phase: "idle" }), 3_000)
    return () => clearTimeout(id)
  }, [exportState.phase])

  // ── Export PDF ────────────────────────────────────────────────────────────
  // The API route returns the PDF binary directly (no Storage, no signed URL).
  // We receive the ArrayBuffer, create a temporary Blob URL, and click a
  // hidden anchor to trigger the browser's native file-download dialog.
  const handleExport = useCallback(async () => {
    setExportState({ phase: "exporting" })

    try {
      const res = await fetch("/api/export-pdf", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ projectId: project.id }),
      })

      if (!res.ok) {
        // Error responses are still JSON.
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
        setExportState({
          phase: "error",
          error:
            (json.error as string | undefined) ??
            `Export failed (HTTP ${res.status})`,
        })
        return
      }

      // Success — response body is the raw PDF binary.
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)

      // Derive a clean filename from the Content-Disposition header if present,
      // otherwise fall back to the project title.
      const disposition = res.headers.get("Content-Disposition") ?? ""
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? `${project.title ?? "ebook"}.pdf`

      const anchor = document.createElement("a")
      anchor.href     = blobUrl
      anchor.download = filename
      anchor.style.display = "none"
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)

      // Release the object URL after a short delay so the download starts.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000)

      setExportState({ phase: "success" })
    } catch (err) {
      setExportState({
        phase: "error",
        error:
          err instanceof Error
            ? err.message
            : "Unexpected error during export.",
      })
    }
  }, [project.id, project.title])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">

      {/* Editor top bar */}
      <div className="shrink-0 flex items-center gap-3 border-b border-[#1e3a52] bg-[#0a1929] px-4 h-11">

        {/* Back — saves before navigating */}
        <button
          type="button"
          onClick={handleNavigateBack}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          My Projects
        </button>

        <span className="text-slate-700 text-xs">·</span>

        <span className="text-sm font-semibold text-white truncate min-w-0 flex-1">
          {project.title}
        </span>

        {project.author && (
          <span className="hidden md:block text-xs text-slate-600 shrink-0">
            by {project.author}
          </span>
        )}

        <span
          className={cn(
            "hidden sm:inline-flex items-center shrink-0 rounded-full px-2.5 py-0.5",
            "border text-[11px] font-medium",
            project.theme === "dark-cinematic"
              ? "border-[#C9A84C]/30 bg-[#C9A84C]/5 text-[#C9A84C]"
              : "border-blue-400/30 bg-blue-400/5 text-blue-300"
          )}
        >
          {THEME_LABEL[project.theme] ?? project.theme}
        </span>

        <ExportButton state={exportState} onClick={handleExport} />
      </div>

      {/* Export error banner */}
      {exportState.phase === "error" && exportState.error && (
        <div className="shrink-0 flex items-center justify-between gap-3 border-b border-red-500/20 bg-red-500/5 px-4 py-2 text-xs">
          <div className="flex items-center gap-2 text-red-400 min-w-0">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{exportState.error}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportState({ phase: "idle" })}
            aria-label="Dismiss error"
            className="shrink-0 text-red-500 hover:text-red-300 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Three-panel BlockEditor */}
      <div className="flex-1 overflow-hidden">
        <BlockEditor
          ref={editorRef}
          projectId={project.id}
          initialChapters={initialChapters}
          theme={project.theme}
          projectTitle={project.title}
          website={project.website}
          onSave={handleSave}
          onDirtyChange={setIsDirty}
        />
      </div>
    </div>
  )
}

// ─── Export button ────────────────────────────────────────────────────────────

interface ExportButtonProps {
  state: ExportState
  onClick: () => void
}

function ExportButton({ state, onClick }: ExportButtonProps) {
  const { phase } = state
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={phase === "exporting"}
      aria-label="Export project as PDF"
      className={cn(
        "shrink-0 flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-all duration-150",
        phase === "idle"      && "border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/10 hover:border-[#C9A84C]/70",
        phase === "exporting" && "border-[#1e3a52] text-slate-400 cursor-not-allowed",
        phase === "success"   && "border-emerald-500/40 text-emerald-400 bg-emerald-500/5",
        phase === "error"     && "border-red-500/40 text-red-400 hover:bg-red-500/10",
      )}
    >
      {phase === "idle"      && <><FileOutput    className="h-3.5 w-3.5" />Export PDF</>}
      {phase === "exporting" && <><Loader2       className="h-3.5 w-3.5 animate-spin" />Exporting…</>}
      {phase === "success"   && <><CheckCircle2  className="h-3.5 w-3.5" />PDF Ready!</>}
      {phase === "error"     && <><AlertCircle   className="h-3.5 w-3.5" />Retry Export</>}
    </button>
  )
}
