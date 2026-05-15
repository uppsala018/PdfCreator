# Ebook Studio

AI-powered ebook and PDF creator. Visual block editor, text-to-blocks converter,
AI content generation (Claude + OpenAI), and professional PDF export in two themes:
**Dark Cinematic** and **Clean Minimal**.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend + API routes | Next.js 14 (App Router, TypeScript strict) |
| Styling | Tailwind CSS + shadcn/ui |
| Auth + Database + Storage | Supabase |
| PDF generation | Python 3.11 / Flask / ReportLab (Docker) |
| Deployment | Vercel (frontend) · Docker host (PDF engine) |

---

## 1 — Clone and install

```bash
git clone <your-repo-url> ebook-studio
cd ebook-studio
npm install
```

---

## 2 — Set up Supabase

### 2a — Create a project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL**, **anon key**, and **service role key**
   (dashboard → Settings → API).

### 2b — Run migrations

Open the Supabase SQL Editor and run both migrations in order:

```
supabase/migrations/001_initial.sql   ← projects + exports tables + RLS
supabase/migrations/002_user_settings.sql ← user_settings table + RLS
```

Or use the Supabase CLI if you have it configured:

```bash
npx supabase db push
```

### 2c — Create the exports Storage bucket

In the Supabase dashboard go to **Storage** and create a bucket named **`exports`**
with **Public access: OFF**.

> The export API route creates the bucket automatically on first use,
> but creating it manually avoids a round-trip on the first export.

### 2d — Configure Auth redirect URLs

Dashboard → Authentication → URL Configuration:

| Field | Value |
|---|---|
| Site URL | `http://localhost:3000` (dev) / your Vercel URL (prod) |
| Redirect URLs | `http://localhost:3000/auth/callback`, `https://your-domain.com/auth/callback` |

---

## 3 — Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
# ── Supabase (required) ──────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...         # safe to expose — protected by RLS
SUPABASE_SERVICE_ROLE_KEY=eyJ...             # server-only — never use NEXT_PUBLIC_

# ── PDF engine (required) ────────────────────────────────────────────────────
PDF_ENGINE_URL=http://localhost:8000

# ── AI keys (optional — users can also add their own in Settings) ────────────
ANTHROPIC_API_KEY=sk-ant-...                 # primary AI provider
OPENAI_API_KEY=sk-...                        # fallback if no Anthropic key
```

---

## 4 — Run the Docker PDF engine

Make sure Docker Desktop is running, then from the project root:

```bash
docker compose up --build
```

First build takes ~60 seconds (downloads Python, installs ReportLab). After that:

```bash
curl http://localhost:8000/health
# → {"status": "ok", "templates": ["clean-minimal", "dark-cinematic"]}
```

Run in background:

```bash
docker compose up -d
```

Stop:

```bash
docker compose down
```

---

## 5 — Run the Next.js dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 6 — Feature walkthrough

### Marketing pages

| Route | Description |
|---|---|
| `/` | Landing page — Hero, Features, How It Works, CTA |
| `/features` | Full features deep-dive |
| `/pricing` | Free plan details + Pro coming soon + FAQ |
| `/blog` | Blog index (3 static posts) |
| `/blog/[slug]` | Full blog post with related articles |

### Auth flow

| Route | Description |
|---|---|
| `/auth/signup` | Email + password or magic link |
| `/auth/login` | Email + password or magic link |
| `/auth/callback` | Magic link / OAuth redirect handler |

After login, users are redirected to `/dashboard`. Middleware protects
`/dashboard`, `/editor/*`, and `/settings`.

### Dashboard (`/dashboard`)

- **New Project** dialog — title, author, template (Dark Cinematic / Clean Minimal)
- Project cards with title, last-modified time, theme badge
- Delete projects with confirmation dialog
- Click **Open** to go to the editor

### Editor (`/editor/[id]`)

Three-panel layout:

```
┌──────────────┬────────────────────────────────────┬───────────────┐
│ Chapter list │ Block editor                        │ Live preview  │
│              │                                     │               │
│ + Add        │  [Edit as Text] [Import] [AI]       │  (theme-      │
│ Ch 1 ●      │  ──────────────────────────────     │   accurate    │
│ Ch 2         │  [Heading block]                    │   preview)    │
│ Ch 3         │  [Paragraph block]                  │               │
│              │  [Pro Tip block]                    │               │
│              │  [+ Add block ▾]                    │               │
└──────────────┴────────────────────────────────────┴───────────────┘
```

**Block types:** Heading · Subheading · Paragraph · Pro Tip · Prompt Card ·
Table · Page Break · Chapter Divider

**Edit as Text** — converts the chapter to plain text in a full-screen
textarea. Format markers:

```
# text         → Heading
## text        → Subheading
> text         → Pro Tip
PROMPT: text   → Prompt Card
col | col      → Table row
---            → Page Break
===            → Chapter Divider
(blank line)   → block separator
```

**Generate with AI** — opens a dialog, sends your prompt (+ current chapter
as context) to Claude (primary) or GPT-4o-mini (fallback). The generated text
opens in the Import Text reviewer so you can edit before adding blocks.

**Export PDF** — calls `/api/export-pdf`, which:
1. Verifies auth
2. Fetches the project (RLS confirms ownership)
3. POSTs to the Docker PDF engine
4. Uploads the binary to Supabase Storage
5. Saves an export record
6. Returns a 1-hour signed URL — browser auto-downloads the PDF

### Settings (`/settings`)

- Add/replace/clear Anthropic API key (used for AI generation)
- Add/replace/clear OpenAI API key (fallback)
- Keys are stored server-side in the `user_settings` table
- Keys are never returned to the browser after saving — only a masked version
  (e.g. `sk-ant-••••abc1`) is shown to confirm they are set

---

## 7 — Running tests

### TypeScript / Next.js tests

```bash
npm test
```

59 tests covering the text ↔ JSON converter:

- All 8 block types in both conversion directions
- **Invertibility:** `blocks → text → blocks` must produce identical content (IDs differ; types/content/metadata must match)
- **Stability:** `text → blocks → text` is idempotent after the first conversion
- Edge cases: `---` vs `----`, `>text` vs `> text`, `###` as paragraph, XML chars in content

### PDF engine tests

```bash
cd pdf-engine
python test_pdf.py
```

32 assertion checks:
- Both templates generate valid PDFs with `%PDF` signature
- Correct page counts (9 pages dark-cinematic, 6 pages clean-minimal for the sample project)
- All 8 block types render without error
- XML special characters (`& < > " '`) are handled safely
- Multi-line paragraph content (`\n`) renders as line breaks
- Long titles word-wrap on the cover page
- Empty chapters and zero-chapter projects handled gracefully
- Flask API: `/health`, template validation, unknown template → 400, missing project → 400

---

## 8 — Deploy to Vercel

### Frontend

```bash
npx vercel
```

Or connect your GitHub repo in the Vercel dashboard.

Set these environment variables in Vercel project settings:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
PDF_ENGINE_URL            ← public URL of your deployed Docker container
ANTHROPIC_API_KEY         ← optional
OPENAI_API_KEY            ← optional
```

### PDF engine (Docker on a VPS)

```bash
# On your VPS, copy the pdf-engine/ directory then:
docker compose up -d

# Or build and push to a container registry and deploy there
```

Point a subdomain (e.g. `pdf.your-domain.com`) at port 8000 and set
`PDF_ENGINE_URL=https://pdf.your-domain.com` in Vercel.

The engine is **stateless** — no database required. Each request generates a
PDF and returns the binary. Scale horizontally as needed.

---

## 9 — Project structure

```
ebook-studio/
├── app/
│   ├── (marketing)/          # Public SEO pages
│   │   ├── page.tsx          # Landing page
│   │   ├── features/         # Features page
│   │   ├── pricing/          # Pricing page + FAQ
│   │   └── blog/             # Blog index + dynamic post pages
│   ├── (app)/                # Authenticated pages
│   │   ├── dashboard/        # Project list
│   │   ├── editor/[id]/      # Editor (server loads, client renders)
│   │   └── settings/         # API key management
│   ├── api/
│   │   ├── projects/         # GET list, POST create
│   │   ├── projects/[id]/    # GET one, PATCH update, DELETE
│   │   ├── export-pdf/       # POST — 8-step export pipeline
│   │   ├── ai-generate/      # POST — Anthropic / OpenAI
│   │   └── settings/         # GET status, PATCH save keys
│   └── auth/                 # login, signup, callback
├── components/
│   ├── editor/               # BlockEditor, all 8 block types, TextToJsonConverter,
│   │   │                     #   AiGenerateDialog, ChapterList
│   │   └── blocks/           # ParagraphBlock, HeadingBlock, ProTipBlock,
│   │                         #   PromptCardBlock, TableBlock, PageBreakBlock
│   ├── marketing/            # Nav, Hero, Features, Pricing, Footer
│   ├── preview/              # PagePreview — theme-accurate live preview
│   └── ui/                   # shadcn/ui primitives (15 components)
├── lib/
│   ├── supabase/             # client.ts, server.ts, middleware.ts, database.types.ts
│   ├── ai.ts                 # Server-only AI generation (Anthropic → OpenAI fallback)
│   ├── blog-data.ts          # Static blog post data + HTML content
│   ├── project-schema.ts     # Shared TypeScript types
│   ├── text-converter.ts     # Text ↔ JSON converter (TypeScript)
│   └── utils.ts              # cn() helper
├── pdf-engine/               # Fully self-contained Docker service
│   ├── app.py                # Flask API — /generate + /health
│   ├── pdf_generator.py      # Template dispatcher
│   ├── text_converter.py     # Python port of lib/text-converter.ts
│   ├── templates/
│   │   ├── dark_cinematic.py # Full dark-cinematic template
│   │   └── clean_minimal.py  # Full clean-minimal template
│   ├── test_pdf.py           # 32-assertion smoke tests
│   ├── Dockerfile
│   └── requirements.txt
├── supabase/migrations/
│   ├── 001_initial.sql       # projects + exports + RLS + trigger + indexes
│   └── 002_user_settings.sql # user_settings + RLS + trigger
├── middleware.ts              # Session refresh + auth guard
├── docker-compose.yml
└── .env.example
```

---

## 10 — Key architectural decisions

| Decision | Rationale |
|---|---|
| PDF engine in Docker | ReportLab runs Python. Keeping it separate from Next.js avoids native module bundling issues and makes the engine independently scalable. |
| Supabase RLS on every table | `user_id` is always set from the verified session server-side — never from the request body. RLS is the defence against horizontal privilege escalation even if a route has a bug. |
| `createServiceClient()` only in API routes | The service-role key bypasses RLS. It is only used after `getUser()` has verified the caller, and only for operations the user is authorised to perform (their own storage, their own exports). |
| Text ↔ JSON in TypeScript **and** Python | The editor (TypeScript) and the PDF engine (Python) must agree on the block format. Both share the same 59-test invertibility contract enforced in CI. |
| `@anthropic-ai/sdk` dynamic import | Both AI SDKs are loaded with `await import(...)` inside the server-only `lib/ai.ts` module, so they are never bundled into the client. |
| Signed Supabase Storage URLs | Export PDFs are private. A 1-hour signed URL is returned to the authenticated caller — the file is never proxied through Next.js. |
| `NO_API_KEY` error sentinel | The AI route returns `{ code: "NO_API_KEY" }` (HTTP 503) instead of a generic error so the UI can show the specific "Add an API key in Settings" message. |
