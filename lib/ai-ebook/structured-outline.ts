import type { AiChapterGeneration, AiEbookGeneration, AiGenerationRequest, AiSectionGeneration } from "./ebook-generation-schema"
import { generateCtaStructure, generatePromptBlock } from "./block-generation"

const DEFAULT_CHAPTERS = 5

export function generateOutline(request: AiGenerationRequest): AiEbookGeneration {
  const topic = request.topic.trim() || "Professional Ebook"
  const audience = request.audience?.trim() || "busy readers"
  const outcome = request.outcome?.trim() || "make a confident decision"
  const chapterCount = clampInt(request.chapterCount ?? DEFAULT_CHAPTERS, 3, 8)

  return {
    title: titleCase(topic),
    subtitle: `A structured guide for ${audience} who want to ${outcome}.`,
    author: request.author,
    brand: request.brand ?? "Ebook Studio",
    theme: request.theme ?? "luxury-black-gold",
    format: request.format ?? "luxury-lead-magnet",
    chapters: Array.from({ length: chapterCount }, (_, index) =>
      generateChapterStructure({
        topic,
        audience,
        outcome,
        chapterNumber: index + 1,
        totalChapters: chapterCount,
      })
    ),
    cta: {
      title: "Next step",
      body: `Use the framework to apply ${topic} in one focused session.`,
      action: "Turn the checklist into an implementation plan.",
    },
  }
}

export function generateChapterStructure(input: {
  topic: string
  audience: string
  outcome: string
  chapterNumber: number
  totalChapters: number
}): AiChapterGeneration {
  const title = chapterTitle(input.topic, input.chapterNumber, input.totalChapters)
  const sections: AiSectionGeneration[] = [
    {
      title: "Core idea",
      blocks: [
        {
          type: "paragraph",
          text: `This section explains how ${input.topic} helps ${input.audience} move toward ${input.outcome} without creating unnecessary complexity.`,
        },
        {
          type: "key_takeaway",
          text: "Strong ebook chapters make one clear promise, then support it with examples, tools, and decisions.",
        },
      ],
    },
    {
      title: "Decision framework",
      blocks: [
        {
          type: "bullet_list",
          items: ["Define the reader's current obstacle.", "Show the practical choice they need to make.", "Give them a simple way to act."],
        },
        generatePromptBlock(`Draft a chapter exercise about ${input.topic}`, input.audience),
      ],
    },
  ]

  if (input.chapterNumber === input.totalChapters) {
    sections.push({
      title: "Implementation",
      blocks: [generateCtaStructure(`Apply the ${input.topic} system this week.`, "Choose one action and finish it before adding another idea.")],
    })
  }

  return {
    title,
    intro: `A practical chapter for turning ${input.topic} into something the reader can use.`,
    sections,
  }
}

function chapterTitle(topic: string, number: number, total: number): string {
  if (number === 1) return `The Promise of ${titleCase(topic)}`
  if (number === total) return "Putting the System to Work"
  const labels = ["The Reader's Starting Point", "The Signature Framework", "Tools, Examples, and Decisions", "Refinement and Delivery"]
  return labels[(number - 2) % labels.length]
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.round(value)))
}
