"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  BookOpen,
  Plus,
  Trash2,
  ArrowRight,
  Clock,
  User,
  Loader2,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProjectSummary = {
  id: string
  title: string
  author: string | null
  theme: string
  template: string
  updated_at: string
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
  return (
    <div className="group relative flex flex-col rounded-xl border border-[#1e3a52] bg-[#0a1929] hover:border-[#2a4d6e] transition-colors">
      {/* Theme badge */}
      <div className="px-5 pt-5 pb-0 flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C9A84C]/30 bg-[#C9A84C]/5 px-2.5 py-1 text-[11px] font-medium text-[#C9A84C]">
          <FileText className="w-3 h-3" />
          {THEME_LABEL[project.theme] ?? project.theme}
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

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-5 w-16 h-16 rounded-2xl bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center">
        <BookOpen className="w-8 h-8 text-[#C9A84C]" />
      </div>
      <h2 className="text-xl font-semibold text-white">No projects yet</h2>
      <p className="mt-2 text-sm text-slate-500 max-w-xs">
        Create your first ebook and start writing in minutes.
      </p>
      <Button
        onClick={onNew}
        className="mt-6 bg-[#C9A84C] hover:bg-[#e0b85a] text-[#0D1B2A] font-semibold"
      >
        <Plus className="w-4 h-4 mr-1.5" />
        Create first project
      </Button>
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

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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
            <Button
              onClick={openNewDialog}
              className="bg-[#C9A84C] hover:bg-[#e0b85a] text-[#0D1B2A] font-semibold"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Project
            </Button>
          )}
        </div>

        {/* Content */}
        {projects.length === 0 ? (
          <EmptyState onNew={openNewDialog} />
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
