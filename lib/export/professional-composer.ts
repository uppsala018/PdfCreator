export interface ComposerDiagnosticIssue {
  code: string
  severity: "info" | "warning" | "error"
  page_number?: number | null
  component?: string | null
  message: string
  suggested_fix: string
}

export interface ComposerDiagnostics {
  counts: {
    info: number
    warning: number
    error: number
  }
  issues: ComposerDiagnosticIssue[]
}

export function decodeDiagnosticsHeader(value: string | null): ComposerDiagnostics | null {
  if (!value) return null
  try {
    return JSON.parse(decodeURIComponent(value)) as ComposerDiagnostics
  } catch {
    return null
  }
}

export function summarizeDiagnostics(diagnostics: ComposerDiagnostics | null): string | null {
  if (!diagnostics) return null
  const warnings = diagnostics.counts.warning ?? 0
  const info = diagnostics.counts.info ?? 0
  if (warnings === 0 && info === 0) return null

  const parts = []
  if (warnings) parts.push(`${warnings} warning${warnings === 1 ? "" : "s"}`)
  if (info) parts.push(`${info} note${info === 1 ? "" : "s"}`)
  return `Professional export completed with ${parts.join(" and ")}.`
}
