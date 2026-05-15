import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BookOpen, FileText, Zap } from "lucide-react"
import Hero from "@/components/marketing/Hero"
import Features from "@/components/marketing/Features"

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Ebook Studio — Create Professional Ebooks in Minutes",
  description:
    "AI-powered ebook and PDF creator. Block editor, two stunning templates, one-click export. " +
    "Write, design, and publish professional ebooks without design skills.",
  openGraph: {
    type:        "website",
    title:       "Ebook Studio — Create Professional Ebooks in Minutes",
    description:
      "AI-powered ebook and PDF creator. Block editor, two stunning templates, one-click export.",
    siteName: "Ebook Studio",
  },
  twitter: {
    card:        "summary_large_image",
    title:       "Ebook Studio — Create Professional Ebooks in Minutes",
    description: "Write, design, and publish professional ebooks without design skills.",
  },
}

// ─── How It Works ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: "01",
    icon: BookOpen,
    title: "Create your project",
    description:
      "Choose Dark Cinematic or Clean Minimal, add your title, author name, and website. You're writing in seconds.",
  },
  {
    num: "02",
    icon: FileText,
    title: "Write your content",
    description:
      "Use the block editor, paste plain text for instant conversion, or describe what you want and let AI generate it.",
  },
  {
    num: "03",
    icon: Zap,
    title: "Export to PDF",
    description:
      "Click Export PDF. Get a professional document with cover, table of contents, and formatted chapters — instantly.",
  },
]

function HowItWorks() {
  return (
    <section
      aria-labelledby="how-heading"
      className="py-20 sm:py-28 border-t border-[#1e3a52]"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#C9A84C] mb-3">
            How it works
          </p>
          <h2
            id="how-heading"
            className="text-3xl font-bold text-white sm:text-4xl tracking-tight"
          >
            From blank page to published PDF in three steps
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 relative">
          {/* Connecting line on desktop */}
          <div
            aria-hidden
            className="hidden md:block absolute top-10 left-[calc(1/6*100%)] right-[calc(1/6*100%)] h-px bg-gradient-to-r from-transparent via-[#C9A84C]/30 to-transparent"
          />

          {STEPS.map(({ num, icon: Icon, title, description }) => (
            <article key={num} className="relative text-center">
              {/* Number circle */}
              <div className="relative inline-flex h-20 w-20 items-center justify-center rounded-2xl border border-[#C9A84C]/30 bg-[#C9A84C]/5 mb-5">
                <Icon className="h-8 w-8 text-[#C9A84C]" />
                <span className="absolute -top-3 -right-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#C9A84C] text-[10px] font-bold text-[#0D1B2A]">
                  {num.slice(-1)}
                </span>
              </div>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                {description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function CallToAction() {
  return (
    <section aria-label="Call to action" className="py-20 sm:py-28 border-t border-[#1e3a52]">
      <div className="mx-auto max-w-6xl px-6 text-center">
        {/* Subtle background glow */}
        <div className="relative inline-block w-full">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              background:
                "radial-gradient(ellipse 60% 80% at 50% 50%, #C9A84C08 0%, transparent 70%)",
            }}
          />
          <div className="relative rounded-2xl border border-[#1e3a52] bg-[#0a1929] px-8 py-16">
            <h2 className="text-3xl font-bold text-white sm:text-4xl tracking-tight mb-4">
              Ready to publish your first ebook?
            </h2>
            <p className="text-slate-400 max-w-lg mx-auto mb-8">
              Join creators who use Ebook Studio to write and publish professional ebooks.
              Free forever. No credit card required.
            </p>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-[#C9A84C] hover:bg-[#e0b85a] px-7 py-3 text-sm font-semibold text-[#0D1B2A] transition-colors shadow-lg shadow-[#C9A84C]/20"
            >
              Start for free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <CallToAction />
    </>
  )
}
