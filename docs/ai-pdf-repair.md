# AI-Assisted PDF Repair Architecture

## 1. Product Goal

Ebook Studio should support an assisted repair workflow for imported PDFs where a user can upload a flawed PDF and ask the system to analyze it for layout issues. The target is not one-click destructive automation. The target is a reviewable repair pipeline that combines rendered-page analysis, existing imported PDF diagnostics, and later AI semantic judgment to produce clear repair suggestions the user can inspect, preview, accept, skip, or send to manual review.

The system should eventually support a command such as "Analyze and suggest repairs" for imported PDF projects. Suggested repairs should help users identify issues such as blank pages, awkward page breaks, split tables, sparse pages, edge collisions, low contrast text, inconsistent spacing, orphan headings, oversized blocks, poor CTA placement, and general layout imbalance.

## 2. Scope

This architecture concerns the Imported PDF Repair Editor only. It should connect to the existing repair editor capabilities without rewriting the editor, export engine, or Professional Composer internals.

Current related capabilities:

- Imported PDF projects
- Page delete and restore
- Visual region move and copy
- Patch fill modes
- Diagnostics sidebar
- Text overlays
- Image overlays
- Normalized layout state
- Corrected PDF export

Out of scope for the current implementation:

- Live AI API calls
- OCR
- Automatic visual QA
- Full automatic fixing
- Blindly applying destructive edits
- Rewriting the PDF editor
- Changing the corrected PDF export engine
- Touching Professional Composer internals

## 3. Desired Workflow

The desired repair flow should be:

```text
Imported PDF
  -> rendered page analysis
  -> layout diagnostics
  -> AI repair suggestions
  -> user review
  -> apply selected fixes
  -> corrected PDF export
```

Workflow responsibilities:

- Imported PDF: preserve the original uploaded file and create or load an imported PDF project.
- Rendered page analysis: inspect page images, page bounds, existing overlay metadata, and layout metrics available from the repair editor.
- Layout diagnostics: collect rule-based warnings from the current diagnostics layer and future page-analysis heuristics.
- AI repair suggestions: convert diagnostics and semantic observations into structured, reviewable suggestions.
- User review: display suggestions with severity, confidence, affected page, affected region, reason, and proposed action.
- Apply selected fixes: translate accepted suggestions into normal `layoutEditState` operations.
- Corrected PDF export: export through the existing corrected PDF export path using the user's accepted edits.

## 4. Repair Suggestion Types

Repair suggestions should use a constrained action vocabulary. The initial schema should support these types:

- `delete_page`: propose deleting a page, typically for blank or accidental pages.
- `restore_page`: propose restoring a previously deleted page when diagnostics or review indicates it should be visible.
- `move_region`: propose moving a visual region to improve spacing, alignment, or placement.
- `resize_region`: propose resizing a region when content is too large, too close to an edge, or visually imbalanced.
- `add_text_overlay`: propose adding replacement text, labels, headings, captions, notes, or call-to-action text.
- `edit_text_overlay`: propose modifying an existing text overlay.
- `add_image_overlay`: propose adding a replacement image, logo, decorative element, or visual patch asset.
- `change_patch_fill`: propose changing the fill used to cover a source region after a visual repair.
- `flag_manual_review`: identify an issue that should be inspected by a user instead of automatically represented as an edit.
- `suggest_recompose_in_professional_composer`: recommend rebuilding the document through the Professional Composer path instead of continuing visual patch repair.

Each suggestion type should map either to an existing imported PDF editor action or to a non-destructive review flag. Unsupported edits should be represented as `flag_manual_review` until the editor has an explicit safe action for them.

## 5. Safety Rules

AI-assisted repair must be designed around user control and reversibility.

Required safety rules:

- Never auto-delete a page without user review.
- Never overwrite the original imported PDF.
- Store all accepted fixes as `layoutEditState`.
- Every AI-originated fix must be undoable through the existing undo/redo model.
- Let the user preview suggestions before applying them.
- Require explicit confirmation for destructive actions such as page deletion.
- Treat AI output as advisory, not authoritative.
- Keep skipped suggestions in suggestion history unless the user clears them.
- Allow users to apply suggestions individually or in selected batches.
- Prefer `flag_manual_review` when confidence is low, affected regions are ambiguous, or proposed changes could hide original content.

The repair assistant should never directly mutate the source PDF bytes. It should produce structured suggestions, then route accepted changes through the same edit and export mechanisms used by manual repair actions.

## 6. Data Model

Phase 1 should define a serializable repair suggestion schema without implementing automatic repair.

Suggested TypeScript direction:

```ts
type RepairSuggestionType =
  | "delete_page"
  | "restore_page"
  | "move_region"
  | "resize_region"
  | "add_text_overlay"
  | "edit_text_overlay"
  | "add_image_overlay"
  | "change_patch_fill"
  | "flag_manual_review"
  | "suggest_recompose_in_professional_composer";

type RepairSuggestionSeverity = "info" | "low" | "medium" | "high" | "critical";

type RepairSuggestionStatus = "pending" | "applied" | "skipped" | "dismissed";

interface RepairSuggestionRegion {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  coordinateSpace: "pdf_points" | "rendered_pixels" | "normalized";
}

interface RepairSuggestion {
  id: string;
  projectId: string;
  type: RepairSuggestionType;
  severity: RepairSuggestionSeverity;
  confidence: number;
  affectedPage: number;
  affectedRegion?: RepairSuggestionRegion;
  reason: string;
  proposedAction: {
    type: RepairSuggestionType;
    payload: Record<string, unknown>;
  };
  beforeMetadata?: Record<string, unknown>;
  afterMetadata?: Record<string, unknown>;
  status: RepairSuggestionStatus;
  source: "rule_based" | "ai_semantic" | "visual_qa" | "manual";
  createdAt: string;
  appliedAt?: string;
}
```

Model requirements:

- `confidence` should be a normalized `0` to `1` value.
- `affectedPage` should use the same page numbering convention as the imported PDF editor UI.
- `affectedRegion` should be optional because some suggestions apply to an entire page or whole document.
- `beforeMetadata` should describe the detected problem, such as blank-page score, edge distance, contrast estimate, or spacing metrics.
- `afterMetadata` should describe the intended result, preview parameters, or expected layout state delta.
- `status` should track whether a suggestion is pending, applied, skipped, or dismissed.
- `source` should distinguish diagnostics, AI review, visual QA, and user-created suggestions.

The final implementation can refine exact field names to match existing project and editor state conventions, but the persisted shape should remain explicit, auditable, and easy to render in a review UI.

## 7. Diagnostic Categories

Initial repair suggestions should be grounded in issue categories that can be explained to users.

Suggested diagnostic categories:

- Blank page
- Awkward page break
- Split table
- Sparse page
- Text too close to edge
- Low contrast text
- Inconsistent spacing
- Orphan heading
- Oversized block
- Bad CTA placement
- Layout imbalance
- Ambiguous visual issue requiring manual review

Each category should produce a reason string that explains the problem in plain language and links to the affected page or region where possible.

## 8. Rule-Based Diagnostics vs AI Semantic Review vs Repair Actions

The architecture should keep three responsibilities separate.

Rule-based diagnostics:

- Deterministic checks based on page geometry, rendered-page metrics, layout state, and existing diagnostics.
- Best for objective issues such as blank pages, sparse pages, edge distance, region overlap, and page deletion conflicts.
- Should produce stable, testable findings without requiring AI.

AI semantic review:

- Advisory interpretation of content and visual intent.
- Best for contextual issues such as awkward CTA placement, confusing hierarchy, orphan-looking headings, table meaning, or whether a document should be recomposed instead of patched.
- Should produce suggestions with confidence and reasons, but should not directly apply edits.

Actual repair actions:

- Concrete editor operations that change `layoutEditState`.
- Must be explicit, previewable, undoable, and routed through existing manual repair paths.
- Should only occur after user selection and confirmation when the action is destructive.

This separation prevents AI review from becoming an uncontrolled mutation layer and makes rule-based checks independently useful before AI is introduced.

## 9. Integration Points

The repair assistant should integrate with existing imported PDF systems rather than creating a parallel editor.

Imported PDF diagnostics:

- Reuse current diagnostics as the first source of repair candidates.
- Normalize diagnostic output into `RepairSuggestion` records.
- Add new diagnostic categories incrementally as rule-based checks mature.

`layoutEditState`:

- Store accepted fixes as normal layout edit state.
- Keep AI suggestion records separate from applied edit state until the user applies them.
- Preserve enough metadata to trace an applied edit back to the suggestion that created it.

Undo and redo:

- Applying a suggestion should create the same undoable edit transaction as a manual action.
- Batch application should be represented as a grouped transaction where the existing editor model supports it.
- Undo should revert the applied layout changes, not delete the suggestion history unexpectedly.

Text overlays:

- `add_text_overlay` and `edit_text_overlay` should route through existing text overlay creation and editing behavior.
- AI should suggest text content only when the source is known or the user provides the content. OCR is out of scope.

Image overlays:

- `add_image_overlay` should route through existing image overlay behavior.
- AI can suggest placement or need for an image, but sourcing or generating image assets is a separate future capability.

Patch fill:

- `change_patch_fill` should use existing patch fill modes.
- Suggestions should include the affected source region and the proposed fill mode.

Corrected PDF export:

- Export should continue to read from the accepted `layoutEditState`.
- Pending, skipped, or dismissed suggestions should not affect export.
- The original PDF should remain available and unchanged.

## 10. Phased Implementation

Phase 1: Architecture and suggestion schema only

- Add this architecture document.
- Define the repair suggestion vocabulary and schema direction.
- Do not add runtime code unless needed for documentation links.
- Do not call AI services.
- Do not apply automatic fixes.

Phase 2: Rule-based suggestion generator from existing diagnostics

- Convert existing imported PDF diagnostics into `RepairSuggestion` records.
- Add deterministic checks for blank pages, sparse pages, edge proximity, and layout-state conflicts where feasible.
- Keep suggestions pending until reviewed by the user.
- Add unit tests for suggestion generation.

Phase 3: Suggestion review UI

- Add a review panel or extend the diagnostics sidebar to show repair suggestions.
- Show severity, confidence, affected page, reason, preview target, and proposed action.
- Support apply, skip, dismiss, and manual-review states.
- Require confirmation before destructive operations.

Phase 4: Apply selected suggestions

- Map accepted suggestions to existing layout editor operations.
- Store all resulting changes in `layoutEditState`.
- Integrate with undo/redo.
- Support individual and selected batch application where safe.

Phase 5: AI semantic repair assistant

- Add AI review over structured diagnostics, page render summaries, and available document metadata.
- Ask AI for constrained `RepairSuggestion` output only.
- Validate AI output against the schema and action vocabulary.
- Downgrade invalid, ambiguous, or unsupported suggestions to `flag_manual_review`.

Phase 6: Rendered-page visual QA

- Add post-application visual review using rendered corrected pages.
- Compare before and after render metrics for regressions such as hidden content, edge collisions, contrast problems, and unexpected blank pages.
- Keep QA advisory until confidence and test coverage justify stronger automation.

## 11. Future Professional Composer Path

Some broken PDFs should not be patched visually. Documents with deeply flawed structure, widespread spacing problems, inaccessible text, poor semantic hierarchy, or many repeated layout failures may be better recreated through the Professional Ebook Composer.

Future direction:

```text
PDF
  -> extracted structure
  -> normalized ebook schema
  -> Professional Composer
  -> newly composed professional PDF
```

This should be presented as `suggest_recompose_in_professional_composer`, not as an automatic conversion in the repair editor. The current architecture should only reserve the suggestion type and explain the path. It should not implement PDF structure extraction, OCR, composer internals, or a migration pipeline yet.

## 12. Testing Strategy

Phase 1 requires no build or test run when only this document changes.

Future test coverage should include:

- Schema validation for all suggestion types.
- Rule-based suggestion generator fixtures.
- Review UI behavior for pending, applied, skipped, and dismissed suggestions.
- Confirmation requirements for destructive actions.
- Undo/redo behavior for applied suggestions.
- Corrected PDF export ignoring pending and skipped suggestions.
- Regression fixtures for blank pages, sparse pages, edge collisions, split tables, and orphan headings.

## 13. Strict Boundaries

Do not:

- Implement live AI API calls in Phase 1.
- Implement OCR.
- Implement automatic visual QA in Phase 1.
- Rewrite the PDF editor.
- Change the corrected PDF export engine.
- Apply automatic fixes.
- Touch Professional Composer internals.
- Mutate original PDFs.
- Bypass existing manual editor operations when applying accepted fixes in later phases.

