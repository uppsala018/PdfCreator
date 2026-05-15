"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Loader2, Mail, BookOpen } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// ─── inner form — needs useSearchParams so lives inside Suspense ────────────

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") ?? "/dashboard"
  const callbackError = searchParams.get("error")

  const [mode, setMode] = useState<"password" | "magic-link">("password")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(
    callbackError ? "Authentication failed. Please try again." : null
  )
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  const supabase = createClient()

  async function handlePasswordLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    router.push(next)
    router.refresh()
  }

  async function handleMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const redirectTo =
      `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })

    if (otpError) {
      setError(otpError.message)
      setLoading(false)
      return
    }

    setMagicLinkSent(true)
    setLoading(false)
  }

  // ── magic link sent confirmation screen ───────────────────────────────────
  if (magicLinkSent) {
    return (
      <div className="text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/30 flex items-center justify-center">
          <Mail className="w-8 h-8 text-[#C9A84C]" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-white">Check your inbox</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            We sent a sign-in link to{" "}
            <span className="text-white font-medium">{email}</span>.
            <br />
            Click the link to be signed in instantly.
          </p>
        </div>
        <button
          onClick={() => {
            setMagicLinkSent(false)
            setEmail("")
          }}
          className="text-sm text-[#C9A84C] hover:text-[#e0b85a] transition-colors"
        >
          Use a different email
        </button>
      </div>
    )
  }

  // ── main form ─────────────────────────────────────────────────────────────
  return (
    <form
      onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLink}
      className="space-y-5"
    >
      {error && (
        <div className="rounded-md bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-slate-300 text-sm">
          Email address
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={cn(
            "bg-[#0a1929] border-[#1e3a52] text-white placeholder:text-slate-600",
            "focus-visible:ring-[#C9A84C] focus-visible:border-[#C9A84C]"
          )}
        />
      </div>

      {mode === "password" && (
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-slate-300 text-sm">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={cn(
                "bg-[#0a1929] border-[#1e3a52] text-white placeholder:text-slate-600 pr-10",
                "focus-visible:ring-[#C9A84C] focus-visible:border-[#C9A84C]"
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className={cn(
          "w-full font-semibold bg-[#C9A84C] hover:bg-[#e0b85a] text-[#0D1B2A]",
          "transition-colors duration-150"
        )}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : mode === "password" ? (
          "Sign in"
        ) : (
          "Send magic link"
        )}
      </Button>

      <div className="relative flex items-center gap-3">
        <div className="flex-1 h-px bg-[#1e3a52]" />
        <span className="text-xs text-slate-600">or</span>
        <div className="flex-1 h-px bg-[#1e3a52]" />
      </div>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "password" ? "magic-link" : "password")
          setError(null)
        }}
        className="w-full text-sm text-[#C9A84C] hover:text-[#e0b85a] transition-colors text-center"
      >
        {mode === "password"
          ? "Sign in with a magic link instead"
          : "Sign in with password instead"}
      </button>

      <p className="text-center text-sm text-slate-500">
        Don&apos;t have an account?{" "}
        <Link
          href="/auth/signup"
          className="text-[#C9A84C] hover:text-[#e0b85a] transition-colors font-medium"
        >
          Sign up free
        </Link>
      </p>
    </form>
  )
}

// ─── page shell — server-renderable, wraps form in Suspense ─────────────────

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      {/* Brand */}
      <Link href="/" className="flex items-center gap-2.5 mb-10 group">
        <div className="w-9 h-9 rounded-lg bg-[#C9A84C] flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-[#0D1B2A]" />
        </div>
        <span className="text-white font-semibold text-lg tracking-tight group-hover:text-[#C9A84C] transition-colors">
          Ebook Studio
        </span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-sm rounded-xl border border-[#1e3a52] bg-[#0a1929] px-8 py-9 shadow-2xl">
        <div className="mb-7 space-y-1">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Sign in
          </h1>
          <p className="text-sm text-slate-400">
            Welcome back — good to see you again.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 text-[#C9A84C] animate-spin" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>

      <p className="mt-8 text-xs text-slate-700">
        By signing in you agree to our{" "}
        <Link href="/terms" className="text-slate-600 hover:text-slate-400 underline underline-offset-2 transition-colors">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-slate-600 hover:text-slate-400 underline underline-offset-2 transition-colors">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  )
}
