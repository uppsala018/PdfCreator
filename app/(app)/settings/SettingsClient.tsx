"use client"

import { useState } from "react"
import Link from "next/link"
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AICompatibilityMode } from "@/lib/ai-runtime/provider-types"
import type { PublicAISettingsState } from "@/lib/ai-runtime/provider-settings"
import { cn } from "@/lib/utils"

type ProviderId = "openai" | "anthropic" | "openrouter" | "gemini" | "mistral" | "custom"

type KeyState = PublicAISettingsState

interface SettingsClientProps {
  userEmail: string
  initialState: KeyState
}

const PROVIDERS: Array<{ id: ProviderId; label: string; hint: string; modelHint: string }> = [
  { id: "openai", label: "OpenAI", hint: "OpenAI API or compatible OpenAI account key.", modelHint: "gpt-4o-mini" },
  { id: "anthropic", label: "Anthropic", hint: "Claude API key.", modelHint: "claude-haiku-4-5-20251001" },
  { id: "openrouter", label: "OpenRouter", hint: "OpenRouter key for routed models.", modelHint: "openai/gpt-4o-mini" },
  { id: "gemini", label: "Google Gemini", hint: "Gemini key via Google AI Studio.", modelHint: "gemini-2.0-flash" },
  { id: "mistral", label: "Mistral", hint: "Mistral API key.", modelHint: "mistral-small-latest" },
  { id: "custom", label: "Other / Custom", hint: "Self-hosted or custom AI endpoint.", modelHint: "model-name" },
]

function keyName(provider: ProviderId) {
  return `${provider === "custom" ? "custom_api" : provider}_key`
}

function modelName(provider: ProviderId) {
  return `${provider}_model`
}

export default function SettingsClient({ userEmail, initialState }: SettingsClientProps) {
  const [state, setState] = useState<KeyState>(initialState)
  const [savingProvider, setSavingProvider] = useState(false)

  async function patchSettings(patch: Record<string, string | null>) {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? "Failed to save settings")
    setState(json as KeyState)
  }

  async function setProvider(provider: string) {
    setSavingProvider(true)
    try {
      await patchSettings({ ai_provider: provider })
    } finally {
      setSavingProvider(false)
    }
  }

  const active = state.providerStatus

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage AI providers and account preferences.
        </p>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white">AI Provider</h2>
          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
            User keys are stored server-side. Env keys can be used as defaults without exposing them to the browser.
          </p>
        </div>

        <div className="rounded-xl border border-[#1e3a52] bg-[#0a1929] p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Preferred provider</Label>
              <Select value={state.ai_provider ?? active.activeProvider} onValueChange={setProvider}>
                <SelectTrigger className="bg-[#0D1B2A] border-[#1e3a52] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>{provider.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-[#1e3a52] bg-[#0D1B2A] px-4 py-3 text-xs text-slate-300">
              <div className="font-semibold text-white">{active.activeProviderName}</div>
              <div className="mt-1">Model: {active.activeModel}</div>
              <div>Key source: {active.keySource}</div>
              {savingProvider && <div className="mt-1 text-[#C9A84C]">Saving preference...</div>}
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {PROVIDERS.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              state={state}
              onPatch={patchSettings}
            />
          ))}
        </div>
      </section>

      <Separator className="bg-[#1e3a52]" />

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Account</h2>
        <div className="rounded-xl border border-[#1e3a52] bg-[#0a1929] px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-white font-medium">{userEmail}</p>
            <p className="text-xs text-slate-500 mt-0.5">Signed in via Supabase Auth</p>
          </div>
          <Link href="/dashboard" className="text-xs text-slate-500 hover:text-white transition-colors">
            Back to projects
          </Link>
        </div>
      </section>
    </div>
  )
}

function ProviderCard({
  provider,
  state,
  onPatch,
}: {
  provider: { id: ProviderId; label: string; hint: string; modelHint: string }
  state: KeyState
  onPatch: (patch: Record<string, string | null>) => Promise<void>
}) {
  const configured = Boolean(state[`${provider.id}_configured` as keyof KeyState])
  const masked = state[`${provider.id}_masked` as keyof KeyState] as string | null
  const initialModel = state[modelName(provider.id) as keyof KeyState] as string
  const [key, setKey] = useState("")
  const [model, setModel] = useState(initialModel)
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customName, setCustomName] = useState(state.custom_provider_name)
  const [baseUrl, setBaseUrl] = useState(state.custom_base_url)
  const [compatibility, setCompatibility] = useState<AICompatibilityMode>(state.custom_compatibility)

  async function save() {
    setLoading(true)
    setError(null)
    try {
      const patch: Record<string, string | null> = {
        ai_provider: provider.id,
        [modelName(provider.id)]: model,
      }
      if (key.trim()) patch[keyName(provider.id)] = key.trim()
      if (provider.id === "custom") {
        patch.custom_provider_name = customName
        patch.custom_base_url = baseUrl
        patch.custom_compatibility = compatibility
      }
      await onPatch(patch)
      setKey("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setLoading(false)
    }
  }

  async function clearKey() {
    setLoading(true)
    setError(null)
    try {
      await onPatch({ [keyName(provider.id)]: "" })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clear failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#1e3a52] bg-[#0a1929] p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#C9A84C]" />
            <span className="font-semibold text-white text-sm">{provider.label}</span>
            {configured ? (
              <span className="flex items-center gap-1 text-emerald-400 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5" /> User key
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-600 text-xs">
                <XCircle className="h-3.5 w-3.5" /> No user key
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">{provider.hint}</p>
        </div>
        {masked && <span className="font-mono text-xs text-slate-500 hidden sm:block">{masked}</span>}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {provider.id === "custom" && (
          <>
            <Field label="Provider display name" value={customName} onChange={setCustomName} placeholder="Local LLM" />
            <Field label="Base URL" value={baseUrl} onChange={setBaseUrl} placeholder="http://localhost:11434/v1" />
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">API compatibility mode</Label>
              <Select value={compatibility} onValueChange={(value) => setCompatibility(value as AICompatibilityMode)}>
                <SelectTrigger className="bg-[#0D1B2A] border-[#1e3a52] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai-compatible">OpenAI-compatible</SelectItem>
                  <SelectItem value="anthropic-compatible">Anthropic-compatible</SelectItem>
                  <SelectItem value="raw-custom">Raw/custom placeholder</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        <SecretField
          label="API key"
          value={key}
          show={show}
          onShow={() => setShow((value) => !value)}
          onChange={setKey}
          placeholder={configured ? "Leave blank to keep existing key" : "Paste API key"}
        />
        <Field label="Model name" value={model} onChange={setModel} placeholder={provider.modelHint} />
      </div>

      {error && <p className="text-xs text-red-400 border border-red-500/20 bg-red-500/5 rounded px-3 py-1.5">{error}</p>}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={save}
          disabled={loading}
          className="bg-[#C9A84C] hover:bg-[#e0b85a] text-[#0D1B2A] font-semibold text-xs h-8"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
        </Button>
        {configured && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearKey}
            disabled={loading}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-8"
          >
            Clear key
          </Button>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-slate-300 text-xs">{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="bg-[#0D1B2A] border-[#1e3a52] text-white placeholder:text-slate-700 focus-visible:ring-[#C9A84C]"
      />
    </div>
  )
}

function SecretField({
  label,
  value,
  show,
  onShow,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  show: boolean
  onShow: () => void
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-slate-300 text-xs">{label}</Label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            "pr-9 font-mono text-sm",
            "bg-[#0D1B2A] border-[#1e3a52] text-white placeholder:text-slate-700",
            "focus-visible:ring-[#C9A84C] focus-visible:border-[#C9A84C]"
          )}
        />
        <button
          type="button"
          onClick={onShow}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300"
          aria-label={show ? "Hide API key" : "Show API key"}
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}
