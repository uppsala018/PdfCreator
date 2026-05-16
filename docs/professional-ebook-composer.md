# Professional Ebook Composition Engine

## 1. Product Goal

Ebook Studio should become capable of generating professional, sellable PDF ebooks automatically. The target is not simply "AI text in a PDF"; the product needs a real document composition pipeline that turns structured content into polished guide-style documents with strong typography, consistent spacing, branded components, and layout safety.

The quality target is a finished PDF that feels deliberately composed: cover, table of contents, chapter openings, styled sections, callouts, tables, prompt/code blocks, CTAs, headers, footers, and a back cover. AI generation should feed this pipeline with structured content, but the PDF quality comes from composition rules and reusable ReportLab components.

## 2. Product Modes

Ebook Studio has two separate PDF product modes:

- Generated Ebook Composer: creates new professional ebooks from structured content and AI-generated material.
- Imported PDF Repair Editor: imports an existing PDF, preserves its visual appearance, and allows page deletion, visual region movement, repair, and corrected export.

This document concerns the Generated Ebook Composer only. It should not replace or disrupt the Imported PDF Repair Editor.

## 3. Reference Visual Style

The premium default theme should be clean, credible, and commercial rather than decorative.

- Dark navy: `#1A1A2E`
- Teal: `#20808D`
- Gold: `#D4A84B`
- Page background: clean white
- Body typography: elegant sans-serif, readable at guide/book length
- Heading hierarchy: strong contrast between chapter, section, and sub-section levels
- Style direction: premium but not flashy; useful for guides, playbooks, prompt collections, business ebooks, and educational products

The default look should support long-form reading, skimming, and premium lead-magnet/sellable PDF use cases.

## 4. Composition Engine Architecture

Add a new professional composer module under the existing Python PDF engine rather than replacing the current templates immediately.

Suggested structure:

```text
pdf-engine/
  composer/
    __init__.py
    themes.py
    styles.py
    components.py
    layout.py
    professional_guide.py
    quality.py
```

Responsibilities:

- `themes.py`: color palettes, spacing tokens, page sizes, margins, brand defaults.
- `styles.py`: ReportLab paragraph styles, table styles, typography hierarchy.
- `components.py`: reusable Flowables/component builders for boxes, tables, CTAs, prompt blocks, headers, and covers.
- `layout.py`: document template setup, page callbacks, table of contents registration, page break helpers, KeepTogether/CondPageBreak wrappers.
- `professional_guide.py`: sample professional guide assembly and future production entry point.
- `quality.py`: layout diagnostics, page count checks, component presence checks, and later rebuild/review heuristics.

The first implementation should create a standalone sample PDF through this composer path. Existing PDF export should remain untouched until the composer proves stable.

## 5. Reusable Components

Build components as explicit reusable units, not one-off drawing code.

Required components:

- Cover page
- Table of contents
- Chapter header
- Section heading
- Body paragraph
- Bullet list
- Numbered list
- Tip box
- Warning/important box
- Key takeaway box
- Styled prompt/code block
- Comparison table
- Workflow step block
- CTA box
- Back cover
- Page header/footer

Each component should have predictable inputs, spacing behavior, theme awareness, and a safe fallback for missing optional content.

## 6. Layout Safety Rules

The professional composer must treat layout safety as a first-class feature.

Required behavior:

- Keep headings with the following paragraph or content block.
- Keep callout boxes together where possible.
- Keep tables with captions and footnotes where possible.
- Avoid orphaned headers at the bottom of pages.
- Avoid single-line leftovers when practical.
- Use `CondPageBreak` before large blocks that should not start awkwardly near the bottom of a page.
- Use `KeepTogether` around logical groups, boxes, small tables, CTA blocks, and heading-plus-intro groups.
- Prefer controlled page breaks over ugly splits.
- Add page-balance review later to detect short final pages, awkward table splits, and excessive blank space.

The composer should bias toward a slightly longer but cleaner PDF instead of squeezing content into poor page breaks.

## 7. Data Model Direction

Future generated ebooks should use a structured content model before reaching ReportLab.

Suggested model fields:

- Ebook title
- Subtitle
- Author or brand
- Website or brand URL
- Theme preset
- Chapters
- Sections
- Blocks
- Block types
- Callouts
- Tables
- Prompts/code blocks
- CTAs
- Citations and footnotes

Example direction:

```text
Ebook
  title
  subtitle
  author
  brand
  chapters[]
    title
    intro
    sections[]
      heading
      blocks[]
        paragraph
        bullet_list
        numbered_list
        tip
        warning
        key_takeaway
        prompt_block
        comparison_table
        workflow_steps
        cta
        citation
```

The AI layer should eventually generate this structured model directly instead of returning plain text that later needs guessing.

## 8. Integration Plan

Phase 1: Professional composer module and sample PDF only

- Add `pdf-engine/composer/`.
- Build theme, styles, core components, and a standalone sample guide generator.
- Add Python smoke tests for sample generation.
- Do not connect this path to existing app export yet.

Phase 2: Connect existing ebook projects to professional export path

- Add a new export option or template flag for professional composer output.
- Map existing project/chapter/block data into the structured composer model.
- Keep the current ReportLab templates available.

Phase 3: AI content-to-structured-block generation

- Update AI generation to produce structured ebook sections and blocks.
- Validate generated structure before rendering.
- Add fallback repair for invalid AI output.

Phase 4: Automatic layout quality review/rebuild loop

- Add `quality.py` checks for page count, orphaned headings, short final pages, table splits, and component presence.
- Add controlled rebuild attempts with adjusted page breaks or block grouping.
- Log layout warnings for future UI review.

Phase 5: Theme presets and user customization

- Add theme presets based on the premium default.
- Allow user-level brand colors, author/brand metadata, CTA text, and website.
- Choose a safe font strategy before adding or committing font files.

## 9. Strict Boundaries

Do not:

- Replace existing PDF export yet.
- Break the imported PDF editor.
- Touch auth or Supabase unless strictly necessary for a later integration phase.
- Add OCR.
- Add full text editing.
- Add advanced frontend redesign.
- Commit font files unless a safe licensing and bundling strategy is chosen.
- Remove existing tests.
- Rewrite the current Python templates before the composer path is proven.

## 10. Testing Strategy

Testing should grow with each phase.

Required tests:

- Python smoke test that generates the professional sample PDF.
- Generated sample PDF page count check.
- PDF metadata check: title/author where available.
- Component rendering checks for cover, TOC, chapter header, callouts, tables, prompt/code block, CTA, back cover, header/footer.
- Existing `npm test`.
- Existing `pdf-engine/test_pdf.py`.

Later tests:

- Layout quality warnings from `quality.py`.
- Stable rendering for long headings and long table rows.
- Regression fixtures for representative ebook projects.
- Export comparison snapshots if a practical PDF inspection strategy is added.

## 11. Codex Implementation Guidance

Future implementation prompts should be small and additive.

Recommended sequence:

1. Add composer package skeleton and sample generator.
2. Add theme and style tokens.
3. Add cover, headers, footers, and body text.
4. Add callout and prompt/code components.
5. Add tables and workflow steps.
6. Add table of contents.
7. Add quality checks.
8. Add integration with existing ebook projects.
9. Add structured AI generation.

Each phase should pass tests before moving to the next. Avoid broad refactors. Prefer local, composable additions that can be verified independently.
