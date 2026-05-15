export interface BlogPost {
  slug:        string
  title:       string
  description: string
  date:        string      // ISO 8601
  author:      string
  readTime:    string
  category:    string
  categoryColor: string   // Tailwind color class
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug:          "how-to-create-your-first-ebook",
    title:         "How to Create Your First Professional Ebook in 5 Steps",
    description:
      "A practical guide to writing, designing, and exporting a professional ebook with Ebook Studio — from blank project to finished PDF in under an hour.",
    date:          "2026-01-15",
    author:        "Ebook Studio Team",
    readTime:      "6 min read",
    category:      "Guide",
    categoryColor: "text-[#C9A84C] bg-[#C9A84C]/10 border-[#C9A84C]/20",
  },
  {
    slug:          "10-prompt-templates-for-ebook-writers",
    title:         "10 Powerful Prompt Templates for Ebook Writers",
    description:
      "Copy-paste these 10 prompt card templates into your chapters to spark reader engagement, creative exercises, and reflection points throughout your ebook.",
    date:          "2026-02-01",
    author:        "Ebook Studio Team",
    readTime:      "8 min read",
    category:      "Tips",
    categoryColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  {
    slug:          "dark-cinematic-vs-clean-minimal",
    title:         "Dark Cinematic vs Clean Minimal: Choosing Your PDF Template",
    description:
      "A side-by-side comparison of Ebook Studio's two PDF templates — when to use each one, what audience they suit, and how they differ in design philosophy.",
    date:          "2026-02-15",
    author:        "Ebook Studio Team",
    readTime:      "5 min read",
    category:      "Design",
    categoryColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
]

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug)
}

// ─── Static post content (keyed by slug) ─────────────────────────────────────
// HTML strings — safe because they come from this file, not user input.

export const POST_CONTENT: Record<string, string> = {
  "how-to-create-your-first-ebook": `
<p>
  Creating a professional ebook used to require expensive design software, a layout
  specialist, and weeks of back-and-forth. With Ebook Studio, you can go from blank
  page to polished PDF in under an hour. Here's how.
</p>

<h2>Step 1: Create a new project</h2>
<p>
  From the dashboard, click <strong>New Project</strong>. Give your ebook a title, add
  your name as the author, and choose a template:
</p>
<ul>
  <li><strong>Dark Cinematic</strong> — navy backgrounds, gold accents, dramatic chapter dividers. Great for creative guides, fiction companions, and anything where impact matters.</li>
  <li><strong>Clean Minimal</strong> — white pages, deep blue headings, professional typography. Ideal for business guides, how-to books, and educational content.</li>
</ul>
<p>You can change this later — it only affects the PDF output, not the editor.</p>

<h2>Step 2: Plan your chapters</h2>
<p>
  In the editor sidebar, add a chapter for each major section of your ebook. Aim for
  5–10 chapters of 300–800 words each. Rename chapters by double-clicking them.
  Reorder them by dragging.
</p>
<blockquote>
  <strong>Pro tip:</strong> Write your chapter titles before writing any content. A
  clear structure makes writing 10× faster.
</blockquote>

<h2>Step 3: Write your content</h2>
<p>You have three ways to add content to each chapter:</p>
<ol>
  <li>
    <strong>Block editor</strong> — Click <em>Add block</em> and choose from heading,
    paragraph, pro tip, prompt card, table, and more. Each block is editable inline.
  </li>
  <li>
    <strong>Edit as Text</strong> — Click the gold <em>Edit as Text</em> button to view
    and edit the entire chapter as plain text. Use <code>#</code> for headings,
    <code>&gt;</code> for pro tips, and <code>PROMPT:</code> for prompt cards. Click
    <em>Apply</em> when done.
  </li>
  <li>
    <strong>Generate with AI</strong> — Click the violet <em>Generate with AI</em>
    button, describe what you want, and the AI writes formatted chapter content you
    can review before importing.
  </li>
</ol>

<h2>Step 4: Review the live preview</h2>
<p>
  The right panel shows a live preview of how each block will look in the PDF. Check
  that headings are correctly sized, tables look right, and pro tip boxes are formatted
  the way you expect.
</p>

<h2>Step 5: Export your PDF</h2>
<p>
  Click the <strong>Export PDF</strong> button in the editor header. Ebook Studio
  generates a complete PDF with:
</p>
<ul>
  <li>A full cover page with your title, subtitle, and author name</li>
  <li>An auto-generated table of contents with page numbers</li>
  <li>Chapter divider pages</li>
  <li>Headers and footers on every page</li>
  <li>Page numbers starting at page 3</li>
</ul>
<p>
  The PDF is uploaded to your account and a signed download link is returned.
  Downloads are valid for one hour. You can re-export any time.
</p>

<h2>What next?</h2>
<p>
  Publish your PDF on Gumroad, attach it to a ConvertKit lead magnet, or share it
  with your audience directly. Ebook Studio handles the hard part — the rest is up to you.
</p>
  `,

  "10-prompt-templates-for-ebook-writers": `
<p>
  Prompt cards are one of the most powerful blocks in Ebook Studio. They create a
  visually distinct callout that invites the reader to stop, think, and take action.
  Here are 10 templates you can drop straight into any chapter.
</p>

<h2>1. The Scene Opener</h2>
<blockquote>
  PROMPT: Set a timer for 10 minutes and write the opening paragraph of a scene where
  your protagonist faces their biggest fear. Don't plan — just write.
</blockquote>

<h2>2. The Character Excavation</h2>
<blockquote>
  PROMPT: Write three things your main character desperately wants and three things
  they secretly fear. Notice where they overlap — that overlap is your story's engine.
</blockquote>

<h2>3. The Tension Builder</h2>
<blockquote>
  PROMPT: Take your most recent scene and rewrite it so every line of dialogue has a
  hidden agenda. What does each character really want from this conversation?
</blockquote>

<h2>4. The World Detail</h2>
<blockquote>
  PROMPT: Describe the smell of your story's world. Not the visuals — the smells.
  What does it smell like when your character wakes up? When danger is near?
</blockquote>

<h2>5. The Backstory Excavation</h2>
<blockquote>
  PROMPT: Write a scene from your protagonist's childhood that explains one of their
  adult flaws. You may never use it in the book — but you need to know it.
</blockquote>

<h2>6. The Thematic Question</h2>
<blockquote>
  PROMPT: In one sentence, write what your story is really about — not the plot, but
  the theme. Now write a scene that proves that sentence wrong. Both versions matter.
</blockquote>

<h2>7. The Reader Reflection</h2>
<blockquote>
  PROMPT: Before reading further, write down one thing from your own life that
  connects to what you've read so far. The most powerful reading is personal reading.
</blockquote>

<h2>8. The Expert Perspective</h2>
<blockquote>
  PROMPT: Imagine your reader is the world's leading expert on this topic. What
  question would they most want answered in the next chapter? Write that chapter.
</blockquote>

<h2>9. The Contrarian Prompt</h2>
<blockquote>
  PROMPT: Write the strongest possible argument against the main point of this
  chapter. Steel-man the opposition. Now decide: does your position survive?
</blockquote>

<h2>10. The Closing Ritual</h2>
<blockquote>
  PROMPT: Write three specific actions your reader can take in the next 24 hours
  based on what they just learned. Make them small, concrete, and achievable.
</blockquote>

<h2>How to use these in Ebook Studio</h2>
<p>
  In any chapter, click <strong>Add block → Prompt Card</strong> and paste one of the
  prompts above. Or use <em>Edit as Text</em> and prefix any line with
  <code>PROMPT:</code> to create a prompt card automatically.
</p>
<p>
  Prompt cards render with a distinct visual style in both the Dark Cinematic and
  Clean Minimal templates — monospace font, bordered box, clearly set apart from
  body text so readers can't miss them.
</p>
  `,

  "dark-cinematic-vs-clean-minimal": `
<p>
  Ebook Studio ships with two PDF templates. Choosing the right one shapes how your
  reader experiences your ebook before they read a single word. Here's a complete
  comparison.
</p>

<h2>Dark Cinematic</h2>
<p>
  The Dark Cinematic template is built for impact. Every page makes a statement.
</p>
<ul>
  <li><strong>Cover:</strong> Full dark-navy background (#0D1B2A), gold title text (#C9A84C), white subtitle, author at the bottom. The cover demands attention.</li>
  <li><strong>Chapter dividers:</strong> Full-navy full-page spreads with a large gold chapter number and white chapter title centered. Between each chapter, the reader gets a visual beat.</li>
  <li><strong>Header bar:</strong> An 8mm dark-navy band at the top of every content page carries the book title (white) and your website (gold).</li>
  <li><strong>Pro Tip boxes:</strong> Navy background with a 3pt gold left border and white text. Visually assertive — readers won't miss these.</li>
  <li><strong>Tables:</strong> Alternating navy/white rows with a gold underline on the header row. Dramatic but readable.</li>
  <li><strong>Page numbers:</strong> Bottom center, Helvetica 9pt grey.</li>
</ul>
<p>
  <strong>Use Dark Cinematic for:</strong> Creative writing guides, AI prompt collections,
  personal development books, anything where the brand identity should be strong and memorable.
</p>

<h2>Clean Minimal</h2>
<p>
  Clean Minimal is built for credibility. It looks like it came from a professional publisher.
</p>
<ul>
  <li><strong>Cover:</strong> White background, large deep-blue title (#1A3A5C), a thin gold rule line, subtitle and author below. Restrained and authoritative.</li>
  <li><strong>No chapter dividers:</strong> Content flows straight from chapter to chapter. No full-page spreads — every page is content.</li>
  <li><strong>Header:</strong> A single 1pt grey rule across the top of each page, with the current chapter title centered in 9pt grey above it.</li>
  <li><strong>Pro Tip boxes:</strong> Light blue (#EBF4FF) background with a 3pt deep-blue left border. Calm and professional.</li>
  <li><strong>Prompt Cards:</strong> White background with a 3pt gold left border. Subtler than Dark Cinematic's version.</li>
  <li><strong>Tables:</strong> Clean grey grid lines, bold deep-blue header row underline, no background fills on alternating rows.</li>
  <li><strong>Page numbers:</strong> Bottom right, standard position for professional documents.</li>
</ul>
<p>
  <strong>Use Clean Minimal for:</strong> Business guides, how-to manuals, educational
  content, anything where you want readers to focus on the words rather than the design.
</p>

<h2>Side-by-side summary</h2>
<p>Here's a quick reference table:</p>

<table>
  <thead>
    <tr><th>Element</th><th>Dark Cinematic</th><th>Clean Minimal</th></tr>
  </thead>
  <tbody>
    <tr><td>Page background</td><td>White content pages, navy special pages</td><td>White throughout</td></tr>
    <tr><td>Cover</td><td>Full navy, gold title</td><td>White, deep-blue title</td></tr>
    <tr><td>Chapter dividers</td><td>Full-page navy spreads</td><td>None</td></tr>
    <tr><td>Headings</td><td>Deep navy (#0D1B2A)</td><td>Deep blue (#1A3A5C)</td></tr>
    <tr><td>Subheadings</td><td>Gold (#C9A84C)</td><td>Deep blue</td></tr>
    <tr><td>Pro Tip</td><td>Navy box, gold border</td><td>Light blue box, blue border</td></tr>
    <tr><td>Tables</td><td>Alternating navy rows</td><td>Clean lines only</td></tr>
    <tr><td>Page numbers</td><td>Bottom center</td><td>Bottom right</td></tr>
    <tr><td>Feel</td><td>Dramatic, branded</td><td>Professional, editorial</td></tr>
  </tbody>
</table>

<h2>Can I switch templates?</h2>
<p>
  Yes. The template is stored as a project setting. You can change it any time from
  the dashboard by editing the project, or from the editor's top bar. The content
  doesn't change — just the PDF output.
</p>
<p>
  Pro tip: export both versions and see which one looks better for your specific
  content. Some chapters respond better to the high-contrast of Dark Cinematic;
  others breathe more naturally in Clean Minimal.
</p>
  `,
}
