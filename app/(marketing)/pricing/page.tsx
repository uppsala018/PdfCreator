import type { Metadata } from "next"
import Pricing from "@/components/marketing/Pricing"

export const metadata: Metadata = {
  title: "Pricing — Ebook Studio",
  description:
    "Ebook Studio is free to use with unlimited projects and PDF exports. " +
    "Pro tier with managed AI and team workspaces coming soon.",
  openGraph: {
    title:       "Pricing — Ebook Studio",
    description: "Free forever. Pro tier coming soon.",
    type:        "website",
  },
}

export default function PricingPage() {
  return (
    <main>
      {/* Page hero */}
      <section className="pt-20 pb-4 text-center px-6">
        <div className="mx-auto max-w-xl">
          <h1 className="text-4xl font-bold text-white sm:text-5xl tracking-tight mb-4">
            Simple pricing
          </h1>
          <p className="text-lg text-slate-400">
            Start free. No credit card required. Export unlimited PDFs.
          </p>
        </div>
      </section>

      <Pricing />

      {/* FAQ */}
      <section className="border-t border-[#1e3a52] py-20 px-6">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold text-white text-center mb-10">
            Frequently asked questions
          </h2>
          <dl className="space-y-6">
            {[
              {
                q: "Is Ebook Studio really free?",
                a: "Yes. The core app — unlimited projects, all block types, both PDF templates, unlimited exports — is completely free. No credit card, no trial period.",
              },
              {
                q: "Do I need my own AI API key?",
                a: "For AI generation, yes — you bring your own Anthropic or OpenAI key and add it in Settings. It stays on your account and is never shared. The Pro plan (coming soon) will include managed AI so you won't need your own key.",
              },
              {
                q: "What PDF formats does Ebook Studio support?",
                a: "All exports are standard A4 PDF files compatible with every PDF reader, Kindle Create, and print-on-demand services.",
              },
              {
                q: "Can I use Ebook Studio for commercial projects?",
                a: "Yes. PDFs you generate belong entirely to you. There are no watermarks and no royalties.",
              },
              {
                q: "When is the Pro plan launching?",
                a: "We're working on it. The Pro plan will include managed AI (no API key needed), custom templates, and team workspaces. Sign up for free and you'll be notified when it's ready.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-[#1e3a52] pb-6">
                <dt className="font-semibold text-white mb-2">{q}</dt>
                <dd className="text-sm text-slate-400 leading-relaxed">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </main>
  )
}
