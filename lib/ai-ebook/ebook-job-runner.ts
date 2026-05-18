import { v4 as uuidv4 } from "uuid"
import { repairComposerEbookContent } from "@/lib/ai-ebook/content-quality"
import { composerEbookToEditorDraft } from "@/lib/ai-ebook/editor-draft"
import type { ProfessionalEbookPlan } from "@/lib/ai-ebook/generation-plan"
import { generateLiveStructuredChapters } from "@/lib/ai-ebook/live-chapter-generation"
import { generateLiveStructuredOutline } from "@/lib/ai-ebook/live-outline-generation"
import type { AIProviderAdapter } from "@/lib/ai-runtime/provider-interface"
import type { AiEbookGeneration, AiStructureIssue } from "@/lib/ai-ebook/ebook-generation-schema"
import type { ComposerChapter, ComposerEbook } from "@/lib/export/project-to-schema"

export interface EbookJobState {
  plan: ProfessionalEbookPlan
  outline?: AiEbookGeneration | null
  chapters: ComposerChapter[]
  diagnostics: AiStructureIssue[]
  currentChapterIndex: number
}

export async function runNextEbookJobStep(input: {
  state: EbookJobState
  provider: AIProviderAdapter
  model?: string
}) {
  const { state, provider, model } = input
  if (!state.outline) {
    const outline = await generateLiveStructuredOutline({
      topic: state.plan.topic,
      audience: state.plan.audience,
      tone: state.plan.tone,
      ebookType: state.plan.format,
      targetLength: state.plan.targetLength,
      outcome: state.plan.ctaGoal,
      theme: state.plan.theme,
      provider,
      model,
    })
    const plannedOutline = applyManualChapterPlan(outline.outline, state.plan)
    return {
      status: "generating" as const,
      outline: plannedOutline,
      chapters: state.chapters,
      diagnostics: [...state.diagnostics, ...outline.diagnostics],
      currentChapterIndex: 0,
      completed: false,
    }
  }

  const outlineChapters = state.outline.chapters ?? []
  if (state.currentChapterIndex >= outlineChapters.length) {
    return {
      status: "ready" as const,
      outline: state.outline,
      chapters: state.chapters,
      diagnostics: state.diagnostics,
      currentChapterIndex: state.currentChapterIndex,
      completed: true,
    }
  }

  const chapterOutline = outlineChapters[state.currentChapterIndex]
  const chapterResult = await generateLiveStructuredChapters({
    outline: { ...state.outline, chapters: [chapterOutline] },
    audience: state.plan.audience,
    tone: state.plan.tone,
    provider,
    model,
  })
  const quality = repairComposerEbookContent({
    ...chapterResult.composerReady,
    chapters: chapterResult.composerReady.chapters,
  })
  const chapter = quality.ebook.chapters[0]
  const chapters = chapter ? [...state.chapters, chapter] : state.chapters
  const nextIndex = state.currentChapterIndex + 1
  const completed = nextIndex >= outlineChapters.length

  return {
    status: completed ? "ready" as const : "generating" as const,
    outline: state.outline,
    chapters,
    diagnostics: [...state.diagnostics, ...chapterResult.diagnostics, ...quality.issues],
    currentChapterIndex: nextIndex,
    completed,
  }
}

export function assembleEbookFromJob(state: EbookJobState): ComposerEbook {
  const outline = state.outline
  const ebook: ComposerEbook = {
    title: outline?.title ?? state.plan.topic,
    subtitle: outline?.subtitle ?? `A professional guide for ${state.plan.audience || "readers"}.`,
    author: outline?.author ?? "",
    brand: outline?.brand ?? "Ebook Studio",
    theme: state.plan.theme === "luxury-black-gold" ? "black_gold" : "default",
    chapters: state.chapters,
    back_cover_title: outline?.cta?.title ?? "Next step",
    back_cover_body: outline?.cta?.body ?? `Use this ebook to apply ${state.plan.topic} with clarity.`,
    back_cover_cta: outline?.cta?.action ?? state.plan.ctaGoal ?? "Choose one next step.",
  }
  return repairComposerEbookContent(ebook).ebook
}

export function draftFromJob(state: EbookJobState) {
  return composerEbookToEditorDraft(assembleEbookFromJob(state))
}

function applyManualChapterPlan(outline: AiEbookGeneration, plan: ProfessionalEbookPlan): AiEbookGeneration {
  const manual = plan.chapters.filter((chapter) => !/^chapter\s+\d+$/i.test(chapter.title))
  if (manual.length === 0) {
    return {
      ...outline,
      metadata: { ...(outline.metadata ?? {}), professionalPlan: plan },
    }
  }

  return {
    ...outline,
    chapters: manual.map((chapter, index) => ({
      title: chapter.title,
      intro: `This chapter develops ${chapter.title} as part of ${plan.topic}.`,
      sections: outline.chapters?.[index]?.sections?.length
        ? outline.chapters[index].sections
        : Array.from({ length: chapter.sectionCount ?? plan.sectionCountPerChapter ?? 3 }, (_, sectionIndex) => ({
            title: `${chapter.title} ${sectionIndex + 1}`,
            blocks: [],
          })),
    })),
    metadata: { ...(outline.metadata ?? {}), professionalPlan: plan },
  }
}

export function projectContentFromJob(state: EbookJobState) {
  const draft = draftFromJob(state)
  return {
    projectType: "ebook" as const,
    chapters: draft.chapters.map((chapter) => ({
      ...chapter,
      id: chapter.id || uuidv4(),
    })),
    professionalJob: {
      plan: state.plan,
      diagnostics: state.diagnostics,
      finalizedAt: new Date().toISOString(),
    },
  }
}
