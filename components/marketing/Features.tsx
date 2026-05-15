import {
  Sparkles,
  Layers,
  FileText,
  Palette,
  Download,
  Cloud,
  GripVertical,
  Wand2,
  BookOpen,
  Zap,
} from "lucide-react"

const FEATURES = [
  {
    icon: Sparkles,
    color: "text-violet-400",
    bg:    "bg-violet-500/10 border-violet-500/20",
    title: "AI Content Generation",
    description:
      "Describe what you want to write and Claude AI generates formatted chapter content — headings, paragraphs, pro tips, and prompt cards — ready to import.",
  },
  {
    icon: Layers,
    color: "text-[#C9A84C]",
    bg:    "bg-[#C9A84C]/10 border-[#C9A84C]/20",
    title: "Visual Block Editor",
    description:
      "Eight block types — headings, paragraphs, pro tips, prompt cards, tables, page breaks, and more. Drag and drop to reorder. Inline editing for every block.",
  },
  {
    icon: FileText,
    color: "text-emerald-400",
    bg:    "bg-emerald-500/10 border-emerald-500/20",
    title: "Text → Blocks Converter",
    description:
      "Paste any plain text and watch it convert to structured blocks instantly. Use simple markers like # headings, > tips, and PROMPT: cards. Perfectly invertible.",
  },
  {
    icon: Palette,
    color: "text-blue-400",
    bg:    "bg-blue-500/10 border-blue-500/20",
    title: "Two PDF Templates",
    description:
      "Dark Cinematic (navy backgrounds, gold accents, dramatic chapter dividers) and Clean Minimal (white pages, deep blue headings, professional typography).",
  },
  {
    icon: Download,
    color: "text-rose-400",
    bg:    "bg-rose-500/10 border-rose-500/20",
    title: "One-Click PDF Export",
    description:
      "The PDF engine generates a complete document with cover page, auto-generated table of contents, chapter dividers, headers, footers, and page numbers.",
  },
  {
    icon: Cloud,
    color: "text-cyan-400",
    bg:    "bg-cyan-500/10 border-cyan-500/20",
    title: "Cloud Storage",
    description:
      "Projects auto-save every 30 seconds. Access from any device. Export history lets you download any previously generated PDF with a signed URL.",
  },
]

interface FeaturesProps {
  /** Show a reduced set for landing page (all 6) vs full detail on features page. */
  variant?: "landing" | "full"
}

export default function Features({ variant = "landing" }: FeaturesProps) {
  return (
    <section aria-labelledby="features-heading" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">

        {/* Section header */}
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#C9A84C] mb-3">
            Everything you need
          </p>
          <h2
            id="features-heading"
            className="text-3xl font-bold text-white sm:text-4xl tracking-tight"
          >
            Built for serious ebook creators
          </h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto">
            Every feature is designed to get you from blank page to published PDF as fast as possible.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, color, bg, title, description }) => (
            <article
              key={title}
              className="rounded-xl border border-[#1e3a52] bg-[#0a1929] p-6 hover:border-[#2a4d6e] transition-colors group"
            >
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border ${bg} mb-4`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
            </article>
          ))}
        </div>

        {/* Extra detail rows — only on full variant (features page) */}
        {variant === "full" && (
          <div className="mt-20 space-y-20">

            {/* Block types deep-dive */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#C9A84C] mb-3">
                  Block types
                </p>
                <h3 className="text-2xl font-bold text-white mb-4">
                  Eight block types for every kind of content
                </h3>
                <ul className="space-y-2">
                  {[
                    { name: "Heading",           desc: "H1-level bold section header" },
                    { name: "Subheading",        desc: "H2-level gold-tinted subtitle" },
                    { name: "Paragraph",         desc: "Body text with multi-line support" },
                    { name: "Pro Tip",           desc: "Callout box with gold left border" },
                    { name: "Prompt Card",       desc: "Monospace reader exercise card" },
                    { name: "Table",             desc: "Editable grid with header row" },
                    { name: "Page Break",        desc: "Force content to new PDF page" },
                    { name: "Chapter Divider",   desc: "Decorative section separator" },
                  ].map(({ name, desc }) => (
                    <li key={name} className="flex items-start gap-3 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] mt-2 shrink-0" />
                      <span>
                        <span className="font-medium text-white">{name}</span>
                        <span className="text-slate-500"> — {desc}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-[#1e3a52] bg-[#0a1929] p-5 space-y-3">
                {[
                  { type: "HEADING",    color: "text-white",      content: "Chapter One: The Foundation" },
                  { type: "SUBHEADING", color: "text-[#C9A84C]",  content: "Why Structure Matters" },
                  { type: "PRO TIP",    color: "text-[#C9A84C]",  content: "Write your first draft without editing." },
                  { type: "PROMPT",     color: "text-emerald-400", content: "Describe your protagonist's core flaw in one sentence." },
                ].map(({ type, color, content }) => (
                  <div key={type} className="rounded border border-[#1e3a52] bg-[#0D1B2A] px-3 py-2">
                    <p className={`text-[9px] font-semibold uppercase tracking-widest mb-1 ${color}`}>{type}</p>
                    <p className="text-sm text-slate-300">{content}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Drag and drop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1 rounded-xl border border-[#1e3a52] bg-[#0a1929] p-5 space-y-2">
                {["Introduction", "Core Concepts", "Advanced Techniques", "Conclusion"].map((ch, i) => (
                  <div key={ch} className={`flex items-center gap-3 rounded border px-3 py-2.5 ${
                    i === 1 ? "border-[#C9A84C]/30 bg-[#C9A84C]/5" : "border-[#1e3a52] bg-[#0D1B2A]"
                  }`}>
                    <GripVertical className="h-4 w-4 text-slate-600 shrink-0" />
                    <span className="text-sm text-slate-300">{ch}</span>
                    {i === 1 && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />}
                  </div>
                ))}
              </div>
              <div className="order-1 lg:order-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#C9A84C] mb-3">
                  Drag and drop
                </p>
                <h3 className="text-2xl font-bold text-white mb-4">
                  Reorder chapters and blocks with drag and drop
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Rearrange the structure of your ebook at any time. Drag chapters in the sidebar
                  or drag individual blocks within a chapter. Changes are reflected immediately
                  in the live preview.
                </p>
              </div>
            </div>

          </div>
        )}
      </div>
    </section>
  )
}
