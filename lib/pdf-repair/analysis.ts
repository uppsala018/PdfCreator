import type {
  PdfLayoutEditState,
  PdfRepairAnalysis,
  PdfRepairDiagnostic,
  PdfRepairDiagnosticSeverity,
} from "@/lib/project-schema"
import { generateRuleBasedRepairSuggestions } from "@/lib/pdf-repair/rule-based-suggestions"
import type { RepairSuggestion, RepairSuggestionSeverity } from "@/lib/pdf-repair/suggestions"

export interface AnalyzeImportedPdfLayoutInput {
  projectId?: string
  layout: PdfLayoutEditState
  pageCount?: number | null
  analyzedAt?: string
}

// This entry point intentionally remains metadata/layout based. Future
// rendered-page visual QA should produce PageVisualIssue records in
// render-analysis.ts, then map those issues into this repair-review model
// without changing export or directly applying fixes.
export function analyzeImportedPdfLayout(input: AnalyzeImportedPdfLayoutInput): PdfRepairAnalysis {
  const suggestions = generateRuleBasedRepairSuggestions({
    projectId: input.projectId,
    layout: input.layout,
    pageCount: input.pageCount,
  })
  const diagnostics = suggestions.map(suggestionToDiagnostic)
  const errorsCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length
  const warningsCount = diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length

  return {
    version: 1,
    analyzedAt: input.analyzedAt ?? new Date().toISOString(),
    diagnostics,
    suggestions,
    summary: {
      pagesAnalyzed: Math.max(0, input.pageCount ?? 0),
      issuesFound: diagnostics.length,
      suggestionsGenerated: suggestions.length,
      warningsCount,
      errorsCount,
    },
  }
}

function suggestionToDiagnostic(suggestion: RepairSuggestion): PdfRepairDiagnostic {
  return {
    id: `diagnostic:${suggestion.id}`,
    code: suggestion.issueCode,
    severity: diagnosticSeverity(suggestion.severity),
    message: suggestion.reason,
    pageIndex: suggestion.affectedPage.pageIndex,
    regionId: suggestion.affectedRegion?.blockId,
  }
}

function diagnosticSeverity(severity: RepairSuggestionSeverity): PdfRepairDiagnosticSeverity {
  if (severity === "critical" || severity === "high") return "error"
  if (severity === "medium") return "warning"
  return "info"
}
