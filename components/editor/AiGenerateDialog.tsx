"use client"

import { useState, useRef, useEffect } from "react"
import { Sparkles, Loader2, AlertCircle, Settings } from "lucide-react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ─── Props ────────────────────────────────────────────────────────────────────

interface AiGenerateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Current chapter content as plain text — sent as context to the model. */
  chapterContext: string
  /** Called with the generated text when the API succeeds. */
  onGenerated: (text: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AiGenerateDialog({
  open,
  onOpenChange,
  chapterContext,
  onGenerated,
}: AiGenerateDialogProps) {
  const [prompt,   setPrompt]   = useState("")
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [noKey,    setNoKey]    = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus the textarea when the dialog opens.
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 50)
      setError(null)
      setNoKey(false)
    }
  }, [open])

  async function handleGenerate() {
    if (!prompt.trim()) return
    setLoading(true)
    setError(null)
    setNoKey(false)

    try {
      const res = await fetch("/api/ai-generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          prompt:  prompt.trim(),
          // Only send context if the chapter already has content.
          context: chapterContext.trim() || undefined,
        }),
      })

      const json = await res.json() as Record<string, unknown>

      if (!res.ok) {
        if (res.status === 503 || json.code === "NO_API_KEY") {
          setNoKey(true)
          setError(null)
        } else {
          setError((json.error as string | undefined) ?? `Error ${res.status}`)
        }
        return
      }

      const text = json.text as string | undefined
      if (!text) { setError("AI returned an empty response."); return }

      // Close dialog and hand the text off to the caller.
      onOpenChange(false)
      setPrompt("")
      onGenerated(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      handleGenerate()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!loading) onOpenChange(o) }}>
      <DialogContent className="bg-[#0a1929] border-[#1e3a52] text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Sparkles className="h-4 w-4 text-violet-400" />
            Generate with AI
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Describe what you want to write. The result will be reviewed before
            being added to your chapter.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
            placeholder={
              "e.g. Write 5 creative writing prompts about building authentic characters,\n" +
              "each with a pro tip and formatted as a prompt card."
            }
            className={cn(
              "w-full rounded-lg border bg-[#0D1B2A] px-4 py-3",
              "text-sm text-slate-200 placeholder:text-slate-700 leading-relaxed",
              "focus:outline-none resize-none transition-colors",
              error
                ? "border-red-500/40 focus:border-red-500/60"
                : "border-[#1e3a52] focus:border-violet-500/50"
            )}
          />

          {/* No API key banner */}
          {noKey && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 space-y-2">
              <p className="text-xs text-amber-400 font-medium">
                No AI API key configured.
              </p>
              <p className="text-xs text-amber-400/70">
                Add your Anthropic or OpenAI key in Settings to use AI generation.
              </p>
              <Link
                href="/settings"
                className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium"
                onClick={() => onOpenChange(false)}
              >
                <Settings className="h-3.5 w-3.5" />
                Open Settings
              </Link>
            </div>
          )}

          {/* Generic error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Context hint */}
          {chapterContext.trim() && (
            <p className="text-[11px] text-slate-700">
              The AI will receive the current chapter content as context.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <p className="mr-auto text-[11px] text-slate-700 self-center hidden sm:block">
            ⌘/Ctrl+Enter to generate
          </p>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-slate-400 hover:text-white hover:bg-white/5"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className={cn(
              "font-semibold min-w-[110px]",
              prompt.trim() && !loading
                ? "bg-violet-600 hover:bg-violet-500 text-white"
                : "bg-[#1e3a52] text-slate-500"
            )}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Generating…</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Generate</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
