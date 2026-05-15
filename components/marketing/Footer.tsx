import Link from "next/link"
import { BookOpen } from "lucide-react"

const COLS = [
  {
    heading: "Product",
    links: [
      { href: "/features", label: "Features"    },
      { href: "/pricing",  label: "Pricing"     },
      { href: "/blog",     label: "Blog"        },
    ],
  },
  {
    heading: "Get started",
    links: [
      { href: "/auth/signup", label: "Create account" },
      { href: "/auth/login",  label: "Sign in"        },
      { href: "/dashboard",   label: "Dashboard"      },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/terms",   label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy"   },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="border-t border-[#1e3a52] bg-[#060f1a]">
      <div className="mx-auto max-w-6xl px-6 py-14">

        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-[#C9A84C] flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-[#0D1B2A]" />
              </div>
              <span className="font-semibold text-white group-hover:text-[#C9A84C] transition-colors">
                Ebook Studio
              </span>
            </Link>
            <p className="text-xs text-slate-600 leading-relaxed max-w-[200px]">
              AI-powered ebook and PDF creator. Write, design, and export
              professional ebooks in minutes.
            </p>
          </div>

          {/* Link columns */}
          {COLS.map((col) => (
            <div key={col.heading} className="space-y-3">
              <h3 className="text-xs font-semibold text-white uppercase tracking-widest">
                {col.heading}
              </h3>
              <ul className="space-y-2">
                {col.links.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-sm text-slate-500 hover:text-white transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-[#1e3a52] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-700">
            &copy; {new Date().getFullYear()} Ebook Studio. All rights reserved.
          </p>
          <p className="text-xs text-slate-700">
            Built with Next.js, Supabase & ReportLab
          </p>
        </div>
      </div>
    </footer>
  )
}
