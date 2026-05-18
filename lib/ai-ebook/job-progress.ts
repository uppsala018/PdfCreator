import type { ProfessionalEbookPlan } from "@/lib/ai-ebook/generation-plan"

export type EbookJobStatus = "planning" | "generating" | "ready" | "failed" | "finalized" | string

export interface EbookJobProgressInput {
  status: EbookJobStatus
  currentChapterIndex: number
  plan?: Pick<ProfessionalEbookPlan, "chapterCount" | "totalPages" | "targetWords" | "warnings"> | null
}

export function ebookJobProgress(input: EbookJobProgressInput) {
  const totalChapters = Math.max(0, input.plan?.chapterCount ?? 0)
  const current = Math.max(0, input.currentChapterIndex)
  if (input.status === "failed") return { label: "Waiting for retry", percent: progressPercent(current, totalChapters) }
  if (input.status === "ready") return { label: "Quality pass complete", percent: 96 }
  if (input.status === "finalized") return { label: "Complete", percent: 100 }
  if (input.status === "planning") return { label: "Generating outline", percent: 8 }
  if (input.status === "generating") {
    return {
      label: totalChapters > 0
        ? `Generating chapter ${Math.min(current + 1, totalChapters)}/${totalChapters}`
        : "Generating chapters",
      percent: progressPercent(current, totalChapters),
    }
  }
  return { label: "Planning", percent: 0 }
}

function progressPercent(current: number, total: number) {
  if (total <= 0) return 12
  return Math.min(94, Math.max(12, Math.round(12 + (current / total) * 78)))
}
