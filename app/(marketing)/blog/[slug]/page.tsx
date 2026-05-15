import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Clock, Calendar } from "lucide-react"
import { getPost, POST_CONTENT, BLOG_POSTS } from "@/lib/blog-data"

interface Props {
  params: { slug: string }
}

// Generate static routes for all known posts.
export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getPost(params.slug)
  if (!post) return { title: "Not found" }

  return {
    title:       `${post.title} — Ebook Studio Blog`,
    description: post.description,
    openGraph: {
      type:        "article",
      title:       post.title,
      description: post.description,
      publishedTime: post.date,
      authors:     [post.author],
    },
    twitter: {
      card:        "summary_large_image",
      title:       post.title,
      description: post.description,
    },
  }
}

export default function BlogPostPage({ params }: Props) {
  const post = getPost(params.slug)
  if (!post) notFound()

  const content = POST_CONTENT[params.slug] ?? ""

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      {/* Back link */}
      <Link
        href="/blog"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors mb-10"
      >
        <ArrowLeft className="h-4 w-4" />
        All posts
      </Link>

      {/* Article header */}
      <header className="mb-10">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold mb-4 ${post.categoryColor}`}
        >
          {post.category}
        </span>

        <h1 className="text-3xl font-bold text-white sm:text-4xl tracking-tight leading-tight mb-4">
          {post.title}
        </h1>

        <p className="text-lg text-slate-400 leading-relaxed mb-6">
          {post.description}
        </p>

        <div className="flex items-center gap-5 text-sm text-slate-600">
          <span>{post.author}</span>
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {new Date(post.date).toLocaleDateString("en-US", {
              month: "long",
              day:   "numeric",
              year:  "numeric",
            })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {post.readTime}
          </span>
        </div>
      </header>

      {/* Divider */}
      <div className="border-t border-[#1e3a52] mb-10" />

      {/* Article body — styled with custom prose classes */}
      <article
        className={[
          "prose prose-invert max-w-none",
          "prose-headings:text-white prose-headings:font-bold",
          "prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4",
          "prose-p:text-slate-400 prose-p:leading-relaxed",
          "prose-li:text-slate-400",
          "prose-strong:text-white prose-strong:font-semibold",
          "prose-code:text-[#C9A84C] prose-code:bg-[#C9A84C]/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none",
          "prose-blockquote:border-l-[#C9A84C] prose-blockquote:border-l-[3px] prose-blockquote:bg-[#C9A84C]/5 prose-blockquote:rounded-r-lg prose-blockquote:px-4 prose-blockquote:py-3 prose-blockquote:not-italic prose-blockquote:text-slate-300",
          "prose-a:text-[#C9A84C] prose-a:no-underline hover:prose-a:underline",
          "prose-table:text-sm prose-thead:border-b prose-thead:border-[#1e3a52] prose-th:text-white prose-th:font-semibold prose-td:text-slate-400 prose-tr:border-b prose-tr:border-[#1e3a52]",
          "prose-ol:text-slate-400 prose-ul:text-slate-400",
        ].join(" ")}
        dangerouslySetInnerHTML={{ __html: content }}
      />

      {/* Divider */}
      <div className="border-t border-[#1e3a52] mt-14 pt-10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm font-semibold text-white mb-1">
              Ready to try Ebook Studio?
            </p>
            <p className="text-xs text-slate-500">
              Create professional ebooks for free — no credit card required.
            </p>
          </div>
          <Link
            href="/auth/signup"
            className="rounded-lg bg-[#C9A84C] hover:bg-[#e0b85a] px-5 py-2.5 text-sm font-semibold text-[#0D1B2A] transition-colors shrink-0"
          >
            Get started free →
          </Link>
        </div>
      </div>

      {/* Related posts */}
      <div className="mt-14">
        <h2 className="text-base font-semibold text-white mb-6">More posts</h2>
        <div className="space-y-4">
          {BLOG_POSTS.filter((p) => p.slug !== params.slug).map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="block rounded-lg border border-[#1e3a52] bg-[#0a1929] px-5 py-4 hover:border-[#2a4d6e] transition-colors group"
            >
              <span className="text-sm font-medium text-white group-hover:text-[#C9A84C] transition-colors">
                {p.title}
              </span>
              <span className="block text-xs text-slate-600 mt-1">{p.readTime}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
