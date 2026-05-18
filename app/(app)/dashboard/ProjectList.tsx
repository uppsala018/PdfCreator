"use client"

import { useEffect, useState, useTransition, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  BookOpen,
  Plus,
  Upload,
  Trash2,
  ArrowRight,
  Clock,
  User,
  Loader2,
  FileText,
  Sparkles,
  CheckCircle2,
  CircleAlert,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { ebookJobProgress } from "@/lib/ai-ebook/job-progress"
import type { ProfessionalEbookPlan } from "@/lib/ai-ebook/generation-plan"

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProjectSummary = {
  id: string
  title: string
  author: string | null
  theme: string
  template: string
  content?: unknown
  updated_at: string
}

type ImportPdfError = {
  error?: string
  code?: string
  detail?: string
}

type AutopilotDiagnostic = {
  code: string
  severity: "info" | "warning" | "error"
  message: string
  suggestedFix: string
  component?: string | null
}

type AutopilotDraft = {
  title: string
  subtitle: string
  author: string
  chapters: Array<{
    id: string
    title: string
    blocks: unknown[]
  }>
}

type AutopilotResponse = {
  draft: AutopilotDraft
  diagnostics: AutopilotDiagnostic[]
  summary: {
    title: string
    subtitle: string
    chapterCount: number
    blockCount: number
    diagnosticsCount: number
    regenerationPasses: number
    provider: {
      id: string
      model: string
      usedFallback: boolean
    }
    source: null | {
      inputKind: string
      wordCount: number
      sectionCount: number
    }
  }
  regeneration?: {
    passHistory?: Array<{
      pass: number
      improved: boolean
      changes: string[]
    }>
  }
}

const MAX_IMPORT_PDF_BYTES = 50 * 1024 * 1024
const MAX_AUTOPILOT_SOURCE_BYTES = 1.5 * 1024 * 1024

function formatImportError(value: unknown): string {
  const json = value as ImportPdfError
  if (!json || typeof json !== "object") return "Failed to import PDF."

  const base = typeof json.error === "string" ? json.error : "Failed to import PDF."
  const code = typeof json.code === "string" ? json.code : null
  const detail = typeof json.detail === "string" ? json.detail : null

  return [
    code ? `[${code}] ${base}` : base,
    detail ? `Details: ${detail}` : null,
  ].filter(Boolean).join(" ")
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const THEME_LABEL: Record<string, string> = {
  "dark-cinematic": "Dark Cinematic",
  "clean-minimal": "Clean Minimal",
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return "Just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return "Yesterday"
  if (days < 30) return `${days} days ago`
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

// ─── New Project dialog form state ────────────────────────────────────────────

type NewProjectForm = {
  title: string
  author: string
  theme: "dark-cinematic" | "clean-minimal"
}

const EMPTY_FORM: NewProjectForm = {
  title: "",
  author: "",
  theme: "dark-cinematic",
}

type CompleteEbookForm = {
  topic: string
  audience: string
  tone: string
  ebookPreset: string
  targetLength: "short" | "standard" | "long"
  ctaGoal: string
  theme: "luxury-black-gold" | "dark-cinematic" | "clean-minimal"
  providerId: string
  model: string
}

type ProfessionalEbookForm = CompleteEbookForm & {
  desiredChapterCount: string
  desiredTotalPages: string
  minPagesPerChapter: string
  sectionCountPerChapter: string
  wordsPerPage: string
  chapterDefinitions: string
  includeImages: boolean
  imageFrequency: "none" | "cover" | "per_chapter" | "every_x_pages" | "custom"
  imageEveryPages: string
  imageStylePrompt: string
  imageProviderPreference: string
}

const EMPTY_COMPLETE_EBOOK_FORM: CompleteEbookForm = {
  topic: "",
  audience: "",
  tone: "Clear, practical, premium",
  ebookPreset: "luxury-lead-magnet",
  targetLength: "standard",
  ctaGoal: "",
  theme: "luxury-black-gold",
  providerId: "",
  model: "",
}

const EMPTY_PROFESSIONAL_EBOOK_FORM: ProfessionalEbookForm = {
  ...EMPTY_COMPLETE_EBOOK_FORM,
  desiredChapterCount: "",
  desiredTotalPages: "",
  minPagesPerChapter: "",
  sectionCountPerChapter: "",
  wordsPerPage: "400",
  chapterDefinitions: "",
  includeImages: false,
  imageFrequency: "none",
  imageEveryPages: "",
  imageStylePrompt: "",
  imageProviderPreference: "",
}

type ProfessionalEbookJob = {
  id: string
  status: "planning" | "generating" | "ready" | "failed" | "finalized" | string
  settings: ProfessionalEbookPlan
  current_chapter_index: number
  diagnostics: AutopilotDiagnostic[] | unknown
  error: string | null
  result_project_id: string | null
}

type AutopilotPhase =
  | "idle"
  | "intake"
  | "outline"
  | "chapters"
  | "diagnostics"
  | "ready"
  | "creating"
  | "error"

const AUTOPILOT_STEPS: Array<{ phase: AutopilotPhase; label: string }> = [
  { phase: "intake", label: "Intake" },
  { phase: "outline", label: "Outline" },
  { phase: "chapters", label: "Chapters" },
  { phase: "diagnostics", label: "Diagnostics" },
  { phase: "ready", label: "Editor draft" },
]

// ─── Theme selector card ──────────────────────────────────────────────────────

function ThemeCard({
  value,
  selected,
  onSelect,
}: {
  value: "dark-cinematic" | "clean-minimal"
  selected: boolean
  onSelect: () => void
}) {
  const isDark = value === "dark-cinematic"

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex-1 rounded-lg border-2 p-3 text-left transition-all",
        selected
          ? "border-[#C9A84C] bg-[#C9A84C]/5"
          : "border-[#1e3a52] hover:border-[#2a4d6e]"
      )}
    >
      {/* Mini preview */}
      <div
        className={cn(
          "mb-2.5 h-14 rounded-md overflow-hidden flex flex-col",
          isDark ? "bg-[#0D1B2A]" : "bg-white"
        )}
      >
        <div
          className={cn(
            "h-3 w-full",
            isDark ? "bg-[#C9A84C]/30" : "bg-slate-100"
          )}
        />
        <div className="flex-1 p-1.5 space-y-1">
          <div
            className={cn(
              "h-1.5 w-3/4 rounded-sm",
              isDark ? "bg-white/20" : "bg-slate-200"
            )}
          />
          <div
            className={cn(
              "h-1 w-1/2 rounded-sm",
              isDark ? "bg-white/10" : "bg-slate-100"
            )}
          />
        </div>
      </div>

      <p className="text-xs font-semibold text-white">
        {THEME_LABEL[value]}
      </p>
      <p className="text-[10px] text-slate-500 mt-0.5">
        {isDark ? "Gold accents on navy" : "Professional white layout"}
      </p>

      {selected && (
        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#C9A84C] flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-[#0D1B2A]" viewBox="0 0 10 10" fill="none">
            <path
              d="M2 5l2 2 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </button>
  )
}

// ─── Project card ─────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  onDeleteClick,
}: {
  project: ProjectSummary
  onDeleteClick: (id: string) => void
}) {
  const isImportedPdf =
    typeof project.content === "object" &&
    project.content !== null &&
    "projectType" in project.content &&
    (project.content as { projectType?: unknown }).projectType === "imported_pdf"

  return (
    <div className="group relative flex flex-col rounded-xl border border-[#1e3a52] bg-[#0a1929] hover:border-[#2a4d6e] transition-colors">
      {/* Theme badge */}
      <div className="px-5 pt-5 pb-0 flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C9A84C]/30 bg-[#C9A84C]/5 px-2.5 py-1 text-[11px] font-medium text-[#C9A84C]">
          <FileText className="w-3 h-3" />
          {isImportedPdf ? "Imported PDF" : THEME_LABEL[project.theme] ?? project.theme}
        </span>

        <button
          onClick={() => onDeleteClick(project.id)}
          className={cn(
            "rounded-md p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-400/10",
            "opacity-0 group-hover:opacity-100 transition-all"
          )}
          title="Delete project"
          aria-label="Delete project"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 py-4">
        <h2 className="text-base font-semibold text-white leading-snug line-clamp-2">
          {project.title}
        </h2>

        {project.author && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
            <User className="w-3 h-3" />
            {project.author}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t border-[#1e3a52] px-5 py-3">
        <span className="flex items-center gap-1.5 text-xs text-slate-600">
          <Clock className="w-3 h-3" />
          {timeAgo(project.updated_at)}
        </span>

        <Link
          href={`/editor/${project.id}`}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
            "bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20",
            "hover:bg-[#C9A84C] hover:text-[#0D1B2A] hover:border-[#C9A84C]",
            "transition-all"
          )}
        >
          Open
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  onNew,
  onImport,
  onAutopilot,
  onProfessional,
}: {
  onNew: () => void
  onImport: () => void
  onAutopilot: () => void
  onProfessional: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-5 w-16 h-16 rounded-2xl bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center">
        <BookOpen className="w-8 h-8 text-[#C9A84C]" />
      </div>
      <h2 className="text-xl font-semibold text-white">No projects yet</h2>
      <p className="mt-2 text-sm text-slate-500 max-w-xs">
        Create your first ebook and start writing in minutes.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button
          onClick={onAutopilot}
          className="bg-teal-500 font-semibold text-[#07111f] hover:bg-teal-400"
        >
          <Sparkles className="w-4 h-4 mr-1.5" />
          Create Complete Ebook
        </Button>
        <Button
          onClick={onProfessional}
          className="bg-[#C9A84C] hover:bg-[#e0b85a] text-[#0D1B2A] font-semibold"
        >
          <Sparkles className="w-4 h-4 mr-1.5" />
          Professional Ebook Agent
        </Button>
        <Button
          variant="outline"
          onClick={onImport}
          className="border-[#1e3a52] bg-transparent text-slate-300 hover:bg-white/5 hover:text-white"
        >
          <Upload className="w-4 h-4 mr-1.5" />
          Import PDF
        </Button>
        <Button
          onClick={onNew}
          className="bg-[#07111f] border border-[#1e3a52] hover:bg-white/5 text-slate-200 font-semibold"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Create first project
        </Button>
      </div>
    </div>
  )
}

function CompleteEbookDialog({
  open,
  form,
  file,
  phase,
  error,
  result,
  onOpenChange,
  onFormChange,
  onFileChange,
  onGenerate,
  onCreateProject,
}: {
  open: boolean
  form: CompleteEbookForm
  file: File | null
  phase: AutopilotPhase
  error: string | null
  result: AutopilotResponse | null
  onOpenChange: (open: boolean) => void
  onFormChange: (form: CompleteEbookForm) => void
  onFileChange: (file: File | null) => void
  onGenerate: () => Promise<void>
  onCreateProject: () => Promise<void>
}) {
  const busy = phase === "intake" || phase === "outline" || phase === "chapters" || phase === "diagnostics" || phase === "creating"
  const diagnostics = result?.diagnostics ?? []
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === "warning")
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error")

  function update<K extends keyof CompleteEbookForm>(key: K, value: CompleteEbookForm[K]) {
    onFormChange({ ...form, [key]: value })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-[#1e3a52] bg-[#0a1929] text-white sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Sparkles className="h-4 w-4 text-teal-300" />
            Create Complete Ebook
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Generate a structured professional ebook, review diagnostics, then open it in the editor before export.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-5">
          {AUTOPILOT_STEPS.map((step) => {
            const currentIndex = AUTOPILOT_STEPS.findIndex((item) => item.phase === phase)
            const stepIndex = AUTOPILOT_STEPS.findIndex((item) => item.phase === step.phase)
            const complete = currentIndex > stepIndex || phase === "ready"
            const active = phase === step.phase
            return (
              <div
                key={step.phase}
                className={cn(
                  "rounded-md border px-2 py-2 text-xs",
                  active
                    ? "border-teal-300/40 bg-teal-400/10 text-teal-100"
                    : complete
                      ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-200"
                      : "border-[#1e3a52] bg-[#07111f] text-slate-500"
                )}
              >
                <div className="flex items-center gap-1.5">
                  {complete ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : active ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CircleAlert className="h-3.5 w-3.5" />
                  )}
                  {step.label}
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 rounded-lg border border-[#1e3a52] bg-[#07111f] p-4">
            <div className="space-y-1.5">
              <Label htmlFor="complete-topic" className="text-slate-300">
                Topic prompt
              </Label>
              <textarea
                id="complete-topic"
                value={form.topic}
                onChange={(event) => update("topic", event.target.value)}
                placeholder="Create a premium ebook about client onboarding systems for consultants."
                className="min-h-24 w-full rounded-md border border-[#1e3a52] bg-[#0D1B2A] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-teal-300/60"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <WizardField label="Audience">
                <Input
                  value={form.audience}
                  onChange={(event) => update("audience", event.target.value)}
                  placeholder="Solo consultants"
                  className="bg-[#0D1B2A] border-[#1e3a52] text-white"
                />
              </WizardField>
              <WizardField label="Tone">
                <Input
                  value={form.tone}
                  onChange={(event) => update("tone", event.target.value)}
                  className="bg-[#0D1B2A] border-[#1e3a52] text-white"
                />
              </WizardField>
              <WizardField label="Preset">
                <select
                  value={form.ebookPreset}
                  onChange={(event) => update("ebookPreset", event.target.value)}
                  className="h-9 w-full rounded-md border border-[#1e3a52] bg-[#0D1B2A] px-3 text-sm text-white outline-none"
                >
                  <option value="luxury-lead-magnet">Luxury Lead Magnet</option>
                  <option value="consultant-guide">Consultant Guide</option>
                  <option value="cinematic-ebook">Cinematic Ebook</option>
                  <option value="educational-handbook">Educational Handbook</option>
                  <option value="workbook">Workbook</option>
                </select>
              </WizardField>
              <WizardField label="Target length">
                <select
                  value={form.targetLength}
                  onChange={(event) => update("targetLength", event.target.value as CompleteEbookForm["targetLength"])}
                  className="h-9 w-full rounded-md border border-[#1e3a52] bg-[#0D1B2A] px-3 text-sm text-white outline-none"
                >
                  <option value="short">Short</option>
                  <option value="standard">Standard</option>
                  <option value="long">Long</option>
                </select>
              </WizardField>
              <WizardField label="CTA goal">
                <Input
                  value={form.ctaGoal}
                  onChange={(event) => update("ctaGoal", event.target.value)}
                  placeholder="Book a strategy call"
                  className="bg-[#0D1B2A] border-[#1e3a52] text-white"
                />
              </WizardField>
              <WizardField label="Theme">
                <select
                  value={form.theme}
                  onChange={(event) => update("theme", event.target.value as CompleteEbookForm["theme"])}
                  className="h-9 w-full rounded-md border border-[#1e3a52] bg-[#0D1B2A] px-3 text-sm text-white outline-none"
                >
                  <option value="luxury-black-gold">Luxury Black Gold</option>
                  <option value="dark-cinematic">Dark Cinematic</option>
                  <option value="clean-minimal">Clean Minimal</option>
                </select>
              </WizardField>
              <WizardField label="Provider">
                <select
                  value={form.providerId}
                  onChange={(event) => update("providerId", event.target.value)}
                  className="h-9 w-full rounded-md border border-[#1e3a52] bg-[#0D1B2A] px-3 text-sm text-white outline-none"
                >
                  <option value="">Use Settings default</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="mistral">Mistral</option>
                  <option value="custom">Other / Custom</option>
                </select>
              </WizardField>
              <WizardField label="Model">
                <Input
                  value={form.model}
                  onChange={(event) => update("model", event.target.value)}
                  placeholder="Use provider default"
                  className="bg-[#0D1B2A] border-[#1e3a52] text-white"
                />
              </WizardField>
            </div>

            <div className="rounded-md border border-dashed border-[#1e3a52] bg-[#0D1B2A] p-3">
              <Label htmlFor="complete-source" className="mb-2 block text-sm text-slate-300">
                Optional source file
              </Label>
              <Input
                id="complete-source"
                type="file"
                accept=".txt,.md,.markdown,text/plain,text/markdown"
                disabled={busy}
                onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
                className="bg-[#07111f] border-[#1e3a52] text-slate-300 file:text-slate-200"
              />
              {file && (
                <p className="mt-2 truncate text-xs text-slate-500">
                  {file.name}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-[#1e3a52] bg-[#07111f] p-4">
            <div>
              <p className="text-sm font-semibold text-white">Generation summary</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                The generated draft opens in the editor, where content can be revised before Professional Composer export.
              </p>
            </div>

            {result ? (
              <div className="space-y-3">
                <div className="rounded-md border border-[#1e3a52] bg-[#0D1B2A] p-3">
                  <p className="text-sm font-semibold text-white">{result.draft.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{result.draft.subtitle}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <SummaryTile label="Chapters" value={result.summary.chapterCount} />
                    <SummaryTile label="Blocks" value={result.summary.blockCount} />
                    <SummaryTile label="Diagnostics" value={result.summary.diagnosticsCount} />
                    <SummaryTile label="Passes" value={result.summary.regenerationPasses} />
                  </div>
                </div>

                <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100">
                  <div className="flex items-center justify-between gap-2">
                    <span>{errors.length} errors · {warnings.length} warnings</span>
                    <span>{result.summary.provider.id}/{result.summary.provider.model}</span>
                  </div>
                  {diagnostics.slice(0, 4).map((diagnostic, index) => (
                    <p key={`${diagnostic.code}-${index}`} className="mt-2 leading-5">
                      <span className="font-semibold">{diagnostic.code}:</span> {diagnostic.message}
                    </p>
                  ))}
                </div>

                {result.regeneration?.passHistory?.length ? (
                  <div className="rounded-md border border-[#1e3a52] bg-[#0D1B2A] p-3 text-xs text-slate-300">
                    <p className="font-semibold text-white">Regeneration changes</p>
                    {result.regeneration.passHistory.flatMap((pass) => pass.changes).slice(0, 5).map((change) => (
                      <p key={change} className="mt-1 leading-5">{change}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-md border border-[#1e3a52] bg-[#0D1B2A] p-3 text-sm text-slate-500">
                Run generation to preview the draft summary and diagnostics.
              </div>
            )}

            {error && (
              <p className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="border-[#1e3a52] bg-transparent text-slate-300 hover:bg-white/5 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onGenerate}
            disabled={busy || (!form.topic.trim() && !file)}
            className="bg-teal-500 font-semibold text-[#07111f] hover:bg-teal-400"
          >
            {busy && phase !== "creating" ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-4 w-4" />
            )}
            {result ? "Regenerate" : "Generate"}
          </Button>
          <Button
            type="button"
            onClick={onCreateProject}
            disabled={busy || !result}
            className="bg-[#C9A84C] font-semibold text-[#0D1B2A] hover:bg-[#e0b85a]"
          >
            {phase === "creating" ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-1.5 h-4 w-4" />
            )}
            Edit Before Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProfessionalEbookDialog({
  open,
  form,
  job,
  error,
  busy,
  onOpenChange,
  onFormChange,
  onCreateJob,
  onContinue,
  onFinalize,
}: {
  open: boolean
  form: ProfessionalEbookForm
  job: ProfessionalEbookJob | null
  error: string | null
  busy: boolean
  onOpenChange: (open: boolean) => void
  onFormChange: (form: ProfessionalEbookForm) => void
  onCreateJob: () => Promise<void>
  onContinue: () => Promise<void>
  onFinalize: () => Promise<void>
}) {
  const plan = job?.settings
  const progress = ebookJobProgress({
    status: job?.status ?? "idle",
    currentChapterIndex: job?.current_chapter_index ?? 0,
    plan,
  })
  const diagnostics = Array.isArray(job?.diagnostics) ? job.diagnostics as AutopilotDiagnostic[] : []
  const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length

  function update<K extends keyof ProfessionalEbookForm>(key: K, value: ProfessionalEbookForm[K]) {
    onFormChange({ ...form, [key]: value })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-[#1e3a52] bg-[#0a1929] text-white sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Sparkles className="h-4 w-4 text-[#C9A84C]" />
            Professional Ebook Agent
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Create a resumable chapter-by-chapter ebook job for deeper books without request timeouts.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 rounded-lg border border-[#1e3a52] bg-[#07111f] p-4">
            <WizardField label="One prompt">
              <textarea
                value={form.topic}
                onChange={(event) => update("topic", event.target.value)}
                placeholder="Write a 10 chapter professional ebook about the Council of Nicaea for students, at least 50 pages."
                className="min-h-28 w-full rounded-md border border-[#1e3a52] bg-[#0D1B2A] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-teal-300/60"
              />
            </WizardField>

            <div className="grid gap-3 sm:grid-cols-2">
              <WizardField label="Audience">
                <Input value={form.audience} onChange={(event) => update("audience", event.target.value)} className="bg-[#0D1B2A] border-[#1e3a52] text-white" />
              </WizardField>
              <WizardField label="Tone">
                <Input value={form.tone} onChange={(event) => update("tone", event.target.value)} className="bg-[#0D1B2A] border-[#1e3a52] text-white" />
              </WizardField>
              <WizardField label="Chapters">
                <Input value={form.desiredChapterCount} onChange={(event) => update("desiredChapterCount", event.target.value)} placeholder="10" className="bg-[#0D1B2A] border-[#1e3a52] text-white" />
              </WizardField>
              <WizardField label="Total pages">
                <Input value={form.desiredTotalPages} onChange={(event) => update("desiredTotalPages", event.target.value)} placeholder="50" className="bg-[#0D1B2A] border-[#1e3a52] text-white" />
              </WizardField>
              <WizardField label="Min pages/chapter">
                <Input value={form.minPagesPerChapter} onChange={(event) => update("minPagesPerChapter", event.target.value)} placeholder="2" className="bg-[#0D1B2A] border-[#1e3a52] text-white" />
              </WizardField>
              <WizardField label="Words/page estimate">
                <Input value={form.wordsPerPage} onChange={(event) => update("wordsPerPage", event.target.value)} placeholder="400" className="bg-[#0D1B2A] border-[#1e3a52] text-white" />
              </WizardField>
              <WizardField label="Preset">
                <select value={form.ebookPreset} onChange={(event) => update("ebookPreset", event.target.value)} className="h-9 w-full rounded-md border border-[#1e3a52] bg-[#0D1B2A] px-3 text-sm text-white outline-none">
                  <option value="luxury-lead-magnet">Luxury Lead Magnet</option>
                  <option value="consultant-guide">Consultant Guide</option>
                  <option value="cinematic-ebook">Cinematic Ebook</option>
                  <option value="educational-handbook">Educational Handbook</option>
                  <option value="workbook">Workbook</option>
                </select>
              </WizardField>
              <WizardField label="Theme">
                <select value={form.theme} onChange={(event) => update("theme", event.target.value as ProfessionalEbookForm["theme"])} className="h-9 w-full rounded-md border border-[#1e3a52] bg-[#0D1B2A] px-3 text-sm text-white outline-none">
                  <option value="luxury-black-gold">Luxury Black Gold</option>
                  <option value="dark-cinematic">Dark Cinematic</option>
                  <option value="clean-minimal">Clean Minimal</option>
                </select>
              </WizardField>
              <WizardField label="Provider">
                <select value={form.providerId} onChange={(event) => update("providerId", event.target.value)} className="h-9 w-full rounded-md border border-[#1e3a52] bg-[#0D1B2A] px-3 text-sm text-white outline-none">
                  <option value="">Use Settings default</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="mistral">Mistral</option>
                  <option value="custom">Other / Custom</option>
                </select>
              </WizardField>
              <WizardField label="Model">
                <Input value={form.model} onChange={(event) => update("model", event.target.value)} placeholder="Use provider default" className="bg-[#0D1B2A] border-[#1e3a52] text-white" />
              </WizardField>
            </div>

            <WizardField label="Manual chapter plan">
              <textarea
                value={form.chapterDefinitions}
                onChange={(event) => update("chapterDefinitions", event.target.value)}
                placeholder={"Chapter 1: Historical background\nChapter 2: The theological dispute\nChapter 3: Arius and Alexander"}
                className="min-h-24 w-full rounded-md border border-[#1e3a52] bg-[#0D1B2A] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600"
              />
            </WizardField>

            <div className="rounded-md border border-[#1e3a52] bg-[#0D1B2A] p-3">
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={form.includeImages} onChange={(event) => update("includeImages", event.target.checked)} />
                Include AI image planning placeholders
              </label>
              {form.includeImages && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <WizardField label="Image frequency">
                    <select value={form.imageFrequency} onChange={(event) => update("imageFrequency", event.target.value as ProfessionalEbookForm["imageFrequency"])} className="h-9 w-full rounded-md border border-[#1e3a52] bg-[#07111f] px-3 text-sm text-white outline-none">
                      <option value="cover">Cover only</option>
                      <option value="per_chapter">One per chapter</option>
                      <option value="every_x_pages">Every X pages</option>
                      <option value="custom">Custom</option>
                    </select>
                  </WizardField>
                  <WizardField label="Every pages">
                    <Input value={form.imageEveryPages} onChange={(event) => update("imageEveryPages", event.target.value)} placeholder="5" className="bg-[#07111f] border-[#1e3a52] text-white" />
                  </WizardField>
                  <WizardField label="Style prompt">
                    <Input value={form.imageStylePrompt} onChange={(event) => update("imageStylePrompt", event.target.value)} placeholder="Editorial, premium, historically accurate" className="bg-[#07111f] border-[#1e3a52] text-white" />
                  </WizardField>
                  <WizardField label="Image provider preference">
                    <Input value={form.imageProviderPreference} onChange={(event) => update("imageProviderPreference", event.target.value)} placeholder="future image provider" className="bg-[#07111f] border-[#1e3a52] text-white" />
                  </WizardField>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-[#1e3a52] bg-[#07111f] p-4">
            <div className="rounded-md border border-[#1e3a52] bg-[#0D1B2A] p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-white">{progress.label}</span>
                <span className="text-slate-400">{progress.percent}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#07111f]">
                <div className="h-full rounded-full bg-teal-400 transition-all" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>

            {plan ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <SummaryTile label="Pages" value={plan.totalPages} />
                <SummaryTile label="Words" value={plan.targetWords} />
                <SummaryTile label="Chapters" value={plan.chapterCount} />
                <SummaryTile label="Warnings" value={(plan.warnings?.length ?? 0) + warningCount} />
              </div>
            ) : (
              <div className="rounded-md border border-[#1e3a52] bg-[#0D1B2A] p-3 text-sm text-slate-500">
                Create a job to see estimates, live progress, diagnostics, and finalize controls.
              </div>
            )}

            {plan?.warnings?.length ? (
              <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100">
                {plan.warnings.map((warning) => <p key={warning} className="leading-5">{warning}</p>)}
              </div>
            ) : null}

            {job?.error ? (
              <p className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-300">{job.error}</p>
            ) : null}
            {error ? (
              <p className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-300">{error}</p>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy} className="border-[#1e3a52] bg-transparent text-slate-300 hover:bg-white/5 hover:text-white">
            Close
          </Button>
          <Button type="button" onClick={onCreateJob} disabled={busy || Boolean(job) || !form.topic.trim()} className="bg-teal-500 font-semibold text-[#07111f] hover:bg-teal-400">
            {busy && !job ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            Create Job
          </Button>
          <Button type="button" onClick={onContinue} disabled={busy || !job || job.status === "ready" || job.status === "finalized"} className="bg-[#C9A84C] font-semibold text-[#0D1B2A] hover:bg-[#e0b85a]">
            {busy && job ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-1.5 h-4 w-4" />}
            {job?.status === "failed" ? "Retry Step" : "Continue"}
          </Button>
          <Button type="button" onClick={onFinalize} disabled={busy || job?.status !== "ready"} className="bg-emerald-500 font-semibold text-[#07111f] hover:bg-emerald-400">
            Finalize & Open
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function WizardField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-slate-300">
      {label}
      {children}
    </label>
  )
}

function SummaryTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-[#1e3a52] px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProjectList({
  initialProjects,
}: {
  initialProjects: ProjectSummary[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [projects, setProjects] = useState<ProjectSummary[]>(initialProjects)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [form, setForm] = useState<NewProjectForm>(EMPTY_FORM)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showAutopilotDialog, setShowAutopilotDialog] = useState(false)
  const [autopilotForm, setAutopilotForm] = useState<CompleteEbookForm>(EMPTY_COMPLETE_EBOOK_FORM)
  const [autopilotFile, setAutopilotFile] = useState<File | null>(null)
  const [autopilotPhase, setAutopilotPhase] = useState<AutopilotPhase>("idle")
  const [autopilotError, setAutopilotError] = useState<string | null>(null)
  const [autopilotResult, setAutopilotResult] = useState<AutopilotResponse | null>(null)
  const [showProfessionalDialog, setShowProfessionalDialog] = useState(false)
  const [professionalForm, setProfessionalForm] = useState<ProfessionalEbookForm>(EMPTY_PROFESSIONAL_EBOOK_FORM)
  const [professionalJob, setProfessionalJob] = useState<ProfessionalEbookJob | null>(null)
  const [professionalBusy, setProfessionalBusy] = useState(false)
  const [professionalError, setProfessionalError] = useState<string | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (!showProfessionalDialog || !professionalJob?.id) return
    if (professionalJob.status === "finalized") return

    const timer = window.setInterval(() => {
      void refreshProfessionalJob(professionalJob.id, false)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [professionalJob?.id, professionalJob?.status, showProfessionalDialog])

  // ── Create project ──────────────────────────────────────────────────────────

  function openNewDialog() {
    setForm(EMPTY_FORM)
    setCreateError(null)
    setShowNewDialog(true)
  }

  async function handleCreate() {
    if (!form.title.trim()) {
      setCreateError("Project title is required.")
      return
    }

    setIsCreating(true)
    setCreateError(null)

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          author: form.author.trim() || undefined,
          theme: form.theme,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setCreateError(json.error ?? "Failed to create project.")
        setIsCreating(false)
        return
      }

      setShowNewDialog(false)
      // Navigate to the editor — no need to update the list since we're leaving.
      router.push(`/editor/${json.project.id}`)
    } catch {
      setCreateError("Network error. Please try again.")
      setIsCreating(false)
    }
  }

  function openAutopilotDialog() {
    setAutopilotForm(EMPTY_COMPLETE_EBOOK_FORM)
    setAutopilotFile(null)
    setAutopilotPhase("idle")
    setAutopilotError(null)
    setAutopilotResult(null)
    setShowAutopilotDialog(true)
  }

  function openProfessionalDialog() {
    setProfessionalForm(EMPTY_PROFESSIONAL_EBOOK_FORM)
    setProfessionalJob(null)
    setProfessionalBusy(false)
    setProfessionalError(null)
    setShowProfessionalDialog(true)
  }

  async function refreshProfessionalJob(id: string, showErrors = true) {
    try {
      const res = await fetch(`/api/ebook-jobs/${id}`)
      const json = (await res.json().catch(() => ({}))) as { job?: ProfessionalEbookJob; error?: string }
      if (!res.ok || !json.job) {
        if (showErrors) setProfessionalError(json.error ?? `Job refresh failed (HTTP ${res.status})`)
        return
      }
      setProfessionalJob(json.job)
    } catch {
      if (showErrors) setProfessionalError("Could not refresh generation job.")
    }
  }

  async function handleCreateProfessionalJob() {
    if (!professionalForm.topic.trim()) {
      setProfessionalError("Add a prompt before creating a professional ebook job.")
      return
    }

    setProfessionalBusy(true)
    setProfessionalError(null)
    try {
      const res = await fetch("/api/ebook-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(professionalForm),
      })
      const json = (await res.json().catch(() => ({}))) as { job?: ProfessionalEbookJob; error?: string }
      if (!res.ok || !json.job) {
        throw new Error(json.error ?? `Job creation failed (HTTP ${res.status})`)
      }
      setProfessionalJob(json.job)
    } catch (err) {
      setProfessionalError(err instanceof Error ? err.message : "Could not create professional ebook job.")
    } finally {
      setProfessionalBusy(false)
    }
  }

  async function handleContinueProfessionalJob() {
    if (!professionalJob) return
    setProfessionalBusy(true)
    setProfessionalError(null)
    try {
      const res = await fetch(`/api/ebook-jobs/${professionalJob.id}/step`, { method: "POST" })
      const json = (await res.json().catch(() => ({}))) as { job?: ProfessionalEbookJob; error?: string }
      if (!res.ok || !json.job) {
        throw new Error(json.error ?? `Generation step failed (HTTP ${res.status})`)
      }
      setProfessionalJob(json.job)
    } catch (err) {
      setProfessionalError(err instanceof Error ? err.message : "Could not continue professional ebook job.")
    } finally {
      setProfessionalBusy(false)
    }
  }

  async function handleFinalizeProfessionalJob() {
    if (!professionalJob) return
    setProfessionalBusy(true)
    setProfessionalError(null)
    try {
      const res = await fetch(`/api/ebook-jobs/${professionalJob.id}/finalize`, { method: "POST" })
      const json = (await res.json().catch(() => ({}))) as { project?: { id?: string }; error?: string }
      if (!res.ok || !json.project?.id) {
        throw new Error(json.error ?? `Finalize failed (HTTP ${res.status})`)
      }
      setShowProfessionalDialog(false)
      router.push(`/editor/${json.project.id}`)
    } catch (err) {
      setProfessionalError(err instanceof Error ? err.message : "Could not finalize professional ebook job.")
    } finally {
      setProfessionalBusy(false)
    }
  }

  async function handleGenerateCompleteEbook() {
    if (!autopilotForm.topic.trim() && !autopilotFile) {
      setAutopilotError("Add a topic prompt or upload a .txt/.md source file.")
      return
    }

    setAutopilotError(null)
    setAutopilotResult(null)
    setAutopilotPhase("intake")

    try {
      let sourceText = ""
      let sourceKind: "plain_text" | "markdown" = "plain_text"

      if (autopilotFile) {
        const name = autopilotFile.name.toLowerCase()
        if (!name.endsWith(".txt") && !name.endsWith(".md") && !name.endsWith(".markdown")) {
          setAutopilotError("Only .txt and .md source files are supported.")
          setAutopilotPhase("error")
          return
        }
        if (autopilotFile.size > MAX_AUTOPILOT_SOURCE_BYTES) {
          setAutopilotError("Source file is too large. Use a file under 1.5 MB.")
          setAutopilotPhase("error")
          return
        }
        sourceKind = name.endsWith(".md") || name.endsWith(".markdown") ? "markdown" : "plain_text"
        sourceText = await autopilotFile.text()
      }

      setAutopilotPhase("outline")
      await wait(150)
      setAutopilotPhase("chapters")

      const res = await fetch("/api/create-complete-ebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...autopilotForm,
          sourceText,
          sourceKind,
        }),
      })

      setAutopilotPhase("diagnostics")
      const json = (await res.json().catch(() => ({}))) as Partial<AutopilotResponse> & { error?: string }
      if (!res.ok || !json.draft || !json.summary) {
        throw new Error(json.error ?? `Complete ebook generation failed (HTTP ${res.status})`)
      }

      setAutopilotResult(json as AutopilotResponse)
      setAutopilotPhase("ready")
    } catch (err) {
      setAutopilotError(err instanceof Error ? err.message : "Complete ebook generation failed.")
      setAutopilotPhase("error")
    }
  }

  async function handleCreateAutopilotProject() {
    if (!autopilotResult) return
    setAutopilotPhase("creating")
    setAutopilotError(null)

    try {
      const projectTheme =
        autopilotForm.theme === "clean-minimal" ? "clean-minimal" : "dark-cinematic"
      const createRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: autopilotResult.draft.title,
          author: autopilotResult.draft.author || undefined,
          theme: projectTheme,
        }),
      })
      const createJson = (await createRes.json().catch(() => ({}))) as {
        error?: string
        project?: { id?: string }
      }
      if (!createRes.ok || !createJson.project?.id) {
        throw new Error(createJson.error ?? `Project creation failed (HTTP ${createRes.status})`)
      }

      const projectId = createJson.project.id
      const patchRes = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtitle: autopilotResult.draft.subtitle,
          author: autopilotResult.draft.author || null,
          content: {
            projectType: "ebook",
            chapters: autopilotResult.draft.chapters,
            autopilot: {
              generatedAt: new Date().toISOString(),
              summary: autopilotResult.summary,
              diagnostics: autopilotResult.diagnostics,
              regeneration: autopilotResult.regeneration ?? null,
            },
          },
        }),
      })
      const patchJson = (await patchRes.json().catch(() => ({}))) as { error?: string }
      if (!patchRes.ok) {
        throw new Error(patchJson.error ?? `Project update failed (HTTP ${patchRes.status})`)
      }

      setShowAutopilotDialog(false)
      router.push(`/editor/${projectId}`)
    } catch (err) {
      setAutopilotError(err instanceof Error ? err.message : "Could not create editor draft.")
      setAutopilotPhase("error")
    }
  }

  async function handleImportPdf() {
    if (!importFile) {
      setImportError("Choose a PDF file to import.")
      return
    }

    if (importFile.type !== "application/pdf" && !importFile.name.toLowerCase().endsWith(".pdf")) {
      setImportError("Only PDF files are supported.")
      return
    }

    if (importFile.size <= 0 || importFile.size > MAX_IMPORT_PDF_BYTES) {
      setImportError("PDF is too large for browser upload/storage. Maximum size is 50 MB.")
      return
    }

    setIsImporting(true)
    setImportError(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setImportError("You are not authenticated. Sign in again, then import the PDF.")
        setIsImporting(false)
        return
      }

      const uploadUrlRes = await fetch("/api/import-pdf/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: importFile.name,
          size: importFile.size,
          contentType: importFile.type || "application/pdf",
        }),
      })

      const uploadUrlJson = await uploadUrlRes.json().catch(() => ({}))
      if (!uploadUrlRes.ok) {
        setImportError(formatImportError(uploadUrlJson))
        setIsImporting(false)
        return
      }

      const uploadInfo = uploadUrlJson as {
        bucket?: string
        storagePath?: string
        token?: string
        signedUrl?: string
      }

      if (!uploadInfo.bucket || !uploadInfo.storagePath || !uploadInfo.token) {
        setImportError("Supabase upload failed: direct upload URL response was incomplete.")
        setIsImporting(false)
        return
      }

      const { error: uploadError } = await supabase.storage
        .from(uploadInfo.bucket)
        .uploadToSignedUrl(uploadInfo.storagePath, uploadInfo.token, importFile, {
          contentType: importFile.type || "application/pdf",
          upsert: false,
        })

      if (uploadError) {
        setImportError(`Supabase upload failed: ${uploadError.message}`)
        setIsImporting(false)
        return
      }

      const res = await fetch("/api/import-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: importFile.name,
          storagePath: uploadInfo.storagePath,
          size: importFile.size,
          contentType: importFile.type || "application/pdf",
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setImportError(formatImportError(json))
        setIsImporting(false)
        return
      }

      setShowImportDialog(false)
      router.push(`/editor/${(json as { project: { id: string } }).project.id}`)
    } catch {
      setImportError("Network error. Please try again.")
      setIsImporting(false)
    }
  }

  // ── Delete project ──────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTargetId) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      const res = await fetch(`/api/projects/${deleteTargetId}`, {
        method: "DELETE",
      })

      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}))
        setDeleteError((json as { error?: string }).error ?? "Failed to delete project.")
        setIsDeleting(false)
        return
      }

      // Optimistically remove from list.
      setProjects((prev) => prev.filter((p) => p.id !== deleteTargetId))
      setDeleteTargetId(null)

      // Revalidate the page in the background so the server cache is fresh.
      startTransition(() => { router.refresh() })
    } catch {
      setDeleteError("Network error. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  const deleteTarget = projects.find((p) => p.id === deleteTargetId)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              My Projects
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {projects.length === 0
                ? "No projects yet"
                : `${projects.length} project${projects.length === 1 ? "" : "s"}`}
            </p>
          </div>

          {projects.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                onClick={openProfessionalDialog}
                className="bg-[#C9A84C] hover:bg-[#e0b85a] text-[#0D1B2A] font-semibold"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                Professional Agent
              </Button>
              <Button
                onClick={openAutopilotDialog}
                className="bg-teal-500 font-semibold text-[#07111f] hover:bg-teal-400"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                Create Complete Ebook
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setImportFile(null)
                  setImportError(null)
                  setShowImportDialog(true)
                }}
                className="border-[#1e3a52] bg-transparent text-slate-300 hover:bg-white/5 hover:text-white"
              >
                <Upload className="w-4 h-4 mr-1.5" />
                Import PDF
              </Button>
              <Button
                onClick={openNewDialog}
                className="bg-[#C9A84C] hover:bg-[#e0b85a] text-[#0D1B2A] font-semibold"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                New Project
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        {projects.length === 0 ? (
          <EmptyState
            onNew={openNewDialog}
            onAutopilot={openAutopilotDialog}
            onProfessional={openProfessionalDialog}
            onImport={() => {
              setImportFile(null)
              setImportError(null)
              setShowImportDialog(true)
            }}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDeleteClick={(id) => {
                  setDeleteError(null)
                  setDeleteTargetId(id)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── New Project dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={showNewDialog}
        onOpenChange={(open) => {
          if (!isCreating) setShowNewDialog(open)
        }}
      >
        <DialogContent className="bg-[#0a1929] border-[#1e3a52] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">New Project</DialogTitle>
            <DialogDescription className="text-slate-400">
              Give your ebook a title, choose a template, and start writing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="np-title" className="text-slate-300 text-sm">
                Project title <span className="text-red-400">*</span>
              </Label>
              <Input
                id="np-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate() }}
                placeholder="e.g. 100 ChatGPT Prompts for Writers"
                maxLength={120}
                autoFocus
                className="bg-[#0D1B2A] border-[#1e3a52] text-white placeholder:text-slate-600 focus-visible:ring-[#C9A84C] focus-visible:border-[#C9A84C]"
              />
            </div>

            {/* Author */}
            <div className="space-y-1.5">
              <Label htmlFor="np-author" className="text-slate-300 text-sm">
                Author name{" "}
                <span className="text-slate-600 font-normal">(optional)</span>
              </Label>
              <Input
                id="np-author"
                value={form.author}
                onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                placeholder="e.g. Jane Smith"
                maxLength={100}
                className="bg-[#0D1B2A] border-[#1e3a52] text-white placeholder:text-slate-600 focus-visible:ring-[#C9A84C] focus-visible:border-[#C9A84C]"
              />
            </div>

            {/* Template / theme */}
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Template</Label>
              <div className="flex gap-2">
                {(["dark-cinematic", "clean-minimal"] as const).map((t) => (
                  <ThemeCard
                    key={t}
                    value={t}
                    selected={form.theme === t}
                    onSelect={() => setForm((f) => ({ ...f, theme: t }))}
                  />
                ))}
              </div>
            </div>

            {createError && (
              <p className="text-sm text-red-400 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2">
                {createError}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowNewDialog(false)}
              disabled={isCreating}
              className="text-slate-400 hover:text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating || !form.title.trim()}
              className="bg-[#C9A84C] hover:bg-[#e0b85a] text-[#0D1B2A] font-semibold min-w-[100px]"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Create project"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CompleteEbookDialog
        open={showAutopilotDialog}
        form={autopilotForm}
        file={autopilotFile}
        phase={autopilotPhase}
        error={autopilotError}
        result={autopilotResult}
        onOpenChange={(open) => {
          if (autopilotPhase !== "intake" && autopilotPhase !== "outline" && autopilotPhase !== "chapters" && autopilotPhase !== "creating") {
            setShowAutopilotDialog(open)
          }
        }}
        onFormChange={setAutopilotForm}
        onFileChange={setAutopilotFile}
        onGenerate={handleGenerateCompleteEbook}
        onCreateProject={handleCreateAutopilotProject}
      />

      <ProfessionalEbookDialog
        open={showProfessionalDialog}
        form={professionalForm}
        job={professionalJob}
        error={professionalError}
        busy={professionalBusy}
        onOpenChange={(open) => {
          if (!professionalBusy) setShowProfessionalDialog(open)
        }}
        onFormChange={setProfessionalForm}
        onCreateJob={handleCreateProfessionalJob}
        onContinue={handleContinueProfessionalJob}
        onFinalize={handleFinalizeProfessionalJob}
      />

      {/* ─── Import PDF dialog ─────────────────────────────────────────────── */}
      <Dialog
        open={showImportDialog}
        onOpenChange={(open) => {
          if (!isImporting) setShowImportDialog(open)
        }}
      >
        <DialogContent className="bg-[#0a1929] border-[#1e3a52] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Import PDF</DialogTitle>
            <DialogDescription className="text-slate-400">
              Upload a finished PDF ebook. Layout correction tools will open from the imported project.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-dashed border-[#1e3a52] bg-[#0D1B2A] p-4">
              <Label htmlFor="pdf-import" className="mb-2 block text-sm text-slate-300">
                PDF file
              </Label>
              <Input
                id="pdf-import"
                type="file"
                accept="application/pdf,.pdf"
                disabled={isImporting}
                onChange={(e) => {
                  setImportError(null)
                  setImportFile(e.target.files?.[0] ?? null)
                }}
                className="bg-[#0a1929] border-[#1e3a52] text-slate-300 file:text-slate-200"
              />
              {importFile && (
                <p className="mt-2 text-xs text-slate-500 truncate">
                  {importFile.name}
                </p>
              )}
            </div>

            {importError && (
              <p className="text-sm text-red-400 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2">
                {importError}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowImportDialog(false)}
              disabled={isImporting}
              className="text-slate-400 hover:text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportPdf}
              disabled={isImporting || !importFile}
              className="bg-[#C9A84C] hover:bg-[#e0b85a] text-[#0D1B2A] font-semibold min-w-[110px]"
            >
              {isImporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Import PDF"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ──────────────────────────────────────── */}
      <Dialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!isDeleting && !open) setDeleteTargetId(null)
        }}
      >
        <DialogContent className="bg-[#0a1929] border-[#1e3a52] text-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Delete project?</DialogTitle>
            <DialogDescription className="text-slate-400">
              <span className="font-medium text-white">
                &ldquo;{deleteTarget?.title}&rdquo;
              </span>{" "}
              and all its chapters will be permanently deleted. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <p className="text-sm text-red-400 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 mt-1">
              {deleteError}
            </p>
          )}

          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteTargetId(null)}
              disabled={isDeleting}
              className="text-slate-400 hover:text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold min-w-[90px]"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Background refresh indicator */}
      {isPending && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-full bg-[#0a1929] border border-[#1e3a52] px-3 py-2 text-xs text-slate-400 shadow-lg">
          <Loader2 className="w-3 h-3 animate-spin" />
          Refreshing…
        </div>
      )}
    </>
  )
}
