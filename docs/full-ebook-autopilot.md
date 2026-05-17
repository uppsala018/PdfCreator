# Full Professional Ebook Autopilot Architecture

## 1. Product Goal

Ebook Studio should eventually let a user ask for a complete, professional, sellable ebook from scratch and receive a polished PDF that is more than AI text placed into a document. The target workflow is a publishing system:

```text
User prompt, source text, or uploaded content
  -> structured ebook planning
  -> chapter and block generation
  -> schema normalization and repair
  -> Professional Composer rendering
  -> diagnostics and quality review
  -> bounded iterative improvement
  -> user review and editing
  -> final professional PDF export
```

The key product insight is that high-quality generated PDFs come from a loop, not a single prompt. The system must create content, structure it, render it, inspect diagnostics, adjust content and layout choices, regenerate, and stop with a reviewable final version.

This architecture is provider-agnostic. It must not assume OpenAI, Anthropic, Gemini, OpenRouter, Mistral, or any one model as the permanent backend.

## 2. Product Boundary

Full Ebook Autopilot creates or rebuilds structured professional ebooks. It is different from Imported PDF Repair.

Imported PDF Repair fixes existing PDFs while preserving the uploaded PDF as the visual source. It uses page deletion, visual regions, overlays, patch fills, diagnostics, and corrected PDF export.

Full Ebook Autopilot starts from a topic, text source, outline, or imported content and creates a structured ebook project that can be rendered by the Professional Composer. It may later use PDF-to-Composer recomposition for source PDFs, but it should not replace the imported PDF repair editor.

Existing simulated draft generation should remain available while the autopilot matures.

## 3. Input Modes

Initial and future input modes should include:

- Topic prompt
- Pasted text
- Uploaded `.txt`
- Uploaded `.md`
- Uploaded outline
- Imported existing ebook content
- User-provided brand, CTA, website, product, author, and audience information
- Uploaded `.docx` later, if parsing quality is acceptable
- Uploaded PDF later through the PDF Repair/Recompose path, not through the initial text ingestion path

Input metadata should capture:

- Target reader
- Reader problem or desired transformation
- Ebook promise
- Tone and style
- Target length
- Theme preset
- CTA goal
- Brand colors or brand voice
- Product/service details
- Required sections or exclusions
- Source material priority: strict source preservation versus AI-assisted expansion

## 4. Provider-Agnostic AI Layer

The autopilot needs a server-side AI adapter layer. API keys must never be exposed client-side.

Supported provider targets:

- OpenAI
- Anthropic
- OpenRouter
- Gemini
- Mistral
- Local or custom OpenAI-compatible endpoints
- Future adapters

Suggested provider interface:

```ts
interface AiProviderAdapter {
  id: string;
  displayName: string;
  supportsStructuredJson: boolean;
  supportsToolCalls?: boolean;
  supportsVision?: boolean;
  listModels(): Promise<AiModelDescriptor[]>;
  generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<StructuredGenerationResult<T>>;
  generateText(request: TextGenerationRequest): Promise<TextGenerationResult>;
}

interface AiModelDescriptor {
  id: string;
  label: string;
  contextWindow?: number;
  recommendedFor?: Array<"planning" | "drafting" | "repair" | "cleanup" | "long_context">;
}
```

Provider configuration should support:

- Provider ID
- Model selector
- Base URL for compatible endpoints
- API key lookup from user settings or server secrets
- Organization/project headers where required
- Structured JSON mode when supported
- Prompted JSON with schema repair when native structured output is unavailable
- Fallback provider and fallback model
- Retry strategy with exponential backoff
- JSON repair and validation retry
- Diagnostic logging without storing raw secrets

The adapter should return normalized errors so the UI can distinguish authentication failure, provider outage, invalid JSON, safety refusal, rate limits, and context-length issues.

## 5. Full Generation Pipeline

### A. Intake

Collect the source and product intent:

- Topic or uploaded/pasted source text
- Audience
- Style preset
- Target length
- Brand/CTA/website/product information
- Theme
- Provider and model
- Source preservation level

The intake output should be a `SourceDocument` plus generation settings. Uploaded or pasted content should be preserved separately from generated drafts.

### B. Planning

Generate a structured plan before drafting:

- Ebook promise
- Target reader
- Reader pain points
- Transformation or outcome
- Chapter outline
- Section structure
- CTA strategy
- Table/callout opportunities
- Required examples, workflows, and prompts
- Source material coverage plan

Planning should be validated before long-form drafting starts. Weak plans should be repaired or sent to user review.

### C. Drafting

Generate chapters and sections as structured blocks supported by the Professional Composer:

- `paragraph`
- `heading`
- `subheading`
- `bullet_list`
- `numbered_list`
- `tip_box`
- `warning_box`
- `key_takeaway`
- `prompt_block`
- `comparison_table`
- `workflow_step`
- `cta_box`

Drafting should happen in chunks, usually chapter-by-chapter, to keep context controllable and make retries cheap. Each chunk should include local continuity constraints and global outline context.

### D. Normalization

Run all AI output through normalization before editor or composer usage:

- Repair malformed AI JSON
- Validate required fields
- Split oversized blocks
- Validate tables
- Add missing CTAs where required
- Reduce repetition
- Enforce safe block lengths
- Normalize unsupported block names into supported schema
- Remove empty sections
- Preserve source citations or source notes when available

Normalization diagnostics should be stored and shown later. Normalization may repair shape and formatting, but semantic changes should remain explicit.

### E. Composition

Render through the existing Professional Composer:

- Apply selected theme
- Map structured blocks to composer components
- Generate cover, TOC, chapters, headers, footers, CTAs, and back cover
- Generate PDF through ReportLab
- Return composer diagnostics

Composition should remain deterministic for the same normalized input, theme, and settings.

### F. Quality Review

Review both content and rendered output. Diagnostics should be structured and severity-ranked.

Categories:

- Content quality
- Structure quality
- Design/layout quality
- Readability
- CTA strength
- Repetition
- Page density
- Visual hierarchy
- Table and callout placement
- Citation/source gaps
- Export readiness

Concrete diagnostics:

- Missing or weak ebook promise
- Unclear target reader
- Thin chapters
- Overlong sections
- Repeated headings
- Repetitive paragraphs
- Missing CTA
- Weak CTA specificity
- Table split risk
- Sparse pages
- Overdense pages
- Orphan headings
- Unbalanced chapter lengths
- Missing examples or workflows
- Unsupported block fallback
- Citation/source gap

### G. Iterative Improvement

The improvement loop should be bounded:

```text
Normalized ebook schema
  -> Professional Composer render
  -> diagnostics
  -> AI/engine improvement proposal
  -> reviewed schema/layout adjustments
  -> regenerate
```

The AI should receive diagnostics and propose targeted changes. The engine should handle deterministic layout adjustments where possible, such as splitting blocks, moving CTAs, shortening table labels, or inserting page breaks. The AI should handle semantic improvements such as reducing repetition, strengthening examples, improving CTA copy, or restructuring a weak chapter.

### H. User Review

The user should see:

- Ebook summary
- Outline
- Theme
- Provider/model used
- Diagnostics
- Improvement pass history
- What changed between versions
- Export readiness

The user can accept, edit, regenerate, choose another provider/model, or export.

## 6. Perplexity-Like Loop Summary

The reference behavior to reproduce is not a single AI response. It is a controlled publishing loop:

1. Create content from a prompt or source.
2. Structure the ebook into chapters, sections, and blocks.
3. Render the structure through ReportLab components.
4. Check layout, pagination, tables, boxes, spacing, footnotes, hierarchy, and typography.
5. Adjust schema and composition choices.
6. Regenerate.
7. Repeat for a limited number of passes.
8. Present a polished, editable final PDF.

Ebook Studio should divide this loop between AI and deterministic systems. AI handles planning, drafting, rewrite proposals, and semantic cleanup. The normalization pipeline, Professional Composer, and diagnostics system handle schema safety, layout rules, component rendering, and quality gates.

## 7. Iterative Loop Safety

Safety rules:

- Set a maximum pass count.
- Stop when diagnostics are below a configured severity threshold.
- Stop when repeated passes do not improve quality.
- Preserve original user text and uploaded source files.
- Store every generated version.
- Show what changed between versions.
- Require user approval for major semantic rewrites.
- Never let diagnostics auto-destroy source content.
- Keep final export user-triggered.
- Allow rollback to any generated version.
- Keep provider/model metadata with each version.

Recommended initial limits:

- Planning retries: 2
- Draft JSON repair retries per chunk: 2
- Composer improvement passes: 2 or 3
- Hard job timeout by target length

## 8. File Upload Text Ingestion

First supported upload formats should be `.txt` and `.md`.

Ingestion steps:

- Validate file type and size.
- Decode text safely.
- Sanitize control characters and unsafe embedded content.
- Preserve original source text.
- Convert to a `SourceDocument`.
- Optionally detect Markdown headings.
- Optionally detect lists and simple tables.
- Optionally summarize or structure long source material before drafting.
- Map detected structure into an outline or initial ebook schema candidate.

`.docx` should come later after parser choice and formatting fidelity are evaluated.

PDF source content should be handled by the PDF Repair/Recompose path, not by the initial file-text ingestion path. OCR remains out of scope for this architecture phase.

## 9. Future UI

Add a "Create Complete Ebook" wizard.

Wizard steps:

- Input source: topic, pasted text, upload, outline, existing content
- Audience
- Style or preset
- Target length
- Theme
- CTA, website, product, author, and brand details
- Provider and model
- Generate
- Review diagnostics
- Edit generated content
- Regenerate selected sections or whole ebook
- Export professional PDF

The UI should make the current job state clear: intake, planning, drafting, normalizing, composing, reviewing, improving, ready, failed, or canceled.

## 10. Database and Project Strategy

Suggested persisted concepts:

- Generation job
- Generation status
- Source input reference
- Sanitized source document
- Generation settings
- Provider/model metadata
- Generated structured schema
- Diagnostics history
- Version history
- Improvement pass history
- Final project chapters
- Export readiness state

Possible job statuses:

- `queued`
- `intake_ready`
- `planning`
- `drafting`
- `normalizing`
- `composing`
- `reviewing`
- `improving`
- `ready_for_user`
- `failed`
- `canceled`

Version history should store enough information to compare versions and recover earlier outputs. Final accepted content should map into normal project chapters so the existing editor and Professional Composer export remain useful.

## 11. Phased Implementation

Phase 1: architecture doc only

- Define the full autopilot pipeline, provider requirements, input modes, safety rules, persistence needs, and UI direction.
- Do not change runtime behavior.

Phase 2: provider-agnostic AI adapter architecture

- Add server-side adapter interfaces.
- Support provider config, model selection, base URL, structured JSON capability, fallback provider, retries, and normalized errors.
- Keep API keys server-side.

Phase 3: `.txt` and `.md` upload ingestion

- Add file intake, sanitization, source preservation, and optional heading/list detection.
- Convert uploads into `SourceDocument` records.

Phase 4: live structured outline generation

- Generate ebook promise, target reader, chapter outline, section structure, and CTA plan.
- Validate and repair outline JSON.

Phase 5: full chapter generation

- Generate structured chapters and supported composer block types.
- Normalize malformed blocks, validate tables, split oversized content, and reduce repetition.

Phase 6: composer render and diagnostics loop

- Render generated schema through Professional Composer.
- Collect content, structure, layout, pagination, CTA, and export-readiness diagnostics.

Phase 7: iterative improvement pass

- Feed diagnostics into bounded AI/engine improvement.
- Store changed versions and stop after configured pass limits.

Phase 8: UI wizard

- Build the "Create Complete Ebook" workflow with source input, audience, style, target length, theme, CTA, provider/model, generation status, diagnostics, edit, regenerate, and export.

Phase 9: version history and export readiness

- Add version comparison, rollback, diagnostics history, provider/model audit trail, and final export readiness checks.

## 12. Strict Boundaries

Do not implement in the architecture phase:

- Live AI calls
- OCR
- `.docx` parsing unless a later phase chooses a parser
- Editor rewrite
- Composer rewrite
- Unlimited autonomous loops
- Single-provider lock-in
- Client-side API key exposure
- Removal of existing simulated draft generation
- Replacement of imported PDF repair

The autopilot should build on existing systems: structured schema, AI normalization/repair, editor integration, Professional Composer, diagnostics, and export.

## 13. Open Questions

- Should full autopilot generation jobs be stored in the existing `projects` table immediately or in a separate `generation_jobs` table first?
- How much source preservation should be the default for pasted or uploaded text?
- Which providers should be enabled first in settings?
- Should users select provider/model per job, or should the app choose defaults by task stage?
- What is the minimum diagnostics threshold for "export ready"?
- Should the first iterative loop modify only structure/layout, or also content semantics?
- How should version diffs be shown for structured ebook blocks?
- How should pricing/usage limits be represented for multi-pass generation?
