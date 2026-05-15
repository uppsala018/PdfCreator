import Link from "next/link"
import { BookOpen } from "lucide-react"

export default function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#1e3a52]/60 bg-[#0D1B2A]/90 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between gap-6">

        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-8 h-8 rounded-lg bg-[#C9A84C] flex items-center justify-center">
            <BookOpen className="w-4.5 h-4.5 text-[#0D1B2A]" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <span className="font-semibold text-white tracking-tight group-hover:text-[#C9A84C] transition-colors">
            Ebook Studio
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {[
            { href: "/features", label: "Features" },
            { href: "/pricing",  label: "Pricing"  },
            { href: "/blog",     label: "Blog"      },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="px-3 py-1.5 text-sm text-slate-400 hover:text-white rounded-md hover:bg-white/5 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* CTAs */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/auth/login"
            className="hidden sm:block px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className="px-4 py-1.5 rounded-lg bg-[#C9A84C] hover:bg-[#e0b85a] text-[#0D1B2A] text-sm font-semibold transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  )
}
