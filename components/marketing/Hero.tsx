import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"

// ─── Editor mockup ────────────────────────────────────────────────────────────

function EditorMockup() {
  return (
    <div className="relative mx-auto max-w-4xl">
      {/* Glow effect behind mockup */}
      <div
        aria-hidden
        className="absolute -inset-4 rounded-2xl opacity-30 blur-2xl"
        style={{ background: "radial-gradient(ellipse at center, #C9A84C22 0%, transparent 70%)" }}
      />

      <div className="relative rounded-xl border border-[#1e3a52] overflow-hidden shadow-2xl shadow-black/60 bg-[#0a1929]">
        {/* macOS-style window bar */}
        <div className="h-9 bg-[#060f1a] border-b border-[#1e3a52] flex items-center px-3 gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500/60" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <span className="w-3 h-3 rounded-full bg-green-500/60" />
          <span className="ml-4 text-xs text-slate-600 font-mono truncate hidden sm:block">
            ebookstudio.io — 100 Prompts for Writers
          </span>
        </div>

        {/* Toolbar */}
        <div className="border-b border-[#1e3a52] bg-[#0a1929]/80 px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="hidden xs:block text-[10px] px-2 py-0.5 rounded border border-[#C9A84C]/40 text-[#C9A84C] font-medium">
              Edit as Text
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded border border-emerald-500/40 text-emerald-400 font-medium">
              Import Text
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded border border-violet-500/40 text-violet-400 font-medium flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" /> Generate AI
            </span>
          </div>
          <span className="text-[10px] px-3 py-1 rounded bg-[#C9A84C] text-[#0D1B2A] font-bold">
            Save
          </span>
        </div>

        {/* Three-panel layout */}
        <div className="flex h-52 sm:h-64">
          {/* Chapter list */}
          <div className="w-32 sm:w-40 shrink-0 border-r border-[#1e3a52] p-3 space-y-1 overflow-hidden">
            <p className="text-[9px] text-slate-600 uppercase tracking-widest mb-2 font-semibold">
              Chapters
            </p>
            {[
              { label: "Introduction",   active: true  },
              { label: "Getting Started", active: false },
              { label: "Advanced Tips",  active: false },
              { label: "Conclusion",     active: false },
            ].map(({ label, active }) => (
              <div
                key={label}
                className={`text-[11px] py-1 px-2 rounded truncate ${
                  active
                    ? "bg-[#C9A84C]/10 text-[#C9A84C] flex items-center gap-1.5"
                    : "text-slate-500"
                }`}
              >
                {active && <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] shrink-0" />}
                {label}
              </div>
            ))}
          </div>

          {/* Block editor */}
          <div className="flex-1 p-3 space-y-2 overflow-hidden">
            {/* Heading block */}
            <div className="rounded border border-[#1e3a52] bg-[#0D1B2A] px-3 py-2">
              <p className="text-[9px] text-white/30 uppercase mb-1 tracking-widest">Heading</p>
              <p className="text-white font-bold text-sm">Welcome to Your Writing Journey</p>
            </div>
            {/* Paragraph */}
            <div className="rounded border border-[#1e3a52] bg-[#0D1B2A] px-3 py-2">
              <p className="text-[9px] text-slate-600 uppercase mb-1 tracking-widest">Paragraph</p>
              <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-2">
                This guide provides 100 carefully crafted prompts to unlock your creativity
                and help you build a consistent writing practice.
              </p>
            </div>
            {/* Pro tip */}
            <div className="rounded border border-[#C9A84C]/20 bg-[#C9A84C]/5 px-3 py-2">
              <p className="text-[9px] text-[#C9A84C] uppercase mb-1 tracking-widest font-semibold">Pro Tip</p>
              <p className="text-slate-400 text-[11px]">
                Write your first draft without editing — silence your inner critic.
              </p>
            </div>
            {/* Prompt card */}
            <div className="rounded border border-[#1e3a52] bg-[#0a1929] px-3 py-2">
              <p className="text-[9px] text-emerald-500 uppercase mb-1 tracking-widest font-semibold">Prompt Card</p>
              <p className="text-slate-400 text-[11px] font-mono line-clamp-1">
                You wake up in a city where no one remembers your name…
              </p>
            </div>
          </div>

          {/* Preview panel */}
          <div className="hidden sm:block w-44 shrink-0 border-l border-[#1e3a52] p-3 overflow-hidden">
            <p className="text-[9px] text-slate-600 uppercase tracking-widest mb-2 font-semibold">Preview</p>
            {/* Mini page preview */}
            <div className="rounded bg-[#0D1B2A] border border-[#1e3a52] p-2 space-y-1.5">
              <div className="h-5 bg-[#0a1929] border-b border-[#1e3a52] -mx-2 -mt-2 mb-2" />
              <div className="h-2 bg-white/20 rounded-sm w-3/4" />
              <div className="h-1.5 bg-slate-600/50 rounded-sm" />
              <div className="h-1.5 bg-slate-600/50 rounded-sm w-5/6" />
              <div className="h-1.5 bg-slate-600/50 rounded-sm w-2/3" />
              <div className="h-5 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded mt-2" />
              <div className="h-1.5 bg-slate-600/50 rounded-sm w-full" />
              <div className="h-1.5 bg-slate-600/50 rounded-sm w-4/5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

export default function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden pt-20 pb-16 sm:pt-28 sm:pb-20"
    >
      {/* Background radial gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, #C9A84C18 0%, transparent 60%)",
        }}
      />

      {/* Dot grid pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#C9A84C]/30 bg-[#C9A84C]/5 px-4 py-1.5 text-xs font-medium text-[#C9A84C]">
          <Sparkles className="h-3 w-3" />
          AI-powered ebook creation
        </div>

        {/* Headline */}
        <h1
          id="hero-heading"
          className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl"
        >
          Create Professional{" "}
          <span
            className="inline-block"
            style={{
              background: "linear-gradient(135deg, #C9A84C 0%, #e0b85a 50%, #C9A84C 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Ebooks
          </span>{" "}
          in Minutes
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400 leading-relaxed">
          AI-powered writing, a visual block editor, two stunning PDF templates, and
          one-click export. Everything you need to publish a professional ebook — nothing you don&apos;t.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-[#C9A84C] hover:bg-[#e0b85a] px-6 py-3 text-sm font-semibold text-[#0D1B2A] transition-colors shadow-lg shadow-[#C9A84C]/20"
          >
            Start for free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/features"
            className="inline-flex items-center gap-2 rounded-lg border border-[#1e3a52] hover:border-[#2a4d6e] px-6 py-3 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            See all features
          </Link>
        </div>

        {/* Trust line */}
        <p className="mt-4 text-xs text-slate-600">
          Free to use · No credit card required · Export unlimited PDFs
        </p>

        {/* Editor mockup */}
        <div className="mt-14 sm:mt-16">
          <EditorMockup />
        </div>
      </div>
    </section>
  )
}
