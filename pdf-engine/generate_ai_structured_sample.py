"""Generate a simulated AI-structured ebook through the professional composer."""

from __future__ import annotations

from pathlib import Path

from composer.renderer import render_ebook_pdf


def simulated_ai_structured_ebook() -> dict:
    """Fixture matching the canonical AI-generation shape used by the TS layer."""

    return {
        "title": "Premium Client Onboarding System",
        "subtitle": "A polished consultant guide generated from structured AI-ready ebook data.",
        "author": "Ebook Studio AI",
        "brand": "Ebook Studio",
        "theme": "black_gold",
        "chapters": [
            {
                "title": "Create the First-Week Experience",
                "intro": "The first week determines whether a client feels guided or uncertain.",
                "sections": [
                    {
                        "title": "What premium onboarding must do",
                        "blocks": [
                            {
                                "type": "paragraph",
                                "text": "Premium onboarding gives the client a clear path, confirms what happens next, and removes decision fatigue before the work begins.",
                            },
                            {
                                "type": "tip_box",
                                "text": "Give every client one owner, one timeline, and one place to find the next action.",
                            },
                            {
                                "type": "comparison_table",
                                "headers": ["Weak onboarding", "Premium onboarding", "Client impact"],
                                "rows": [
                                    ["Long welcome email", "Short sequence with milestones", "The client knows what to expect"],
                                    ["Scattered links", "Single launch hub", "Fewer support questions"],
                                    ["Generic questionnaire", "Role-specific intake", "Cleaner delivery inputs"],
                                ],
                            },
                        ],
                    },
                    {
                        "title": "The welcome sequence",
                        "blocks": [
                            {
                                "type": "workflow_step",
                                "title": "Day one",
                                "text": "Send a short welcome note, confirm the main outcome, and link to the intake hub.",
                            },
                            {
                                "type": "prompt_block",
                                "text": "Create a premium client onboarding email for a consulting buyer. Include a warm welcome, the project outcome, three next steps, and a clear support boundary.",
                            },
                            {
                                "type": "warning_box",
                                "text": "Avoid asking the client to repeat information they already gave you.",
                            },
                        ],
                    },
                ],
            },
            {
                "title": "Protect Delivery Quality",
                "intro": "A strong delivery system turns expectations into calm execution.",
                "sections": [
                    {
                        "title": "Guardrails",
                        "blocks": [
                            {
                                "type": "warning_box",
                                "text": "Do not promise instant turnaround unless the scope, owner, and approval path are already controlled.",
                            },
                            {
                                "type": "bullet_list",
                                "items": [
                                    "Define the review window.",
                                    "Name the decision owner.",
                                    "Set the revision boundary.",
                                    "Document the delivery format.",
                                ],
                            },
                            {
                                "type": "key_takeaway",
                                "text": "Premium delivery is less about more communication and more about reducing ambiguity at each handoff.",
                            },
                            {
                                "type": "cta_box",
                                "text": "Create the first version of your onboarding hub before your next client kickoff.",
                            },
                        ],
                    }
                ],
            },
        ],
        "back_cover_title": "Build the onboarding hub",
        "back_cover_body": "Turn this guide into a repeatable client onboarding workflow.",
        "back_cover_cta": "ebook.studio/professional-composer",
    }


if __name__ == "__main__":
    target = Path(__file__).resolve().parent / "ai_structured_sample.pdf"
    path, report = render_ebook_pdf(simulated_ai_structured_ebook(), target)
    counts = report.counts()
    print(path)
    print(
        "AI structured sample diagnostics: "
        f"errors={counts['error']}, warnings={counts['warning']}, info={counts['info']}"
    )
