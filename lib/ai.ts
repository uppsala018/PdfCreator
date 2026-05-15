/**
 * Server-only AI generation module.
 *
 * Anthropic Claude is the primary provider; OpenAI is the fallback.
 * Keys are resolved in this order:
 *   1. Per-user key stored in user_settings (passed in via options)
 *   2. Server-level env var (ANTHROPIC_API_KEY / OPENAI_API_KEY)
 *
 * API keys never reach the browser — this file must only be imported
 * by API Route Handlers (app/api/**).
 */

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

// ─── Anthropic ────────────────────────────────────────────────────────────────

async function withAnthropic(
  apiKey: string,
  prompt: string,
  context: string
): Promise<string> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default
  const client = new Anthropic({ apiKey })

  const userContent = context
    ? `Context (existing chapter content):\n${context}\n\n---\n\nRequest: ${prompt}`
    : prompt

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  })

  const block = msg.content.find((c) => c.type === "text")
  if (!block || block.type !== "text") {
    throw new Error("Anthropic returned no text content")
  }
  return block.text.trim()
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

async function withOpenAI(
  apiKey: string,
  prompt: string,
  context: string
): Promise<string> {
  const OpenAI = (await import("openai")).default
  const client = new OpenAI({ apiKey })

  const userContent = context
    ? `Context (existing chapter content):\n${context}\n\n---\n\nRequest: ${prompt}`
    : prompt

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 2048,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: userContent },
    ],
  })

  const text = completion.choices[0]?.message?.content
  if (!text) throw new Error("OpenAI returned no text content")
  return text.trim()
}

// ─── Public entry point ───────────────────────────────────────────────────────

export interface GenerateOptions {
  prompt: string
  /** Existing chapter content shown as context to the model. */
  context?: string
  /** User-specific keys fetched server-side from user_settings. */
  userAnthropicKey?: string | null
  userOpenaiKey?: string | null
}

export type Provider = "anthropic" | "openai"

export interface GenerateResult {
  text: string
  provider: Provider
}

export async function generateText(opts: GenerateOptions): Promise<GenerateResult> {
  const { prompt, context = "", userAnthropicKey, userOpenaiKey } = opts

  const anthropicKey = userAnthropicKey || process.env.ANTHROPIC_API_KEY
  const openaiKey    = userOpenaiKey    || process.env.OPENAI_API_KEY

  if (anthropicKey) {
    const text = await withAnthropic(anthropicKey, prompt, context)
    return { text, provider: "anthropic" }
  }

  if (openaiKey) {
    const text = await withOpenAI(openaiKey, prompt, context)
    return { text, provider: "openai" }
  }

  // No key available — the API route converts this to a 503.
  throw new Error(
    "NO_API_KEY: No AI API key is configured. " +
    "Add your Anthropic or OpenAI key in Settings."
  )
}
