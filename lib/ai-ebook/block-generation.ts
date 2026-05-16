import type { ComposerBlock } from "@/lib/export/project-to-schema"
import type { AiBlockGeneration } from "./ebook-generation-schema"

const PROMPT_MARKERS = ["prompt:", "try this prompt", "copy/paste"]
const WARNING_MARKERS = ["warning", "avoid", "do not", "mistake"]
const TAKEAWAY_MARKERS = ["key takeaway", "remember", "principle"]

export function inferBlockTypes(text: string): ComposerBlock {
  const value = text.trim()
  const lower = value.toLowerCase()

  if (PROMPT_MARKERS.some((marker) => lower.includes(marker))) {
    return { type: "prompt_block", text: stripKnownPrefix(value) }
  }
  if (WARNING_MARKERS.some((marker) => lower.startsWith(marker))) {
    return { type: "warning_box", text: stripKnownPrefix(value) }
  }
  if (TAKEAWAY_MARKERS.some((marker) => lower.startsWith(marker))) {
    return { type: "key_takeaway", text: stripKnownPrefix(value) }
  }
  if (value.includes("\n- ") || value.startsWith("- ")) {
    return { type: "bullet_list", items: value.split(/\n- |^- /).map((item) => item.trim()).filter(Boolean) }
  }
  return { type: "paragraph", text: value }
}

export function generateCtaStructure(action: string, context?: string): ComposerBlock {
  const text = [context, action].filter(Boolean).join(" ")
  return {
    type: "cta_box",
    text: text || "Use this guide to take the next practical step.",
  }
}

export function generatePromptBlock(goal: string, audience?: string): ComposerBlock {
  const audienceClause = audience ? ` for ${audience}` : ""
  return {
    type: "prompt_block",
    text: `Create a practical, specific output${audienceClause}: ${goal}. Include assumptions, examples, and a clear next step.`,
  }
}

export function generateComparisonTable(headers: string[], rows: string[][]): ComposerBlock {
  const safeHeaders = headers.length >= 2 ? headers : ["Option", "Best use"]
  const safeRows = rows.length > 0 ? rows : [["Default", "Use when the section needs a quick decision aid."]]
  return { type: "comparison_table", headers: safeHeaders, rows: safeRows }
}

export function coerceLooseBlock(raw: AiBlockGeneration): ComposerBlock {
  if (!raw.type && "text" in raw && raw.text) return inferBlockTypes(String(raw.text))
  if (raw.type === "divider") return { type: "divider" }
  if (raw.type === "spacer") return { type: "spacer", size: raw.size === "small" || raw.size === "large" ? raw.size : "medium" }
  return inferBlockTypes(String("text" in raw ? raw.text ?? "" : ""))
}

function stripKnownPrefix(value: string): string {
  return value.replace(/^(prompt:|warning:?|key takeaway:?|remember:?)/i, "").trim()
}
