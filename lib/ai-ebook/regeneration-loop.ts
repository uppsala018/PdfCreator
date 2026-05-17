import { diagnoseAiGeneratedStructure } from "@/lib/ai-ebook/diagnostics"
import type { AiStructureIssue } from "@/lib/ai-ebook/ebook-generation-schema"
import type { ComposerBlock, ComposerChapter, ComposerEbook } from "@/lib/export/project-to-schema"

export interface RegenerationLoopOptions {
  maxPasses?: number
  stopWhenWarningsAtOrBelow?: number
}

export interface RegenerationSuggestion {
  code: string
  target?: string
  action: string
  reason: string
}

export interface RegenerationPassHistory {
  pass: number
  beforeDiagnostics: AiStructureIssue[]
  afterDiagnostics: AiStructureIssue[]
  suggestions: RegenerationSuggestion[]
  changes: string[]
  improved: boolean
}

export interface RegenerationLoopResult {
  ebook: ComposerEbook
  initialDiagnostics: AiStructureIssue[]
  finalDiagnostics: AiStructureIssue[]
  passHistory: RegenerationPassHistory[]
  metadata: {
    maxPasses: number
    passesRun: number
    stoppedReason: "clean" | "max_passes" | "stabilized"
    initialScore: number
    finalScore: number
  }
}

const DEFAULT_MAX_PASSES = 2
const DEFAULT_WARNING_THRESHOLD = 0
const MAX_BLOCKS_PER_SECTION = 12
const MAX_TABLES_PER_CHAPTER = 2

export function runControlledRegenerationLoop(
  ebook: ComposerEbook,
  options: RegenerationLoopOptions = {}
): RegenerationLoopResult {
  const maxPasses = Math.max(0, Math.min(5, options.maxPasses ?? DEFAULT_MAX_PASSES))
  const warningThreshold = Math.max(0, options.stopWhenWarningsAtOrBelow ?? DEFAULT_WARNING_THRESHOLD)
  const initialDiagnostics = diagnoseAiGeneratedStructure(ebook)
  let current = cloneEbook(ebook)
  let currentDiagnostics = initialDiagnostics
  const passHistory: RegenerationPassHistory[] = []
  let stoppedReason: RegenerationLoopResult["metadata"]["stoppedReason"] = "clean"

  for (let pass = 1; pass <= maxPasses; pass += 1) {
    if (diagnosticsScore(currentDiagnostics) <= warningThreshold * 3 && errorCount(currentDiagnostics) === 0) {
      stoppedReason = "clean"
      break
    }

    const suggestions = suggestRegenerationImprovements(current, currentDiagnostics)
    if (suggestions.length === 0) {
      stoppedReason = "stabilized"
      break
    }

    const beforeScore = diagnosticsScore(currentDiagnostics)
    const application = applyRegenerationSuggestions(current, suggestions)
    const nextDiagnostics = diagnoseAiGeneratedStructure(application.ebook)
    const afterScore = diagnosticsScore(nextDiagnostics)
    const improved = afterScore < beforeScore

    passHistory.push({
      pass,
      beforeDiagnostics: currentDiagnostics,
      afterDiagnostics: nextDiagnostics,
      suggestions,
      changes: application.changes,
      improved,
    })

    current = application.ebook
    currentDiagnostics = nextDiagnostics

    if (!improved) {
      stoppedReason = "stabilized"
      break
    }

    stoppedReason = pass === maxPasses ? "max_passes" : "clean"
  }

  return {
    ebook: current,
    initialDiagnostics,
    finalDiagnostics: currentDiagnostics,
    passHistory,
    metadata: {
      maxPasses,
      passesRun: passHistory.length,
      stoppedReason,
      initialScore: diagnosticsScore(initialDiagnostics),
      finalScore: diagnosticsScore(currentDiagnostics),
    },
  }
}

export function suggestRegenerationImprovements(
  ebook: ComposerEbook,
  diagnostics: AiStructureIssue[]
): RegenerationSuggestion[] {
  const suggestions: RegenerationSuggestion[] = []

  for (const diagnostic of diagnostics) {
    switch (diagnostic.code) {
      case "SPARSE_EBOOK":
        suggestions.push({
          code: "ADD_SUPPORTING_CHAPTER",
          action: "add_chapter",
          reason: diagnostic.message,
        })
        break
      case "SPARSE_CHAPTER":
        suggestions.push({
          code: "REPAIR_SPARSE_CHAPTER",
          target: diagnostic.component,
          action: "add_section_blocks",
          reason: diagnostic.message,
        })
        break
      case "SUSPICIOUS_BLOCK_DENSITY":
      case "EXCESSIVE_CHAPTER_LENGTH":
        suggestions.push({
          code: "SPLIT_DENSE_STRUCTURE",
          target: diagnostic.component,
          action: "split_dense_sections",
          reason: diagnostic.message,
        })
        break
      case "REPETITIVE_HEADING":
        suggestions.push({
          code: "REDUCE_REPETITIVE_HEADING",
          target: diagnostic.component,
          action: "rename_duplicate_headings",
          reason: diagnostic.message,
        })
        break
      case "MISSING_BACK_COVER_CTA":
        suggestions.push({
          code: "STRENGTHEN_CTA",
          action: "add_back_cover_cta",
          reason: diagnostic.message,
        })
        break
      case "LONG_UNBROKEN_PROSE":
        suggestions.push({
          code: "SPLIT_OVERSIZED_BLOCK",
          target: diagnostic.component,
          action: "split_long_text_blocks",
          reason: diagnostic.message,
        })
        break
      case "MALFORMED_TABLE":
        suggestions.push({
          code: "NORMALIZE_TABLES",
          target: diagnostic.component,
          action: "normalize_tables",
          reason: diagnostic.message,
        })
        break
    }
  }

  suggestions.push(...suggestStructureBalance(ebook))
  return dedupeSuggestions(suggestions)
}

function applyRegenerationSuggestions(
  ebook: ComposerEbook,
  suggestions: RegenerationSuggestion[]
): { ebook: ComposerEbook; changes: string[] } {
  let next = cloneEbook(ebook)
  const changes: string[] = []

  for (const suggestion of suggestions) {
    switch (suggestion.action) {
      case "add_chapter":
        next = addSupportingChapter(next, changes)
        break
      case "add_section_blocks":
        next = repairSparseChapters(next, suggestion.target, changes)
        break
      case "split_dense_sections":
        next = splitDenseSections(next, suggestion.target, changes)
        break
      case "rename_duplicate_headings":
        next = renameDuplicateHeadings(next, changes)
        break
      case "add_back_cover_cta":
        next = strengthenBackCoverCta(next, changes)
        break
      case "split_long_text_blocks":
        next = splitLongTextBlocks(next, changes)
        break
      case "normalize_tables":
        next = normalizeTables(next, changes)
        break
      case "limit_excessive_tables":
        next = limitExcessiveTables(next, changes)
        break
    }
  }

  return { ebook: next, changes: Array.from(new Set(changes)) }
}

function addSupportingChapter(ebook: ComposerEbook, changes: string[]): ComposerEbook {
  if (ebook.chapters.length >= 2) return ebook
  changes.push("Added a supporting implementation chapter.")
  return {
    ...ebook,
    chapters: [
      ...ebook.chapters,
      {
        title: "Implementation Plan",
        intro: "Use this chapter to turn the ebook into a practical plan.",
        sections: [
          {
            title: "Next actions",
            blocks: [
              { type: "paragraph", text: "Choose one idea from the guide and turn it into a scheduled action." },
              { type: "bullet_list", items: ["Pick the highest-impact step.", "Define the owner.", "Set a review date."] },
              { type: "cta_box", text: "Use this implementation plan to complete one concrete next step." },
            ],
          },
        ],
      },
    ],
  }
}

function repairSparseChapters(ebook: ComposerEbook, target: string | undefined, changes: string[]): ComposerEbook {
  return {
    ...ebook,
    chapters: ebook.chapters.map((chapter) => {
      if (target && chapter.title !== target) return chapter
      const blockCount = countChapterBlocks(chapter)
      if (blockCount >= 3) return chapter
      changes.push(`Expanded sparse chapter "${chapter.title}".`)
      return {
        ...chapter,
        sections: [
          ...chapter.sections,
          {
            title: "Practical application",
            blocks: [
              { type: "paragraph", text: "This section turns the chapter idea into a concrete decision and action." },
              { type: "key_takeaway", text: "A useful chapter should leave the reader with one clear move." },
              { type: "prompt_block", text: `Create a checklist for applying "${chapter.title}" this week.` },
            ],
          },
        ],
      }
    }),
  }
}

function splitDenseSections(ebook: ComposerEbook, target: string | undefined, changes: string[]): ComposerEbook {
  return {
    ...ebook,
    chapters: ebook.chapters.map((chapter) => ({
      ...chapter,
      sections: chapter.sections.flatMap((section) => {
        if (target && section.title !== target && chapter.title !== target) return [section]
        if (section.blocks.length <= MAX_BLOCKS_PER_SECTION) return [section]
        changes.push(`Split dense section "${section.title}".`)
        const midpoint = Math.ceil(section.blocks.length / 2)
        return [
          { ...section, blocks: section.blocks.slice(0, midpoint) },
          { title: `${section.title} continued`, blocks: section.blocks.slice(midpoint) },
        ]
      }),
    })),
  }
}

function renameDuplicateHeadings(ebook: ComposerEbook, changes: string[]): ComposerEbook {
  const seen = new Map<string, number>()
  const rename = (heading: string, suffix: string) => {
    const key = heading.trim().toLowerCase()
    const count = (seen.get(key) ?? 0) + 1
    seen.set(key, count)
    if (count === 1) return heading
    changes.push(`Renamed duplicate heading "${heading}".`)
    return `${heading} ${suffix} ${count}`
  }

  return {
    ...ebook,
    chapters: ebook.chapters.map((chapter, chapterIndex) => ({
      ...chapter,
      title: rename(chapter.title, "part"),
      sections: chapter.sections.map((section, sectionIndex) => ({
        ...section,
        title: rename(section.title, `${chapterIndex + 1}.${sectionIndex + 1}`),
      })),
    })),
  }
}

function strengthenBackCoverCta(ebook: ComposerEbook, changes: string[]): ComposerEbook {
  if (ebook.back_cover_cta.trim()) return ebook
  changes.push("Added a back-cover CTA.")
  return {
    ...ebook,
    back_cover_title: ebook.back_cover_title || "Put this guide to work",
    back_cover_body:
      ebook.back_cover_body ||
      "Use the ideas in this ebook as a practical operating system for the next focused work session.",
    back_cover_cta: "Choose one next step and schedule it today.",
  }
}

function splitLongTextBlocks(ebook: ComposerEbook, changes: string[]): ComposerEbook {
  return mapBlocks(ebook, (block) => {
    if (!("text" in block) || block.text.length <= 1600) return [block]
    changes.push(`Split long ${block.type} block.`)
    return splitText(block.text, 900).map((text): ComposerBlock => ({ type: "paragraph", text }))
  })
}

function normalizeTables(ebook: ComposerEbook, changes: string[]): ComposerEbook {
  return mapBlocks(ebook, (block) => {
    if (block.type !== "comparison_table") return [block]
    const headers = block.headers.length >= 2 ? block.headers : ["Item", "Details"]
    const rows = block.rows.map((row) => [
      ...row.slice(0, headers.length),
      ...Array(Math.max(0, headers.length - row.length)).fill(""),
    ])
    const changed = headers.length !== block.headers.length || rows.some((row, index) => row.length !== block.rows[index]?.length)
    if (changed) changes.push("Normalized malformed comparison table.")
    return [{ type: "comparison_table", headers, rows: rows.length ? rows : [["Decision", "Recommended next step"]] }]
  })
}

function limitExcessiveTables(ebook: ComposerEbook, changes: string[]): ComposerEbook {
  return {
    ...ebook,
    chapters: ebook.chapters.map((chapter) => {
      let tableCount = 0
      return {
        ...chapter,
        sections: chapter.sections.map((section) => ({
          ...section,
          blocks: section.blocks.map((block) => {
            if (block.type !== "comparison_table") return block
            tableCount += 1
            if (tableCount <= MAX_TABLES_PER_CHAPTER) return block
            changes.push(`Converted extra table in "${chapter.title}" to a summary paragraph.`)
            return {
              type: "paragraph",
              text: `Table summary: ${block.headers.join(", ")}. ${block.rows.flat().join(" ")}`,
            }
          }),
        })),
      }
    }),
  }
}

function suggestStructureBalance(ebook: ComposerEbook): RegenerationSuggestion[] {
  const suggestions: RegenerationSuggestion[] = []
  for (const chapter of ebook.chapters) {
    const tableCount = chapter.sections.flatMap((section) => section.blocks).filter((block) => block.type === "comparison_table").length
    if (tableCount > MAX_TABLES_PER_CHAPTER) {
      suggestions.push({
        code: "EXCESSIVE_TABLES",
        target: chapter.title,
        action: "limit_excessive_tables",
        reason: `Chapter "${chapter.title}" contains ${tableCount} tables.`,
      })
    }
  }
  return suggestions
}

function mapBlocks(ebook: ComposerEbook, mapper: (block: ComposerBlock) => ComposerBlock[]): ComposerEbook {
  return {
    ...ebook,
    chapters: ebook.chapters.map((chapter) => ({
      ...chapter,
      sections: chapter.sections.map((section) => ({
        ...section,
        blocks: section.blocks.flatMap(mapper),
      })),
    })),
  }
}

function cloneEbook(ebook: ComposerEbook): ComposerEbook {
  return JSON.parse(JSON.stringify(ebook)) as ComposerEbook
}

function countChapterBlocks(chapter: ComposerChapter) {
  return chapter.sections.reduce((sum, section) => sum + section.blocks.length, 0)
}

function splitText(text: string, maxLength: number) {
  const parts: string[] = []
  let buffer = ""
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (buffer && `${buffer} ${sentence}`.length > maxLength) {
      parts.push(buffer)
      buffer = sentence
    } else {
      buffer = buffer ? `${buffer} ${sentence}` : sentence
    }
  }
  if (buffer) parts.push(buffer)
  return parts.length ? parts : [text.slice(0, maxLength)]
}

function diagnosticsScore(diagnostics: AiStructureIssue[]) {
  return diagnostics.reduce((score, diagnostic) => {
    if (diagnostic.severity === "error") return score + 10
    if (diagnostic.severity === "warning") return score + 3
    return score + 1
  }, 0)
}

function errorCount(diagnostics: AiStructureIssue[]) {
  return diagnostics.filter((diagnostic) => diagnostic.severity === "error").length
}

function dedupeSuggestions(suggestions: RegenerationSuggestion[]) {
  const seen = new Set<string>()
  return suggestions.filter((suggestion) => {
    const key = [suggestion.code, suggestion.target, suggestion.action].join(":")
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
