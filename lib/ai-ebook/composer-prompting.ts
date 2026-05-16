import type { AiEbookFormat, AiGenerationRequest } from "./ebook-generation-schema"

export interface ComposerPromptTemplate {
  id: AiEbookFormat
  label: string
  systemInstruction: string
  structureInstruction: string
}

export const COMPOSER_PROMPT_TEMPLATES: Record<AiEbookFormat, ComposerPromptTemplate> = {
  "luxury-lead-magnet": {
    id: "luxury-lead-magnet",
    label: "Luxury lead magnet",
    systemInstruction: "Create a polished, high-value lead magnet with concise chapters, refined callouts, practical prompts, and one clear CTA.",
    structureInstruction: "Return title, subtitle, chapters, sections, paragraphs, key_takeaway blocks, prompt_block blocks, comparison_table blocks, and a final CTA.",
  },
  workbook: {
    id: "workbook",
    label: "Workbook",
    systemInstruction: "Create a hands-on workbook with short teaching sections, workflow steps, reflection prompts, and implementation CTAs.",
    structureInstruction: "Return numbered_list blocks for steps, prompt_block blocks for exercises, workflow_step blocks for actions, and cta_box blocks for checkpoints.",
  },
  "consultant-guide": {
    id: "consultant-guide",
    label: "Consultant guide",
    systemInstruction: "Create an authoritative consultant guide with frameworks, comparison tables, risk callouts, and action-oriented recommendations.",
    structureInstruction: "Return comparison_table, warning_box, tip_box, key_takeaway, and workflow_step blocks alongside concise paragraphs.",
  },
  "cinematic-ebook": {
    id: "cinematic-ebook",
    label: "Cinematic ebook",
    systemInstruction: "Create a dramatic but readable ebook with strong chapter arcs, premium headings, memorable takeaways, and restrained CTA placement.",
    structureInstruction: "Return chapter intros, section headings, paragraph blocks, key_takeaway blocks, and prompt_block blocks for reader action.",
  },
  "educational-handbook": {
    id: "educational-handbook",
    label: "Educational handbook",
    systemInstruction: "Create a clear teaching handbook with definitions, examples, ordered steps, tables, and review prompts.",
    structureInstruction: "Return heading, subheading, paragraph, bullet_list, numbered_list, comparison_table, tip_box, and prompt_block blocks.",
  },
}

export function buildComposerPrompt(request: AiGenerationRequest): string {
  const template = COMPOSER_PROMPT_TEMPLATES[request.format ?? "luxury-lead-magnet"]
  return [
    template.systemInstruction,
    template.structureInstruction,
    "Output JSON only. Do not output markdown prose.",
    "Use only canonical block types: paragraph, heading, subheading, bullet_list, numbered_list, tip_box, warning_box, key_takeaway, prompt_block, comparison_table, workflow_step, cta_box, divider, spacer.",
    `Topic: ${request.topic}`,
    `Audience: ${request.audience ?? "not specified"}`,
    `Outcome: ${request.outcome ?? "not specified"}`,
    `Preferred chapters: ${request.chapterCount ?? "model decides"}`,
  ].join("\n")
}
