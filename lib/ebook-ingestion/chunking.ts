import { countWords } from "@/lib/ebook-ingestion/ingestion-diagnostics"
import type {
  ChunkingOptions,
  SourceChunk,
  SourceDocument,
  SourceSection,
} from "@/lib/ebook-ingestion/source-types"

const DEFAULT_TARGET_WORDS = 700
const DEFAULT_MAX_WORDS = 1000

export function chunkSourceDocument(
  document: SourceDocument,
  options: ChunkingOptions = {}
): SourceChunk[] {
  const targetWords = options.targetWords ?? DEFAULT_TARGET_WORDS
  const maxWords = options.maxWords ?? DEFAULT_MAX_WORDS
  const chunks: SourceChunk[] = []
  let currentSections: SourceSection[] = []
  let currentWords = 0

  for (const section of document.sections) {
    const sectionText = sectionToText(section)
    const sectionWords = countWords(sectionText)

    if (currentSections.length > 0 && currentWords + sectionWords > maxWords) {
      chunks.push(makeChunk(chunks.length, currentSections))
      currentSections = []
      currentWords = 0
    }

    if (sectionWords > maxWords) {
      chunks.push(...chunkOversizedSection(section, chunks.length, targetWords))
      continue
    }

    currentSections.push(section)
    currentWords += sectionWords

    if (currentWords >= targetWords) {
      chunks.push(makeChunk(chunks.length, currentSections))
      currentSections = []
      currentWords = 0
    }
  }

  if (currentSections.length > 0) {
    chunks.push(makeChunk(chunks.length, currentSections))
  }

  return chunks
}

function chunkOversizedSection(
  section: SourceSection,
  startIndex: number,
  targetWords: number
): SourceChunk[] {
  const chunks: SourceChunk[] = []
  let buffer: string[] = []
  let words = 0

  for (const block of section.blocks) {
    const blockWords = countWords(block.text)
    if (buffer.length > 0 && words + blockWords > targetWords) {
      chunks.push(makeTextChunk(startIndex + chunks.length, [section.id], buffer.join("\n\n")))
      buffer = []
      words = 0
    }
    buffer.push(block.text)
    words += blockWords
  }

  if (buffer.length > 0) {
    chunks.push(makeTextChunk(startIndex + chunks.length, [section.id], buffer.join("\n\n")))
  }

  return chunks
}

function makeChunk(index: number, sections: SourceSection[]): SourceChunk {
  return makeTextChunk(
    index,
    sections.map((section) => section.id),
    sections.map(sectionToText).join("\n\n")
  )
}

function makeTextChunk(index: number, sectionIds: string[], text: string): SourceChunk {
  const wordCount = countWords(text)
  return {
    id: `source-chunk-${index + 1}`,
    sectionIds,
    text,
    wordCount,
    estimatedTokens: Math.ceil(wordCount * 1.35),
  }
}

function sectionToText(section: SourceSection) {
  const body = section.blocks.map((block) => block.text).filter(Boolean).join("\n\n")
  return body ? `${"#".repeat(section.depth)} ${section.title}\n\n${body}` : `${"#".repeat(section.depth)} ${section.title}`
}
