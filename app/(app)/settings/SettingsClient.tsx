"use client"

import { useState } from "react"
import Link from "next/link"
import {
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface KeyState {
  anthropic_configured: boolean
  openai_configured:    boolean
  anthropic_masked:     string | null
  openai_masked:        string | null
}

interface SettingsClientProps {
  userEmail:    string
  initialState: KeyState
}

// ─── Key row sub-component ────────────────────────────────────────────────────

interface KeyRowProps {
  provider:     "anthropic" | "openai"
  label:        string
  hint:         string
  docsUrl:      string
  configured:   boolean
  masked:       string | null
  onSave:       (key: string) => Promise<void>
  onClear:      () => Promise<void>
}

function KeyRow({
  provider,
  label,
  hint,
  docsUrl,
  configured,
  masked,
  onSave,
  onClear,
}: KeyRowProps) {
  const [value,   setValue]   = useState("")
  const [show,    setShow]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [mode,    setMode]    = useState<"view" | "edit">("view")

  async function handleSave() {
    if (!value.trim()) return
    setLoading(true)
    setError(null)
    try {
      await onSave(value.trim())
      setValue("")
      setMode("view")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setLoading(false)
    }
  }

  async function handleClear() {
    setLoading(true)
    setError(null)
    try {
      await onClear()
      setMode("view")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clear failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#1e3a52] bg-[#0a1929] p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#C9A84C]" />
            <span className="font-semibold text-white text-sm">{label}</span>
            {configured ? (
              <span className="flex items-center gap-1 text-emerald-400 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5" /> Configured
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-600 text-xs">
                <XCircle className="h-3.5 w-3.5" /> Not set
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">{hint}</p>
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[#C9A84C] hover:underline"
          >
            Get API key <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {configured && mode === "view" && (
            <>
              <span className="font-mono text-xs text-slate-500 hidden sm:block">
                {masked}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMode("edit")}
                className="border-[#1e3a52] text-slate-400 hover:text-white text-xs h-7"
              >
                Replace
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={loading}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-7"
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Clear"}
              </Button>
            </>
          )}
          {!configured && mode === "view" && (
            <Button
              size="sm"
              onClick={() => setMode("edit")}
              className="bg-[#C9A84C] hover:bg-[#e0b85a] text-[#0D1B2A] font-semibold text-xs h-7"
            >
              Add key
            </Button>
          )}
        </div>
      </div>

      {/* Edit mode */}
      {mode === "edit" && (
        <div className="space-y-3 pt-1 border-t border-[#1e3a52]">
          <div className="space-y-1.5">
            <Label htmlFor={`${provider}-key`} className="text-slate-300 text-xs">
              Paste your {label}
            </Label>
            <div className="relative">
              <Input
                id={`${provider}-key`}
                type={show ? "text" : "password"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave() }}
                placeholder={provider === "anthropic" ? "sk-ant-..." : "sk-..."}
                autoComplete="off"
                className={cn(
                  "pr-9 font-mono text-sm",
                  "bg-[#0D1B2A] border-[#1e3a52] text-white placeholder:text-slate-700",
                  "focus-visible:ring-[#C9A84C] focus-visible:border-[#C9A84C]"
                )}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300"
              >
                {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 border border-red-500/20 bg-red-500/5 rounded px-3 py-1.5">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={loading || !value.trim()}
              className="bg-[#C9A84C] hover:bg-[#e0b85a] text-[#0D1B2A] font-semibold text-xs h-7 min-w-[80px]"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save key"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setMode("view"); setValue(""); setError(null) }}
              disabled={loading}
              className="text-slate-500 hover:text-white text-xs h-7"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main settings client ─────────────────────────────────────────────────────

export default function SettingsClient({ userEmail, initialState }: SettingsClientProps) {
  const [keyState, setKeyState] = useState<KeyState>(initialState)

  async function saveKey(provider: "anthropic" | "openai", key: string) {
    const res = await fetch("/api/settings", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(
        provider === "anthropic" ? { anthropic_key: key } : { openai_key: key }
      ),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? "Failed to save key")
    setKeyState(json as KeyState)
  }

  async function clearKey(provider: "anthropic" | "openai") {
    const res = await fetch("/api/settings", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(
        provider === "anthropic" ? { anthropic_key: "" } : { openai_key: "" }
      ),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? "Failed to clear key")
    setKeyState(json as KeyState)
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your AI API keys and account preferences.
        </p>
      </div>

      {/* AI API Keys */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white">AI API Keys</h2>
          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
            Keys are stored securely and never exposed to the browser after saving.
            Anthropic Claude is used as the primary provider; OpenAI is the fallback.
          </p>
        </div>

        <KeyRow
          provider="anthropic"
          label="Anthropic API Key"
          hint="Used for Claude — the primary AI provider."
          docsUrl="https://console.anthropic.com/settings/keys"
          configured={keyState.anthropic_configured}
          masked={keyState.anthropic_masked}
          onSave={(key) => saveKey("anthropic", key)}
          onClear={() => clearKey("anthropic")}
        />

        <KeyRow
          provider="openai"
          label="OpenAI API Key"
          hint="Used as fallback when no Anthropic key is set."
          docsUrl="https://platform.openai.com/api-keys"
          configured={keyState.openai_configured}
          masked={keyState.openai_masked}
          onSave={(key) => saveKey("openai", key)}
          onClear={() => clearKey("openai")}
        />

        {!keyState.anthropic_configured && !keyState.openai_configured && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-400">
            Add at least one API key to enable AI generation in the editor.
          </div>
        )}
      </section>

      <Separator className="bg-[#1e3a52]" />

      {/* Account */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Account</h2>
        <div className="rounded-xl border border-[#1e3a52] bg-[#0a1929] px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-white font-medium">{userEmail}</p>
            <p className="text-xs text-slate-500 mt-0.5">Signed in via Supabase Auth</p>
          </div>
          <Link
            href="/dashboard"
            className="text-xs text-slate-500 hover:text-white transition-colors"
          >
            Back to projects
          </Link>
        </div>
      </section>
    </div>
  )
}
