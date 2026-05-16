import type { AiEbookGeneration } from "./ebook-generation-schema"
import { diagnoseAiGeneratedStructure } from "./diagnostics"
import { normalizeAiEbookGeneration } from "./normalization"

export const simulatedAiEbookInput: AiEbookGeneration = {
  title: "Premium Client Onboarding System",
  subtitle: "A polished consultant guide for turning new buyers into confident clients.",
  author: "Ebook Studio AI",
  brand: "Ebook Studio",
  theme: "luxury-black-gold",
  format: "consultant-guide",
  chapters: [
    {
      title: "Create the First-Week Experience",
      intro: "The first week determines whether a client feels guided or uncertain.",
      sections: [
        {
          title: "What premium onboarding must do",
          blocks: [
            {
              type: "paragraph",
              text: "Premium onboarding gives the client a clear path, confirms what happens next, and removes decision fatigue before the work begins.",
            },
            {
              type: "tip_box",
              text: "Give every client one owner, one timeline, and one place to find the next action.",
            },
            {
              type: "comparison_table",
              headers: ["Weak onboarding", "Premium onboarding", "Client impact"],
              rows: [
                ["Long welcome email", "Short sequence with milestones", "The client knows what to expect"],
                ["Scattered links", "Single launch hub", "Fewer support questions"],
                ["Generic questionnaire", "Role-specific intake", "Cleaner delivery inputs"],
              ],
            },
          ],
        },
        {
          title: "The welcome sequence",
          blocks: [
            {
              type: "workflow_step",
              title: "Day one",
              text: "Send a short welcome note, confirm the main outcome, and link to the intake hub.",
            },
            {
              type: "prompt_block",
              text: "Create a premium client onboarding email for a consulting buyer. Include a warm welcome, the project outcome, three next steps, and a clear support boundary.",
            },
            { type: "unknown_block", text: "Warning: avoid asking the client to repeat information they already gave you." },
          ],
        },
      ],
    },
    {
      title: "Protect Delivery Quality",
      intro: "A strong delivery system turns expectations into calm execution.",
      sections: [
        {
          title: "Guardrails",
          blocks: [
            {
              type: "warning_box",
              text: "Do not promise instant turnaround unless the scope, owner, and approval path are already controlled.",
            },
            {
              type: "bullet_list",
              items: ["Define the review window.", "Name the decision owner.", "Set the revision boundary.", "Document the delivery format."],
            },
            {
              type: "key_takeaway",
              text: "Premium delivery is less about more communication and more about reducing ambiguity at each handoff.",
            },
          ],
        },
      ],
    },
  ],
  cta: {
    title: "Build the onboarding hub",
    body: "Turn the guide into a repeatable client onboarding workflow.",
    action: "Create the first version before your next client kickoff.",
    url: "ebook.studio/professional-composer",
  },
}

export function normalizedSimulatedAiEbook() {
  const normalized = normalizeAiEbookGeneration(simulatedAiEbookInput)
  return {
    ebook: normalized.ebook,
    issues: [...normalized.issues, ...diagnoseAiGeneratedStructure(normalized.ebook)],
  }
}
