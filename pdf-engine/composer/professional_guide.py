"""Structured sample generator for the professional ebook composer."""

from __future__ import annotations

from pathlib import Path

from .renderer import render_ebook_pdf


def sample_structured_ebook() -> dict:
    """Return a realistic structured ebook fixture for composer development."""

    return {
        "title": "The Luxe\nEbook Composer",
        "subtitle": "A premium sample guide generated from structured ebook data.",
        "author": "Luxury typography, black-and-gold hierarchy, refined callouts, and layout-safe page rhythm for sellable PDF guides.",
        "brand": "Ebook Studio",
        "theme": "black_gold",
        "chapters": [
            {
                "title": "Luxury Comes From Composition",
                "intro": "A premium ebook starts with structure: elegant typography, calm whitespace, reusable components, and page rules that protect the reading experience.",
                "sections": [
                    {
                        "title": "Why composition matters",
                        "blocks": [
                            {
                                "type": "paragraph",
                                "text": "Great PDFs are not created by pouring text onto a page. They are assembled from deliberate sections, controlled callouts, refined tables, reusable prompt panels, and page-level rhythm. When the system understands the role of each block, it can protect headings, keep related content together, and make better decisions about where a page should break. This is the difference between a generated document that merely exports and a publishing system that composes.",
                            },
                            {
                                "type": "tip_box",
                                "text": "Keep headings close to the paragraph or component they introduce. Luxury layouts feel calm because spacing decisions are consistent.",
                            },
                            {
                                "type": "warning_box",
                                "text": "Do not let large tables, prompt blocks, or CTAs split awkwardly across pages unless the content is intentionally designed for it.",
                            },
                            {
                                "type": "key_takeaway",
                                "text": "The composer should prefer controlled page breaks, balanced grouping, and confident whitespace over maximum page density.",
                            },
                            {"type": "divider"},
                        ],
                    },
                    {
                        "title": "Component standards",
                        "blocks": [
                            {
                                "type": "paragraph",
                                "text": "Each content type carries its own spacing, padding, and page-break behavior so generated ebooks feel intentionally designed across chapters.",
                            },
                            {
                                "type": "comparison_table",
                                "headers": ["Component", "Design role", "Layout rule"],
                                "rows": [
                                    ["Callout box", "Adds emphasis without breaking reading flow.", "Keep together with balanced padding."],
                                    ["Prompt block", "Presents reusable AI instructions clearly.", "Use dark surface and monospaced text."],
                                    ["CTA block", "Closes a section with confident next action.", "Center text and avoid cramped edges."],
                                    ["Comparison table", "Helps readers scan differences quickly.", "Keep headers with rows and avoid splitting tiny tables."],
                                    ["Workflow step", "Turns advice into an action sequence.", "Group title and explanation together."],
                                ],
                            },
                        ],
                    },
                    {
                        "title": "Prompt-ready structure",
                        "blocks": [
                            {
                                "type": "paragraph",
                                "text": "AI generation should eventually produce structured blocks that map directly to these components.",
                            },
                            {
                                "type": "prompt_block",
                                "text": "Create a premium lead-magnet outline for a consultant. Return a title, promise, chapter sequence, signature framework, CTA, and three high-value worksheet prompts. Include one optional workbook exercise per chapter and describe how each exercise supports the buyer's next decision.",
                            },
                            {"type": "spacer", "size": "medium"},
                            {
                                "type": "cta_box",
                                "text": "Next step: map structured ebook data into this professional composer path.",
                            },
                            {
                                "type": "paragraph",
                                "text": "This sample is intentionally small. Future phases should add TOC variants, chapter openers, worksheets, citations, and layout quality diagnostics.",
                            },
                        ],
                    },
                ],
            },
            {
                "title": "Reusable Publishing Blocks",
                "intro": "A scalable ebook engine needs predictable blocks that can be rearranged, themed, and diagnosed without manual PDF surgery.",
                "sections": [
                    {
                        "title": "From content to components",
                        "blocks": [
                            {
                                "type": "paragraph",
                                "text": "Structured content lets the composer choose the right visual treatment for each idea instead of guessing from loose text. A paragraph remains readable prose, a warning becomes a designed callout, a table receives header styling and row padding, and a CTA is kept visually intact. The renderer can then add layout metadata to each decision, which is what makes later automated quality review possible.",
                            },
                            {
                                "type": "bullet_list",
                                "items": [
                                    "Paragraphs stay readable and consistent.",
                                    "Callouts preserve emphasis without breaking rhythm.",
                                    "Tables and prompts carry their own layout safety metadata.",
                                ],
                            },
                            {
                                "type": "workflow_step",
                                "title": "Publishing workflow",
                                "text": "Normalize the ebook model, render reusable components, run quality diagnostics, then export the finished PDF.",
                            },
                        ],
                    },
                    {
                        "title": "Navigation-ready output",
                        "blocks": [
                            {
                                "type": "paragraph",
                                "text": "The document index records chapters and sections so later phases can add clickable links, EPUB navigation, cross references, and editor jump targets.",
                            },
                            {
                                "type": "key_takeaway",
                                "text": "A strong composer is not only visual. It understands the document hierarchy well enough to build navigation and quality reports.",
                            },
                        ],
                    },
                ],
            },
            {
                "title": "Quality Before Scale",
                "intro": "The foundation should catch common publishing issues before a 50-page ebook reaches the user.",
                "sections": [
                    {
                        "title": "Diagnostics roadmap",
                        "blocks": [
                            {
                                "type": "numbered_list",
                                "items": [
                                    "Check structured data before rendering.",
                                    "Track component widths and safe bounds.",
                                    "Estimate pagination and register document hierarchy.",
                                    "Add rendered-page visual QA in a later phase.",
                                ],
                            },
                            {
                                "type": "cta_box",
                                "text": "Build once as a publishing system, then let AI and the editor feed it structured content.",
                            },
                        ],
                    }
                ],
            },
        ],
        "back_cover_title": "Designed for digital products",
        "back_cover_body": "The professional composer turns structured ebook content into elegant, branded, layout-safe PDFs that feel ready to sell.",
        "back_cover_cta": "ebook.studio / professional composer",
    }


def generate_sample_pdf(path: str | Path) -> str:
    """Generate the professional sample PDF and return its path."""

    output_path, _ = render_ebook_pdf(sample_structured_ebook(), path)
    return output_path


if __name__ == "__main__":
    target = Path(__file__).resolve().parents[1] / "professional_composer_sample.pdf"
    print(generate_sample_pdf(target))
