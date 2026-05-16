"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Copy,
  FileOutput,
  Info,
  Loader2,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react"
import BlockEditor, { type BlockEditorRef } from "@/components/editor/BlockEditor"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { decodeDiagnosticsHeader, summarizeDiagnostics, type ComposerDiagnostics } from "@/lib/export/professional-composer"
import type { AiStructureIssue } from "@/lib/ai-ebook/ebook-generation-schema"
import { exportThemeLabel, type ExportTheme } from "@/lib/export/theme-mapping"
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
type ExportMode = "standard" | "professional"
type DraftPhase = "idle" | "generating" | "ready" | "inserting" | "error"
type DraftInsertMode = "replace" | "append" | "new-project"
type DiagnosticsItem = {
  code: string
  severity: "info" | "warning" | "error"
  message: string
  suggestedFix: string
  component?: string | null
  page_number?: number | null
}
type DiagnosticsView = {
  title: string
  subtitle: string
  issues: DiagnosticsItem[]
}
interface ExportState {
  phase: ExportPhase
  step?: string
  error?: string
  diagnostics?: ComposerDiagnostics | null
}

interface GeneratedDraft {
  title: string
  subtitle: string
  author: string
  chapters: Chapter[]
}

interface DraftResponse {
  draft: GeneratedDraft
  diagnostics: AiStructureIssue[]
  summary: {
    chapterCount: number
    blockCount: number
  }
}

interface DraftState {
  phase: DraftPhase
  step?: string
  response?: DraftResponse
  error?: string
  insertMode: DraftInsertMode
}

const DRAFT_PHASE_LABEL: Record<DraftPhase, string> = {
  idle: "Ready to generate",
  generating: "Generating outline",
  ready: "Review draft",
  inserting: "Inserting draft",
  error: "Draft generation failed",
}

const EXPORT_PHASE_LABEL: Record<ExportPhase, string> = {
  idle: "Ready to export",
  exporting: "Building professional PDF",
  success: "Download prepared",
  error: "Export failed",
}

const EXPORT_SETTINGS_STORAGE_PREFIX = "ebook-studio:professional-export"

function getExportSettingsKey(projectId: string) {
  return `${EXPORT_SETTINGS_STORAGE_PREFIX}:${projectId}`
}

function readStoredExportSettings(projectId: string): {
  exportMode?: ExportMode
  professionalTheme?: ExportTheme
} | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(getExportSettingsKey(projectId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<{ exportMode: ExportMode; professionalTheme: ExportTheme }>
    return {
      exportMode: parsed.exportMode === "professional" ? "professional" : parsed.exportMode === "standard" ? "standard" : undefined,
      professionalTheme:
        parsed.professionalTheme === "clean-minimal" ||
        parsed.professionalTheme === "dark-cinematic" ||
        parsed.professionalTheme === "luxury-black-gold"
          ? parsed.professionalTheme
          : undefined,
    }
  } catch {
    return null
  }
}

function writeStoredExportSettings(
  projectId: string,
  settings: { exportMode: ExportMode; professionalTheme: ExportTheme }
) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(getExportSettingsKey(projectId), JSON.stringify(settings))
  } catch {
    // Best effort only.
  }
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

  const [projectTitle, setProjectTitle] = useState(project.title)
  const [isDirty,     setIsDirty]     = useState(false)
  const [exportState, setExportState] = useState<ExportState>({ phase: "idle" })
  const [exportMode, setExportMode] = useState<ExportMode>("standard")
  const [professionalTheme, setProfessionalTheme] = useState<ExportTheme>(
    project.theme === "clean-minimal" ? "clean-minimal" : "luxury-black-gold"
  )
  const [draftOpen, setDraftOpen] = useState(false)
  const [draftState, setDraftState] = useState<DraftState>({ phase: "idle", insertMode: "replace" })
  const [diagnosticsView, setDiagnosticsView] = useState<DiagnosticsView | null>(null)

  // Ref to BlockEditor — lets us call requestSave() before navigating away.
  const editorRef = useRef<BlockEditorRef>(null)
  const [exportSettingsReady, setExportSettingsReady] = useState(false)

  // Stable ref so event handlers always read the latest isDirty value
  // without being re-registered on every state change.
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  useEffect(() => {
    setExportSettingsReady(false)
    const stored = readStoredExportSettings(project.id)
    if (stored) {
      if (stored.exportMode) {
        setExportMode(stored.exportMode)
      }
      if (stored.professionalTheme) {
        setProfessionalTheme(stored.professionalTheme)
      }
    }
    setExportSettingsReady(true)
  }, [project.id])

  useEffect(() => {
    if (!exportSettingsReady) return
    writeStoredExportSettings(project.id, { exportMode, professionalTheme })
  }, [exportMode, professionalTheme, project.id, exportSettingsReady])

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
    const id = setTimeout(() => setExportState({ phase: "idle" }), 5_000)
    return () => clearTimeout(id)
  }, [exportState.phase])

  // ── Export PDF ────────────────────────────────────────────────────────────
  // The API route returns the PDF binary directly (no Storage, no signed URL).
  // We receive the ArrayBuffer, create a temporary Blob URL, and click a
  // hidden anchor to trigger the browser's native file-download dialog.
  const handleExport = useCallback(async (requestedMode?: ExportMode) => {
    const mode = requestedMode ?? exportMode
    setExportState({ phase: "exporting", step: "Building professional PDF" })

    try {
      const isProfessional = mode === "professional"
      const res = await fetch(isProfessional ? "/api/export-professional-pdf" : "/api/export-pdf", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(
          isProfessional
            ? { projectId: project.id, theme: professionalTheme }
            : { projectId: project.id }
        ),
      })

      if (!res.ok) {
        // Error responses are still JSON.
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
        setExportState({
          phase: "error",
          step: undefined,
          error:
            (json.error as string | undefined) ??
            `Export failed (HTTP ${res.status})`,
        })
        return
      }

      setExportState((current) => ({ ...current, step: "Preparing download" }))

      // Success — response body is the raw PDF binary.
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const diagnostics = decodeDiagnosticsHeader(res.headers.get("X-Composer-Diagnostics"))

      // Derive a clean filename from the Content-Disposition header if present,
      // otherwise fall back to the project title.
      const disposition = res.headers.get("Content-Disposition") ?? ""
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? `${projectTitle ?? "ebook"}.pdf`

      const anchor = document.createElement("a")
      anchor.href     = blobUrl
      anchor.download = filename
      anchor.style.display = "none"
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)

      // Release the object URL after a short delay so the download starts.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000)

      setExportState({ phase: "success", step: "Download prepared", diagnostics })
    } catch (err) {
      setExportState({
        phase: "error",
        step: undefined,
        error:
          err instanceof Error
            ? err.message
            : "Unexpected error during export.",
      })
    }
  }, [exportMode, professionalTheme, project.id, projectTitle])

  function openExportDiagnostics() {
    if (!exportState.diagnostics) return
    setDiagnosticsView({
      title: "Professional export diagnostics",
      subtitle: "Layout and pagination notes from the composer",
      issues: exportState.diagnostics.issues.map((issue) => ({
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
        suggestedFix: issue.suggested_fix,
        component: issue.component ?? null,
        page_number: issue.page_number ?? null,
      })),
    })
  }

  const draftBusy = draftState.phase === "generating" || draftState.phase === "inserting"
  const draftPhaseLabel = draftState.step ?? DRAFT_PHASE_LABEL[draftState.phase]
  const exportPhaseLabel = exportState.step ?? EXPORT_PHASE_LABEL[exportState.phase]

  async function handleGenerateDraft(input: Record<string, string>) {
    setDraftState((current) => ({ ...current, phase: "generating", step: "Generating outline" }))
    try {
      const res = await fetch("/api/generate-ebook-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      setDraftState((current) => ({ ...current, step: "Structuring chapters" }))
      const json = (await res.json().catch(() => ({}))) as Partial<DraftResponse> & { error?: string }
      if (!res.ok || !json.draft || !json.summary) {
        throw new Error(json.error ?? `Draft generation failed (HTTP ${res.status})`)
      }
      const responseDraft = json.draft
      const responseSummary = json.summary
      setDraftState((current) => ({
        ...current,
        phase: "ready",
        step: "Review draft",
        response: {
          draft: responseDraft,
          diagnostics: json.diagnostics ?? [],
          summary: responseSummary,
        },
      }))
    } catch (err) {
      setDraftState((current) => ({
        ...current,
        phase: "error",
        step: undefined,
        error: err instanceof Error ? err.message : "Draft generation failed.",
      }))
    }
  }

  async function handleInsertDraft() {
    if (!draftState.response) return
    const draft = draftState.response.draft
    const insertMode = draftState.insertMode
    setDraftState((current) => ({ ...current, phase: "inserting", step: "Normalizing content" }))

    const currentChapters = editorRef.current?.getChapters() ?? initialChapters
    const nextChapters =
      insertMode === "append"
        ? [...currentChapters, ...draft.chapters]
        : draft.chapters
    const content =
      typeof project.content === "object" && project.content !== null
        ? { ...project.content, projectType: "ebook" as const, chapters: nextChapters }
        : { projectType: "ebook" as const, chapters: nextChapters }

    try {
      if (insertMode === "new-project") {
        setDraftState((current) => ({ ...current, step: "Applying to new project" }))
        const createRes = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: draft.title,
            author: draft.author || project.author || undefined,
            theme: project.theme,
          }),
        })
        const createJson = (await createRes.json().catch(() => ({}))) as { error?: string; project?: { id?: string } }
        if (!createRes.ok || !createJson.project?.id) {
          throw new Error(createJson.error ?? `Project creation failed (HTTP ${createRes.status})`)
        }

        const newProjectId = createJson.project.id
        const patchRes = await fetch(`/api/projects/${newProjectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subtitle: draft.subtitle,
            author: draft.author || project.author,
            content,
          }),
        })
        const patchJson = (await patchRes.json().catch(() => ({}))) as { error?: string }
        if (!patchRes.ok) {
          throw new Error(patchJson.error ?? `Draft insert failed (HTTP ${patchRes.status})`)
        }
        router.push(`/editor/${newProjectId}`)
        setDraftOpen(false)
        setDraftState({ phase: "idle", insertMode: "replace" })
        return
      }

      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: insertMode === "replace" ? draft.title : projectTitle,
          subtitle: insertMode === "replace" ? draft.subtitle : project.subtitle,
          author: insertMode === "replace" ? draft.author || project.author : project.author,
          content,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? `Draft insert failed (HTTP ${res.status})`)

      setDraftState((current) => ({ ...current, step: "Preparing editor update" }))

      if (insertMode === "replace") {
        editorRef.current?.replaceChapters(draft.chapters)
        setProjectTitle(draft.title)
      } else {
        editorRef.current?.replaceChapters(nextChapters)
      }
      setIsDirty(false)
      setDraftOpen(false)
      setDraftState({ phase: "idle", insertMode: "replace" })
    } catch (err) {
      setDraftState((current) => ({
        ...current,
        phase: "error",
        step: undefined,
        insertMode: current.insertMode,
        error: err instanceof Error ? err.message : "Draft insert failed.",
      }))
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">

      {/* Editor top bar */}
      <div className="shrink-0 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#1e3a52] bg-[#0a1929] px-3 py-2 sm:px-4">

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

        <span className="min-w-0 flex-1 basis-32 truncate text-sm font-semibold text-white">
          {projectTitle}
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

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          <button
            type="button"
            onClick={() => setDraftOpen(true)}
            disabled={draftBusy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-teal-400/30 bg-teal-400/5 px-2.5 py-1 text-xs text-teal-200 transition-colors hover:border-teal-300/60 hover:bg-teal-400/10 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Sparkles className={cn("h-3.5 w-3.5", draftBusy && "animate-pulse")} />
            {draftPhaseLabel}
          </button>

          <select
            value={exportMode}
            onChange={(event) => setExportMode(event.target.value as ExportMode)}
            className="min-w-0 flex-1 rounded-md border border-[#1e3a52] bg-[#07111f] px-2 py-1 text-xs text-slate-300 outline-none focus:border-[#C9A84C]/60 sm:w-36 sm:flex-none"
            aria-label="Export mode"
          >
            <option value="standard">Standard export</option>
            <option value="professional">Professional Composer</option>
          </select>

          {exportMode === "professional" && (
            <select
              value={professionalTheme}
              onChange={(event) => setProfessionalTheme(event.target.value as ExportTheme)}
              className="min-w-0 flex-1 rounded-md border border-[#1e3a52] bg-[#07111f] px-2 py-1 text-xs text-slate-300 outline-none focus:border-[#C9A84C]/60 sm:w-40 sm:flex-none"
              aria-label="Professional export theme"
            >
              <option value="luxury-black-gold">{exportThemeLabel("luxury-black-gold")}</option>
              <option value="dark-cinematic">{exportThemeLabel("dark-cinematic")}</option>
              <option value="clean-minimal">{exportThemeLabel("clean-minimal")}</option>
            </select>
          )}

          <ExportButton state={exportState} mode={exportMode} onClick={handleExport} />
        </div>
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

      {exportState.phase === "success" && exportState.diagnostics && summarizeDiagnostics(exportState.diagnostics) && (
        <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 flex-1 truncate">
              {summarizeDiagnostics(exportState.diagnostics)} Download is ready.
            </span>
            <button
              type="button"
              onClick={openExportDiagnostics}
              className="shrink-0 rounded border border-amber-500/20 px-2 py-1 text-[11px] text-amber-100 hover:bg-amber-500/10"
            >
              View
            </button>
          </div>
        </div>
      )}

      {/* Three-panel BlockEditor */}
      <div className="flex-1 overflow-hidden">
        <BlockEditor
          ref={editorRef}
          projectId={project.id}
          initialChapters={initialChapters}
          theme={project.theme}
          projectTitle={projectTitle}
          website={project.website}
          onSave={handleSave}
          onDirtyChange={setIsDirty}
          onRequestImportPdf={() => router.push("/dashboard")}
          onRequestProfessionalExport={() => {
            setExportMode("professional")
            void handleExport("professional")
          }}
        />
      </div>

      <GenerateDraftDialog
        open={draftOpen}
        onOpenChange={(open) => {
          setDraftOpen(open)
          if (!open) setDraftState((current) => ({ phase: "idle", insertMode: current.insertMode }))
        }}
        state={draftState}
        onInsertModeChange={(insertMode) => setDraftState((current) => ({ ...current, insertMode }))}
        onGenerate={handleGenerateDraft}
        onInsert={handleInsertDraft}
        onShowDiagnostics={(view) => setDiagnosticsView(view)}
      />

      <DiagnosticsDialog
        open={diagnosticsView !== null}
        onOpenChange={(open) => {
          if (!open) setDiagnosticsView(null)
        }}
        view={diagnosticsView}
      />

      {exportState.phase !== "idle" && (
        <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#1e3a52] bg-[#07111f]/95 px-3 py-2 text-xs text-slate-200 shadow-lg backdrop-blur">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-300" />
          <span className="max-w-[70vw] truncate">{exportPhaseLabel}</span>
        </div>
      )}
    </div>
  )
}

// ─── Export button ────────────────────────────────────────────────────────────

interface GenerateDraftDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: DraftState
  onInsertModeChange: (mode: DraftInsertMode) => void
  onGenerate: (input: Record<string, string>) => Promise<void>
  onInsert: () => Promise<void>
  onShowDiagnostics: (view: DiagnosticsView) => void
}

function GenerateDraftDialog({
  open,
  onOpenChange,
  state,
  onInsertModeChange,
  onGenerate,
  onInsert,
  onShowDiagnostics,
}: GenerateDraftDialogProps) {
  const [form, setForm] = useState({
    topic: "",
    audience: "",
    format: "luxury-lead-magnet",
    tone: "polished and practical",
    length: "medium",
    ctaGoal: "",
    keywords: "",
  })

  const isBusy = state.phase === "generating" || state.phase === "inserting"
  const diagnostics = state.response?.diagnostics ?? []
  const warnings = diagnostics.filter((item) => item.severity === "warning")
  const info = diagnostics.filter((item) => item.severity === "info")

  function update(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-[#1e3a52] bg-[#0a1929] text-slate-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Sparkles className="h-4 w-4 text-teal-300" />
            Generate Ebook Draft
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Create a structured draft, review the chapter summary, then insert it into the editor.
          </DialogDescription>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-teal-400/20 bg-teal-400/5 px-2.5 py-1 text-[11px] text-teal-100">
            <Loader2 className={cn("h-3 w-3", isBusy && "animate-spin")} />
            {DRAFT_PHASE_LABEL[state.phase]}
          </div>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Insertion mode">
            <select
              value={state.insertMode}
              onChange={(event) => onInsertModeChange(event.target.value as DraftInsertMode)}
              className="h-9 w-full rounded-md border border-[#1e3a52] bg-[#07111f] px-3 text-sm text-white outline-none focus:border-teal-300/60"
            >
              <option value="replace">Replace current content</option>
              <option value="append">Append after existing chapters</option>
              <option value="new-project">Insert into new project</option>
            </select>
          </Field>
          <Field label="Topic or title">
            <input value={form.topic} onChange={(event) => update("topic", event.target.value)} placeholder="Premium client onboarding" className="h-9 w-full rounded-md border border-[#1e3a52] bg-[#07111f] px-3 text-sm text-white outline-none focus:border-teal-300/60" />
          </Field>
          <Field label="Target audience">
            <input value={form.audience} onChange={(event) => update("audience", event.target.value)} placeholder="Solo consultants" className="h-9 w-full rounded-md border border-[#1e3a52] bg-[#07111f] px-3 text-sm text-white outline-none focus:border-teal-300/60" />
          </Field>
          <Field label="Preset">
            <select value={form.format} onChange={(event) => update("format", event.target.value)} className="h-9 w-full rounded-md border border-[#1e3a52] bg-[#07111f] px-3 text-sm text-white outline-none focus:border-teal-300/60">
              <option value="luxury-lead-magnet">Luxury Lead Magnet</option>
              <option value="consultant-guide">Consultant Guide</option>
              <option value="cinematic-ebook">Cinematic Ebook</option>
              <option value="educational-handbook">Educational Handbook</option>
              <option value="workbook">Workbook</option>
              <option value="minimal-clean-guide">Minimal Clean Guide</option>
            </select>
          </Field>
          <Field label="Desired length">
            <select value={form.length} onChange={(event) => update("length", event.target.value)} className="h-9 w-full rounded-md border border-[#1e3a52] bg-[#07111f] px-3 text-sm text-white outline-none focus:border-teal-300/60">
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
          </Field>
          <Field label="Tone">
            <input value={form.tone} onChange={(event) => update("tone", event.target.value)} placeholder="Calm, expert, premium" className="h-9 w-full rounded-md border border-[#1e3a52] bg-[#07111f] px-3 text-sm text-white outline-none focus:border-teal-300/60" />
          </Field>
          <Field label="CTA goal">
            <input value={form.ctaGoal} onChange={(event) => update("ctaGoal", event.target.value)} placeholder="Book a consultation" className="h-9 w-full rounded-md border border-[#1e3a52] bg-[#07111f] px-3 text-sm text-white outline-none focus:border-teal-300/60" />
          </Field>
          <Field label="Optional keywords">
            <textarea value={form.keywords} onChange={(event) => update("keywords", event.target.value)} placeholder="onboarding, client experience, consulting systems" className="min-h-20 w-full rounded-md border border-[#1e3a52] bg-[#07111f] px-3 py-2 text-sm text-white outline-none focus:border-teal-300/60" />
          </Field>
        </div>

        {state.phase === "error" && state.error && (
          <div className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-300">
            {state.error}
          </div>
        )}

        {state.response && (
          <div className="space-y-3 rounded-md border border-[#1e3a52] bg-[#07111f] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-white">{state.response.draft.title}</p>
                <p className="text-xs text-slate-400">{state.response.draft.subtitle}</p>
              </div>
              <div className="text-xs text-slate-300">
                {state.response.summary.chapterCount} chapters · {state.response.summary.blockCount} blocks
              </div>
            </div>
            <div className="rounded border border-[#1e3a52]/70 bg-[#0a1929] px-2 py-1.5 text-xs text-slate-300">
              {state.insertMode === "replace" && "This will overwrite the current project content after confirmation."}
              {state.insertMode === "append" && "This will keep existing chapters and add the generated draft after them."}
              {state.insertMode === "new-project" && "This will create a new project and leave the current project unchanged."}
            </div>
            <div className="grid gap-1 text-xs text-slate-400">
              {state.response.draft.chapters.map((chapter) => (
                <div key={chapter.id} className="flex items-center justify-between gap-3 rounded border border-[#1e3a52]/70 px-2 py-1">
                  <span className="truncate text-slate-200">{chapter.title}</span>
                  <span className="shrink-0">{chapter.blocks.length} blocks</span>
                </div>
              ))}
            </div>
            {(warnings.length > 0 || info.length > 0) && (
              <div className="flex items-center justify-between gap-2 rounded border border-amber-500/20 bg-amber-500/5 px-2 py-2 text-xs text-amber-100">
                <span className="min-w-0 truncate">
                  Diagnostics: {warnings.length} warnings, {info.length} info. {diagnostics[0]?.message}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onShowDiagnostics({
                      title: "AI draft diagnostics",
                      subtitle: "Structured generation warnings and repair notes",
                      issues: diagnostics,
                    })
                  }
                  className="shrink-0 rounded border border-amber-500/20 px-2 py-1 text-[11px] text-amber-100 hover:bg-amber-500/10"
                >
                  View
                </button>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-[#1e3a52] bg-transparent text-slate-300 hover:bg-white/5 hover:text-white" disabled={isBusy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onGenerate(form)} className="bg-teal-500 text-[#07111f] hover:bg-teal-400" disabled={isBusy || !form.topic.trim()}>
            {state.phase === "generating" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            {state.phase === "generating" ? (state.step ?? "Generating…") : "Generate"}
          </Button>
          <Button type="button" onClick={onInsert} className="bg-[#C9A84C] text-[#07111f] hover:bg-[#e0b85a]" disabled={isBusy || !state.response}>
            {state.phase === "inserting" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
            {state.phase === "inserting"
              ? (state.step ?? "Inserting…")
              : state.insertMode === "replace"
                ? "Replace Content"
                : state.insertMode === "append"
                  ? "Append Draft"
                  : "Create New Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-slate-300">
      {label}
      {children}
    </label>
  )
}

function DiagnosticsDialog({
  open,
  onOpenChange,
  view,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  view: DiagnosticsView | null
}) {
  const [copied, setCopied] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    if (open) {
      setCopied(false)
      setShowRaw(false)
    }
  }, [open, view])

  if (!view) return null
  const issues = view.issues

  const groups = {
    error: issues.filter((issue) => issue.severity === "error"),
    warning: issues.filter((issue) => issue.severity === "warning"),
    info: issues.filter((issue) => issue.severity === "info"),
  }

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(issues, null, 2))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-[#1e3a52] bg-[#0a1929] text-slate-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <CircleAlert className="h-4 w-4 text-amber-300" />
            {view.title}
          </DialogTitle>
          <DialogDescription className="text-slate-400">{view.subtitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {([
            ["error", "Errors", groups.error, CircleAlert, "border-red-500/20 bg-red-500/5", "text-red-300"],
            ["warning", "Warnings", groups.warning, TriangleAlert, "border-amber-500/20 bg-amber-500/5", "text-amber-200"],
            ["info", "Info", groups.info, Info, "border-sky-500/20 bg-sky-500/5", "text-sky-200"],
          ] as const).map(([key, label, issues, Icon, panelClass, iconClass]) => (
            <div key={key} className={cn("rounded-md border p-3", panelClass)}>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <Icon className={cn("h-4 w-4", iconClass)} />
                {label} ({issues.length})
              </div>
              {issues.length === 0 ? (
                <p className="text-xs text-slate-500">None</p>
              ) : (
                <div className="space-y-2">
                  {issues.map((issue, index) => (
                    <div key={`${issue.code}-${index}`} className="rounded border border-white/5 bg-black/10 px-2 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm text-white">{friendlyDiagnosticLabel(issue.code, issue.message)}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{issue.message}</p>
                        </div>
                        <span className="shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                          {issue.code}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-300">{issue.suggestedFix}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={copyJson}
            className="border-[#1e3a52] bg-transparent text-slate-300 hover:bg-white/5 hover:text-white"
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy JSON"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowRaw((value) => !value)}
            className="border-[#1e3a52] bg-transparent text-slate-300 hover:bg-white/5 hover:text-white"
          >
            {showRaw ? "Hide raw" : "Show raw"}
          </Button>
        </div>

        {showRaw && (
          <pre className="max-h-72 overflow-auto rounded-md border border-[#1e3a52] bg-[#07111f] p-3 text-[11px] leading-relaxed text-slate-300">
            {JSON.stringify(view.issues, null, 2)}
          </pre>
        )}
      </DialogContent>
    </Dialog>
  )
}

function friendlyDiagnosticLabel(code: string, fallback: string): string {
  const map: Record<string, string> = {
    TABLE_SPLIT_REVIEW: "Large table may split across pages.",
    PAGE_SPARSITY: "Sparse chapter detected.",
    MISSING_CTA: "CTA auto-generated.",
    EMPTY_CTA: "CTA is empty.",
    SPARSE_CHAPTER: "Sparse chapter detected.",
    EXCESSIVE_CHAPTER_LENGTH: "Chapter is long and may need splitting.",
    LONG_UNBROKEN_PROSE: "Paragraph is too dense.",
    MALFORMED_TABLE_REPAIRED: "Table structure was repaired.",
    EMPTY_BLOCKS_REPAIRED: "Empty section was repaired.",
    UNSUPPORTED_AI_BLOCK: "Unsupported block was normalized.",
  }
  return map[code] ?? fallback
}

interface ExportButtonProps {
  state: ExportState
  mode: ExportMode
  onClick: () => void
}

function ExportButton({ state, mode, onClick }: ExportButtonProps) {
  const { phase } = state
  const idleLabel = mode === "professional" ? "Export Pro PDF" : "Export PDF"
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
      {phase === "idle"      && <><FileOutput    className="h-3.5 w-3.5" />{idleLabel}</>}
      {phase === "exporting" && <><Loader2       className="h-3.5 w-3.5 animate-spin" />{state.step ?? "Building…"}</>}
      {phase === "success"   && <><CheckCircle2  className="h-3.5 w-3.5" />PDF Ready!</>}
      {phase === "error"     && <><AlertCircle   className="h-3.5 w-3.5" />Retry Export</>}
    </button>
  )
}
