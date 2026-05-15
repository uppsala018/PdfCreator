import type { Metadata } from "next"
import Link from "next/link"
import { Clock, Calendar } from "lucide-react"
import { BLOG_POSTS } from "@/lib/blog-data"

export const metadata: Metadata = {
  title: "Blog — Ebook Studio",
  description:
    "Guides, tips, and updates from the Ebook Studio team. Learn how to write, " +
    "design, and publish professional ebooks faster.",
  openGraph: {
    title:       "Blog — Ebook Studio",
    description: "Guides, tips, and updates from the Ebook Studio team.",
    type:        "website",
  },
}

export default function BlogPage() {
  return (
    <main>
      {/* Header */}
      <section className="pt-20 pb-12 text-center px-6">
        <div className="mx-auto max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#C9A84C] mb-3">
            Blog
          </p>
          <h1 className="text-4xl font-bold text-white sm:text-5xl tracking-tight mb-4">
            Guides &amp; updates
          </h1>
          <p className="text-lg text-slate-400">
            Tips on ebook writing, design, and everything Ebook Studio.
          </p>
        </div>
      </section>

      {/* Post grid */}
      <section
        aria-label="Blog posts"
        className="mx-auto max-w-6xl px-6 pb-24"
      >
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {BLOG_POSTS.map((post) => (
            <article
              key={post.slug}
              className="group rounded-xl border border-[#1e3a52] bg-[#0a1929] overflow-hidden hover:border-[#2a4d6e] transition-colors flex flex-col"
            >
              {/* Card body */}
              <div className="p-6 flex flex-col flex-1">
                {/* Category */}
                <span
                  className={`inline-flex self-start items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold mb-4 ${post.categoryColor}`}
                >
                  {post.category}
                </span>

                {/* Title */}
                <h2 className="font-semibold text-white text-base leading-snug mb-3 group-hover:text-[#C9A84C] transition-colors flex-1">
                  <Link href={`/blog/${post.slug}`} className="stretched-link">
                    {post.title}
                  </Link>
                </h2>

                {/* Description */}
                <p className="text-sm text-slate-500 leading-relaxed line-clamp-3 mb-5">
                  {post.description}
                </p>

                {/* Meta */}
                <div className="flex items-center gap-4 text-xs text-slate-600 mt-auto">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    {new Date(post.date).toLocaleDateString("en-US", {
                      month: "short",
                      day:   "numeric",
                      year:  "numeric",
                    })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {post.readTime}
                  </span>
                </div>
              </div>

              {/* Read link */}
              <div className="border-t border-[#1e3a52] px-6 py-3">
                <Link
                  href={`/blog/${post.slug}`}
                  className="text-xs font-medium text-[#C9A84C] hover:text-[#e0b85a] transition-colors"
                >
                  Read article →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
