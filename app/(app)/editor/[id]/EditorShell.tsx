"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileOutput,
  Loader2,
  X,
} from "lucide-react"
import BlockEditor from "@/components/editor/BlockEditor"
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

// Export button phases — never silent.
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
  const initialChapters = extractChapters(project.content)

  const [isDirty,      setIsDirty]      = useState(false)
  const [exportState,  setExportState]  = useState<ExportState>({ phase: "idle" })

  // ── Warn before navigating away with unsaved changes ───────────────────────
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])

  // ── Auto-reset export button after success ─────────────────────────────────
  useEffect(() => {
    if (exportState.phase !== "success") return
    const id = setTimeout(() => setExportState({ phase: "idle" }), 3_000)
    return () => clearTimeout(id)
  }, [exportState.phase])

  // ── Save ────────────────────────────────────────────────────────────────────
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
          (json as { error?: string }).error ?? `Save failed (HTTP ${res.status})`
        )
      }

      setIsDirty(false)
    },
    [project.id]
  )

  // ── Export PDF ──────────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    setExportState({ phase: "exporting" })

    try {
      const res = await fetch("/api/export-pdf", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ projectId: project.id }),
      })

      const json = await res.json().catch(() => ({})) as Record<string, unknown>

      if (!res.ok) {
        setExportState({
          phase: "error",
          error: (json.error as string | undefined) ?? `Export failed (HTTP ${res.status})`,
        })
        return
      }

      const downloadUrl = json.url as string | undefined
      if (!downloadUrl) {
        setExportState({ phase: "error", error: "No download URL returned from server." })
        return
      }

      // Open in a new tab — the signed URL has Content-Disposition: attachment
      // so the browser will download the PDF rather than display it.
      window.open(downloadUrl, "_blank", "noopener,noreferrer")

      setExportState({ phase: "success" })
    } catch (err) {
      setExportState({
        phase: "error",
        error: err instanceof Error ? err.message : "Unexpected error during export.",
      })
    }
  }, [project.id])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">

      {/* ── Editor top bar ──────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 border-b border-[#1e3a52] bg-[#0a1929] px-4 h-11">

        {/* Back */}
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          My Projects
        </Link>

        <span className="text-slate-700 text-xs">·</span>

        {/* Project title */}
        <span className="text-sm font-semibold text-white truncate min-w-0 flex-1">
          {project.title}
        </span>

        {/* Author */}
        {project.author && (
          <span className="hidden md:block text-xs text-slate-600 shrink-0">
            by {project.author}
          </span>
        )}

        {/* Theme badge */}
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

        {/* Export PDF button ─────────────────────────────────────────────────
            Cycles through idle → exporting → success / error.
            Never disabled silently — the user always knows what's happening. */}
        <ExportButton state={exportState} onClick={handleExport} />
      </div>

      {/* ── Export error banner (below top bar, dismissible) ────────────────── */}
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

      {/* ── Three-panel BlockEditor ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <BlockEditor
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

// ─── Export button sub-component ─────────────────────────────────────────────

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
        "shrink-0 flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs",
        "transition-all duration-150",
        phase === "idle" && [
          "border-[#C9A84C]/40 text-[#C9A84C]",
          "hover:bg-[#C9A84C]/10 hover:border-[#C9A84C]/70",
        ],
        phase === "exporting" && [
          "border-[#1e3a52] text-slate-400 cursor-not-allowed",
        ],
        phase === "success" && [
          "border-emerald-500/40 text-emerald-400 bg-emerald-500/5",
        ],
        phase === "error" && [
          "border-red-500/40 text-red-400 hover:bg-red-500/10",
        ],
      )}
    >
      {phase === "idle" && (
        <>
          <FileOutput className="h-3.5 w-3.5" />
          Export PDF
        </>
      )}

      {phase === "exporting" && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Exporting…
        </>
      )}

      {phase === "success" && (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" />
          PDF Ready!
        </>
      )}

      {phase === "error" && (
        <>
          <AlertCircle className="h-3.5 w-3.5" />
          Retry Export
        </>
      )}
    </button>
  )
}
