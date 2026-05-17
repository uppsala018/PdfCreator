# PDF to Professional Composer Recomposition

## 1. Product Goal

Some imported PDFs will be too structurally broken for visual patch repair alone. Page deletion, visual region movement, overlays, and patch fills are useful when the original PDF is mostly sound. They are not enough when the document has unreliable reading order, split tables, flattened text, inconsistent section hierarchy, missing margins, or pages that need to be rebuilt rather than visually patched.

The future recomposition path should allow a user to move from an imported PDF into a rebuilt Professional Composer document:

```text
Imported PDF
  -> text/layout extraction
  -> structure inference
  -> normalized ebook schema
  -> Professional Composer
  -> rebuilt professional PDF
```

This is not OCR implementation yet. The goal of this document is to define the architecture, boundaries, confidence model, and phased roadmap for a future PDF-to-Composer rebuild pipeline.

## 2. Repair vs Recomposition

PDF repair and full recomposition solve different problems.

PDF repair preserves the imported PDF as the visual source of truth. It is appropriate when the user wants the same document with targeted corrections. Accepted edits should remain reversible `layoutEditState` operations, such as deleting pages, moving visual regions, adding overlays, changing patch fills, or flagging manual review items. Repair should not reinterpret the whole document.

Full recomposition treats the imported PDF as source material. It extracts or infers content, maps that content into Ebook Studio's normalized schema, and sends the result through the Professional Composer. The output is a newly composed professional PDF that may use different page breaks, typography, spacing, themes, headers, footers, tables, callouts, and CTAs. It is appropriate when the original layout is broken enough that preserving it is lower quality than rebuilding it.

The repair workflow can recommend recomposition through `suggest_recompose_in_professional_composer`, but it should not automatically convert a project or apply a full rebuild without user review.

## 3. Target Workflow

The future recomposition workflow should be:

```text
Imported PDF project
  -> source page access
  -> text and layout extraction
  -> page and reading-order model
  -> structure inference
  -> confidence scoring
  -> manual review of uncertain structures
  -> normalized ebook schema
  -> existing normalization diagnostics
  -> Professional Composer theme mapping
  -> rebuilt professional PDF export
```

Responsibilities:

- Imported PDF project: keeps the uploaded PDF and existing repair editor available.
- Source page access: loads source pages through PDF.js or a server renderer without changing export architecture.
- Text and layout extraction: produces text runs, bounding boxes, font hints, image regions, and page geometry when available.
- Structure inference: groups extracted primitives into document blocks and chapters.
- Confidence scoring: records how reliable each inferred section, block, and ordering decision appears.
- Manual review: asks the user to resolve low-confidence structure before rebuild.
- Normalized ebook schema: converts reviewed structure into the schema used by the AI ebook and Professional Composer paths.
- Professional Composer: applies established themes, layout safety rules, diagnostics, and PDF generation.

## 4. Future Extraction Targets

The extraction layer should aim to identify these document elements:

- Headings
- Paragraphs
- Bullet lists
- Numbered lists
- Tables
- CTA sections
- Callouts, tips, warnings, notes, and key takeaways
- Chapter boundaries
- Images, logos, screenshots, and decorative image regions
- Captions and footnotes
- Page headers and footers
- Repeated boilerplate that should be excluded from body content

Not every target needs to be supported in the first extraction release. Unsupported or ambiguous structures should become review items rather than guessed final content.

## 5. Inferred Block Types

The recomposition pipeline should map extracted structures into composer-compatible block types.

Suggested inferred block types:

- `chapter_title`
- `section_heading`
- `subheading`
- `paragraph`
- `bullet_list`
- `numbered_list`
- `comparison_table`
- `data_table`
- `tip_callout`
- `warning_callout`
- `key_takeaway`
- `cta`
- `image`
- `caption`
- `quote`
- `divider`
- `unknown`

The `unknown` block type is important. It gives the system a safe way to preserve uncertain extracted material for review without forcing a low-confidence conversion into a polished component.

## 6. Confidence and Scoring

Every inferred structure should carry confidence metadata. Confidence should be normalized from `0` to `1`, but the system should also keep explainable evidence so the UI can show why an item needs review.

Suggested scoring dimensions:

- Text extraction confidence: whether text was directly extractable or only available through future OCR.
- Reading-order confidence: whether the inferred sequence matches spatial and semantic expectations.
- Block-type confidence: whether a run is clearly a heading, paragraph, table, CTA, callout, or image.
- Boundary confidence: whether chapter, section, table, and callout boundaries are clear.
- Table confidence: whether rows, columns, headers, and continuation pages are reliable.
- Image confidence: whether an image region is content, decoration, logo, or background.
- Theme-fit confidence: whether the inferred content maps cleanly into existing composer components.
- Rebuild-risk score: whether the source document should remain in repair mode rather than be recomposed.

Suggested thresholds:

- `0.85` and above: can be accepted by default but still visible in review.
- `0.60` to `0.84`: include in review with recommended mapping.
- Below `0.60`: require manual review before composer rebuild.

Thresholds should be tuned with real imported PDFs. They should not be treated as permanent product rules.

## 7. Uncertain Structures

Uncertain structures should be represented explicitly.

Examples:

- A large bold line could be a chapter title, section heading, or CTA headline.
- A two-column layout could be a comparison table or unrelated side-by-side paragraphs.
- A repeated banner could be a header, callout, ad, or decorative graphic.
- A sparse page could be intentional whitespace or a failed extraction.
- A split table could require table reconstruction or visual repair instead.
- A flattened scanned page may need future OCR before recomposition.

The data model should preserve:

- Candidate block types
- Confidence per candidate
- Source page and bounding box
- Extracted text or image reference
- Reason for uncertainty
- Required user decision

Manual review requirements should be generated when a structure is low confidence, destructive to guess, or likely to affect document meaning.

## 8. Manual Review Requirements

The review UI should eventually let users:

- Confirm chapter boundaries.
- Choose a block type for uncertain structures.
- Merge or split paragraphs and sections.
- Confirm table headers, rows, and continuation pages.
- Mark repeated headers/footers for exclusion.
- Choose whether an image is content, decoration, logo, or discardable.
- Convert visual callouts into composer callout blocks.
- Decide whether to continue with visual repair instead of recomposition.

Review decisions should become structured metadata. The composer rebuild should consume the reviewed structure rather than raw extraction output.

## 9. Integration Points

AI ebook generation:

- Recomposition should target the same structured content direction as AI ebook generation.
- Future AI cleanup can rewrite or normalize extracted blocks only after user approval.
- AI-generated additions should remain distinguishable from extracted source content.

Normalization pipeline:

- Extracted and reviewed structures should pass through the same normalization and validation layer used by generated ebook drafts.
- Malformed tables, empty blocks, unsupported block types, and inconsistent metadata should be repaired or reported before composer rendering.

Professional Composer themes:

- Rebuilt PDFs should use the existing Professional Composer theme mapping.
- Theme choice should be user-controlled. The original PDF can inform theme suggestions, but it should not force exact visual cloning.
- Composer layout safety rules should control page breaks, table grouping, callout spacing, headers, footers, and back matter.

Diagnostics:

- Extraction diagnostics should report uncertain reading order, low-confidence blocks, missing chapter boundaries, questionable tables, and images requiring review.
- Composer diagnostics should report layout issues after rebuild, such as short final pages, table split risks, missing CTA components, or invalid block data.
- Repair diagnostics should remain separate from recomposition diagnostics, though repair can recommend recomposition when visual patching is not enough.

## 10. Suggested Data Shapes

The exact implementation can evolve, but the pipeline should keep these boundaries clear.

```ts
interface ExtractedPdfPrimitive {
  id: string;
  pageIndex: number;
  text?: string;
  imageRef?: string;
  boundingBox: RenderedBoundingBox;
  fontName?: string;
  fontSize?: number;
  weightHint?: "regular" | "bold" | "unknown";
  source: "pdf_text" | "pdf_image" | "future_ocr";
}

interface InferredStructureBlock {
  id: string;
  type: InferredBlockType;
  candidates: Array<{ type: InferredBlockType; confidence: number }>;
  sourcePrimitiveIds: string[];
  pageRange: { startPageIndex: number; endPageIndex: number };
  confidence: number;
  reviewRequired: boolean;
  uncertaintyReason?: string;
}

interface PdfToComposerDraft {
  sourceProjectId: string;
  extractionVersion: number;
  blocks: InferredStructureBlock[];
  diagnostics: PdfToComposerDiagnostic[];
  normalizedProjectCandidate?: ProjectContent;
}
```

The extracted primitive layer should not know about composer rendering. The inferred structure layer should not directly write PDF output. The normalized schema should be the handoff into existing Ebook Studio composer logic.

## 11. Phased Roadmap

Phase 1: architecture

- Document the PDF-to-Composer pipeline.
- Define extraction targets, inferred block types, confidence concepts, and review boundaries.
- Keep current repair, export, AI generation, and composer systems unchanged.

Phase 2: extraction

- Add non-OCR PDF text extraction where text is embedded and accessible.
- Capture text runs, bounding boxes, font hints, image regions, page geometry, headers, and footers.
- Persist extraction diagnostics without producing composer output.

Phase 3: structure inference

- Group primitives into headings, paragraphs, lists, tables, CTAs, callouts, chapter boundaries, and images.
- Add confidence scoring and uncertain-structure records.
- Produce a `PdfToComposerDraft` candidate.

Phase 4: review UI

- Add a review surface for uncertain structures.
- Let users confirm block types, chapter boundaries, table structure, image handling, and exclusions.
- Store review decisions separately from raw extraction output.

Phase 5: composer rebuild

- Convert reviewed structures into the normalized ebook schema.
- Run existing normalization diagnostics.
- Render through Professional Composer themes and layout safety rules.
- Keep the original imported PDF and visual repair project available.

Phase 6: hybrid AI cleanup

- Add optional AI cleanup for low-quality extracted text, headings, summaries, CTA copy, and table labels.
- Keep extracted source content and AI-modified content auditable.
- Require review for semantic rewrites or content additions.

## 12. Strict Boundaries

Do not implement in this phase:

- OCR
- Live AI calls
- Pixel analysis
- Extraction engines
- Composer rebuild UI
- Export architecture changes
- Automatic conversion from imported PDF repair to recomposed PDF
- Rewrites of current AI ebook generation, normalization, or composer internals

The immediate work is architectural clarity. Implementation should begin only after the extraction and review data contracts are chosen.

## 13. Open Questions

- Should recomposition create a new ebook project, a new imported-PDF-derived project type, or a child project linked to the imported PDF?
- How should extracted images be stored and referenced before composer rendering?
- What is the minimum review UI needed before a user can trust a rebuilt PDF?
- Which table structures should be supported before recomposition is exposed in production?
- How should AI cleanup mark source-preserving edits versus semantic rewrites?
- Should theme inference exist, or should users always choose a Professional Composer theme manually?
