import Link from "next/link"
import { Check, Zap } from "lucide-react"

const FREE_FEATURES = [
  "Unlimited projects",
  "All block types (8 total)",
  "Dark Cinematic & Clean Minimal templates",
  "PDF export — unlimited",
  "Text-to-blocks converter",
  "AI generation (bring your own API key)",
  "Cloud storage & auto-save",
  "Export history",
]

const PRO_FEATURES = [
  "Everything in Free",
  "Managed AI (no API key needed)",
  "Custom PDF templates",
  "Team workspaces",
  "Priority PDF generation",
  "Custom domain for ebook landing pages",
  "Analytics & download tracking",
  "Priority support",
]

export default function Pricing() {
  return (
    <section aria-labelledby="pricing-heading" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">

        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#C9A84C] mb-3">
            Pricing
          </p>
          <h2
            id="pricing-heading"
            className="text-3xl font-bold text-white sm:text-4xl tracking-tight"
          >
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto">
            Start for free. Upgrade when you&apos;re ready for more power.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 max-w-4xl mx-auto">

          {/* Free */}
          <div className="rounded-xl border border-[#1e3a52] bg-[#0a1929] p-8 flex flex-col">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-1">Free</h3>
              <p className="text-slate-500 text-sm">Everything you need to publish your first ebook.</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">$0</span>
                <span className="text-slate-500 text-sm">/month</span>
              </div>
            </div>

            <ul className="space-y-3 flex-1 mb-8">
              {FREE_FEATURES.map((feat) => (
                <li key={feat} className="flex items-start gap-3 text-sm text-slate-400">
                  <Check className="h-4 w-4 text-[#C9A84C] shrink-0 mt-0.5" />
                  {feat}
                </li>
              ))}
            </ul>

            <Link
              href="/auth/signup"
              className="block text-center rounded-lg border border-[#C9A84C]/40 py-2.5 text-sm font-semibold text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-colors"
            >
              Get started free
            </Link>
          </div>

          {/* Pro — coming soon */}
          <div className="rounded-xl border border-[#C9A84C]/30 bg-[#0a1929] p-8 flex flex-col relative overflow-hidden">
            {/* Coming soon ribbon */}
            <div className="absolute top-4 right-4">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/30 px-2.5 py-1 text-[11px] font-semibold text-[#C9A84C]">
                <Zap className="h-3 w-3" /> Coming soon
              </span>
            </div>

            {/* Subtle gold glow */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10 blur-2xl bg-[#C9A84C]"
            />

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-1">Pro</h3>
              <p className="text-slate-500 text-sm">For serious creators and small publishing teams.</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">$19</span>
                <span className="text-slate-500 text-sm">/month</span>
              </div>
            </div>

            <ul className="space-y-3 flex-1 mb-8">
              {PRO_FEATURES.map((feat) => (
                <li key={feat} className="flex items-start gap-3 text-sm text-slate-400">
                  <Check className="h-4 w-4 text-[#C9A84C] shrink-0 mt-0.5" />
                  {feat}
                </li>
              ))}
            </ul>

            <button
              type="button"
              disabled
              className="block w-full text-center rounded-lg bg-[#C9A84C]/30 py-2.5 text-sm font-semibold text-[#C9A84C]/60 cursor-not-allowed"
            >
              Notify me when available
            </button>
          </div>

        </div>

        {/* FAQ teaser */}
        <div className="mt-16 text-center">
          <p className="text-slate-600 text-sm">
            Questions?{" "}
            <Link href="/blog" className="text-[#C9A84C] hover:underline">
              Read the blog
            </Link>{" "}
            or{" "}
            <a href="mailto:hello@ebookstudio.io" className="text-[#C9A84C] hover:underline">
              send us a message
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  )
}
