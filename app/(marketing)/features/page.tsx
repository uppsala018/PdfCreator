import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import Features from "@/components/marketing/Features"

export const metadata: Metadata = {
  title: "Features — Ebook Studio",
  description:
    "AI generation, visual block editor, text-to-blocks converter, two PDF templates, " +
    "one-click export, and cloud storage. Everything you need to create professional ebooks.",
  openGraph: {
    title:       "Features — Ebook Studio",
    description: "Everything you need to create professional ebooks.",
    type:        "website",
  },
}

export default function FeaturesPage() {
  return (
    <>
      {/* Page hero */}
      <section className="pt-20 pb-4 text-center px-6">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#C9A84C] mb-3">
            Features
          </p>
          <h1 className="text-4xl font-bold text-white sm:text-5xl tracking-tight mb-4">
            Built for the complete ebook workflow
          </h1>
          <p className="text-lg text-slate-400">
            From blank page to published PDF — every tool you need, nothing you don&apos;t.
          </p>
        </div>
      </section>

      {/* Shared features grid + detail sections */}
      <Features variant="full" />

      {/* CTA */}
      <section className="border-t border-[#1e3a52] py-20 text-center px-6">
        <h2 className="text-2xl font-bold text-white mb-4">
          Try every feature for free
        </h2>
        <p className="text-slate-400 mb-8 max-w-md mx-auto">
          No credit card. No time limit. Full access to every feature.
        </p>
        <Link
          href="/auth/signup"
          className="inline-flex items-center gap-2 rounded-lg bg-[#C9A84C] hover:bg-[#e0b85a] px-6 py-3 text-sm font-semibold text-[#0D1B2A] transition-colors"
        >
          Get started free <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </>
  )
}
