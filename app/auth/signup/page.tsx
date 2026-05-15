"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, Mail, BookOpen, CheckCircle2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// Password strength helper — purely informational, no hard block.
function getPasswordStrength(pw: string): {
  score: number   // 0–4
  label: string
  color: string
} {
  if (pw.length === 0) return { score: 0, label: "", color: "" }
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++

  const map: Record<number, { label: string; color: string }> = {
    1: { label: "Weak", color: "bg-red-500" },
    2: { label: "Fair", color: "bg-amber-500" },
    3: { label: "Good", color: "bg-yellow-400" },
    4: { label: "Strong", color: "bg-[#C9A84C]" },
  }
  return { score, ...(map[score] ?? { label: "Weak", color: "bg-red-500" }) }
}

// ─── signup form ─────────────────────────────────────────────────────────────

function SignupForm() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const supabase = createClient()
  const strength = getPasswordStrength(password)

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    setLoading(true)

    const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard`

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Supabase sends a confirmation email — show the "check inbox" screen.
    setConfirmed(true)
    setLoading(false)
  }

  // ── confirmation screen ───────────────────────────────────────────────────
  if (confirmed) {
    return (
      <div className="text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/30 flex items-center justify-center">
          <Mail className="w-8 h-8 text-[#C9A84C]" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-white">Confirm your email</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            We sent a confirmation link to{" "}
            <span className="text-white font-medium">{email}</span>.
            <br />
            Click it to activate your account, then sign in.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => router.push("/auth/login")}
            className="w-full bg-[#C9A84C] hover:bg-[#e0b85a] text-[#0D1B2A] font-semibold"
          >
            Go to sign in
          </Button>
          <button
            onClick={() => setConfirmed(false)}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  // ── main form ─────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSignup} className="space-y-5">
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

      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-slate-300 text-sm">
          Password
        </Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
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

        {/* Strength bar */}
        {password.length > 0 && (
          <div className="space-y-1 pt-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((segment) => (
                <div
                  key={segment}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors duration-300",
                    strength.score >= segment
                      ? strength.color
                      : "bg-[#1e3a52]"
                  )}
                />
              ))}
            </div>
            <p className="text-xs text-slate-500">{strength.label}</p>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm-password" className="text-slate-300 text-sm">
          Confirm password
        </Label>
        <div className="relative">
          <Input
            id="confirm-password"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className={cn(
              "bg-[#0a1929] border-[#1e3a52] text-white placeholder:text-slate-600 pr-10",
              "focus-visible:ring-[#C9A84C] focus-visible:border-[#C9A84C]",
              confirmPassword.length > 0 &&
                (password === confirmPassword
                  ? "border-[#C9A84C]/50"
                  : "border-red-500/50")
            )}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            aria-label={showConfirm ? "Hide password" : "Show password"}
          >
            {showConfirm ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>

          {/* Match indicator */}
          {confirmPassword.length > 0 && password === confirmPassword && (
            <CheckCircle2 className="absolute right-8 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C9A84C]" />
          )}
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className={cn(
          "w-full font-semibold bg-[#C9A84C] hover:bg-[#e0b85a] text-[#0D1B2A]",
          "transition-colors duration-150 mt-1"
        )}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          "Create account"
        )}
      </Button>

      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link
          href="/auth/login"
          className="text-[#C9A84C] hover:text-[#e0b85a] transition-colors font-medium"
        >
          Sign in
        </Link>
      </p>
    </form>
  )
}

// ─── page shell ───────────────────────────────────────────────────────────────

export default function SignupPage() {
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
            Create your account
          </h1>
          <p className="text-sm text-slate-400">
            Start creating professional ebooks today. Free.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 text-[#C9A84C] animate-spin" />
            </div>
          }
        >
          <SignupForm />
        </Suspense>
      </div>

      <p className="mt-8 text-xs text-slate-700">
        By creating an account you agree to our{" "}
        <Link
          href="/terms"
          className="text-slate-600 hover:text-slate-400 underline underline-offset-2 transition-colors"
        >
          Terms
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy"
          className="text-slate-600 hover:text-slate-400 underline underline-offset-2 transition-colors"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  )
}
