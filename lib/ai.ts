/**
 * Server-only AI generation module.
 *
 * API keys never reach the browser. User keys are passed in from API routes
 * after server-side settings lookup; env keys are resolved only inside the
 * provider runtime.
 */

import {
  resolveAIProvider,
  type ActiveProviderStatus,
  type UserAISettings,
} from "@/lib/ai-runtime/provider-resolution"

const SYSTEM_PROMPT = `You are a professional ebook writer and content creator.
Generate well-structured content using this plain-text format:

  # text        — heading
  ## text       — subheading
  > text        — pro tip (highlighted callout box)
  PROMPT: text  — prompt card (reader exercise, displayed in a special box)
  col | col     — table row (consecutive rows = one table)
  ---           — page break
  ===           — chapter divider (decorative break within a chapter)
  blank line    — separates blocks

Write in an engaging, authoritative tone. Use headings, pro tips, and prompt
cards to break up the content. Every response should be immediately usable
as ebook chapter content — no meta-commentary about what you are generating.`

export interface GenerateOptions {
  prompt: string
  context?: string
  model?: string | null
  preferredProviderId?: string | null
  userSettings?: UserAISettings | null
  userAnthropicKey?: string | null
  userOpenaiKey?: string | null
}

export interface GenerateResult {
  text: string
  provider: string
  model: string
  keySource: ActiveProviderStatus["keySource"]
}

export async function generateText(opts: GenerateOptions): Promise<GenerateResult> {
  const { prompt, context = "" } = opts
  const userSettings: UserAISettings = {
    ...(opts.userSettings ?? {}),
    anthropic_key: opts.userSettings?.anthropic_key ?? opts.userAnthropicKey,
    openai_key: opts.userSettings?.openai_key ?? opts.userOpenaiKey,
  }
  const resolved = resolveAIProvider({
    userSettings,
    preferredProviderId: opts.preferredProviderId,
    model: opts.model,
  })

  if (resolved.provider.config.kind === "mock") {
    throw new Error("NO_API_KEY: No AI provider is configured.")
  }

  const userContent = context
    ? `Context (existing chapter content):\n${context}\n\n---\n\nRequest: ${prompt}`
    : prompt
  const response = await resolved.provider.generateText({
    model: opts.model ?? undefined,
    maxOutputTokens: 2048,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
  })

  return {
    text: response.text,
    provider: response.providerId,
    model: response.model,
    keySource: resolved.status.keySource,
  }
}
