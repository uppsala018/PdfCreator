"""Structured ebook schema for the professional composer."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from .quality import QualityIssue, issue

BlockType = Literal[
    "paragraph",
    "heading",
    "subheading",
    "bullet_list",
    "numbered_list",
    "tip_box",
    "warning_box",
    "key_takeaway",
    "prompt_block",
    "comparison_table",
    "workflow_step",
    "cta_box",
    "divider",
    "spacer",
]

SUPPORTED_BLOCK_TYPES = {
    "paragraph",
    "heading",
    "subheading",
    "bullet_list",
    "numbered_list",
    "tip_box",
    "warning_box",
    "key_takeaway",
    "prompt_block",
    "comparison_table",
    "workflow_step",
    "cta_box",
    "divider",
    "spacer",
}

SUPPORTED_THEMES = {"black_gold", "default"}


@dataclass(frozen=True)
class EbookBlock:
    type: str
    text: str = ""
    title: str = ""
    items: list[str] = field(default_factory=list)
    headers: list[str] = field(default_factory=list)
    rows: list[list[str]] = field(default_factory=list)
    size: str = "medium"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class EbookSection:
    title: str
    blocks: list[EbookBlock] = field(default_factory=list)


@dataclass(frozen=True)
class EbookChapter:
    title: str
    intro: str = ""
    sections: list[EbookSection] = field(default_factory=list)


@dataclass(frozen=True)
class EbookDocument:
    title: str
    subtitle: str = ""
    author: str = ""
    brand: str = "Ebook Studio"
    theme: str = "black_gold"
    chapters: list[EbookChapter] = field(default_factory=list)
    back_cover_title: str = ""
    back_cover_body: str = ""
    back_cover_cta: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


def normalize_ebook(data: dict[str, Any]) -> tuple[EbookDocument, list[QualityIssue]]:
    """Normalize loose structured ebook JSON into dataclasses plus warnings."""

    warnings: list[QualityIssue] = []
    title = str(data.get("title") or "").strip()
    if not title:
        title = "Untitled Ebook"
        warnings.append(issue("MISSING_TITLE", "warning", "Ebook title is missing.", "Provide a title before production rendering."))

    theme = str(data.get("theme") or "black_gold").strip() or "black_gold"
    if theme not in SUPPORTED_THEMES:
        warnings.append(issue("INVALID_THEME", "warning", f"Theme '{theme}' is not supported.", "Use a known theme preset or add a theme resolver entry."))
    chapters = [_normalize_chapter(raw, index + 1, warnings) for index, raw in enumerate(data.get("chapters") or [])]
    if not chapters:
        warnings.append(issue("EMPTY_CHAPTERS", "warning", "Ebook has no chapters.", "Add at least one chapter with sections and blocks."))

    return (
        EbookDocument(
            title=title,
            subtitle=str(data.get("subtitle") or "").strip(),
            author=str(data.get("author") or "").strip(),
            brand=str(data.get("brand") or "Ebook Studio").strip() or "Ebook Studio",
            theme=theme,
            chapters=chapters,
            back_cover_title=str(data.get("back_cover_title") or "Designed for digital products").strip(),
            back_cover_body=str(data.get("back_cover_body") or "").strip(),
            back_cover_cta=str(data.get("back_cover_cta") or "").strip(),
            metadata=dict(data.get("metadata") or {}),
        ),
        warnings,
    )


def _normalize_chapter(raw: dict[str, Any], number: int, warnings: list[QualityIssue]) -> EbookChapter:
    title = str(raw.get("title") or "").strip()
    if not title:
        title = f"Chapter {number}"
        warnings.append(issue("MISSING_CHAPTER_TITLE", "warning", f"Chapter {number} is missing a title.", "Provide a chapter title.", component=f"chapter_{number}"))

    sections = [_normalize_section(section, number, index + 1, warnings) for index, section in enumerate(raw.get("sections") or [])]
    if not sections:
        warnings.append(issue("EMPTY_CHAPTER", "warning", f"{title} has no sections.", "Add at least one section.", component=title))

    return EbookChapter(title=title, intro=str(raw.get("intro") or "").strip(), sections=sections)


def _normalize_section(raw: dict[str, Any], chapter_number: int, section_number: int, warnings: list[QualityIssue]) -> EbookSection:
    title = str(raw.get("title") or "").strip()
    if not title:
        title = f"Section {chapter_number}.{section_number}"
        warnings.append(issue("MISSING_SECTION_TITLE", "warning", "A section is missing a title.", "Provide a section title.", component=title))

    blocks = [_normalize_block(block, warnings) for block in raw.get("blocks") or []]
    return EbookSection(title=title, blocks=blocks)


def _normalize_block(raw: dict[str, Any], warnings: list[QualityIssue]) -> EbookBlock:
    block_type = str(raw.get("type") or "paragraph").strip()
    if block_type not in SUPPORTED_BLOCK_TYPES:
        warnings.append(
            issue(
                "UNSUPPORTED_BLOCK_TYPE",
                "warning",
                f"Unsupported block type '{block_type}' will render as a warning placeholder.",
                "Map the block type to a supported composer component.",
                component=block_type,
            )
        )

    if block_type == "comparison_table":
        headers = [str(item) for item in raw.get("headers") or []]
        rows = [[str(cell) for cell in row] for row in raw.get("rows") or []]
        if not headers or any(len(row) != len(headers) for row in rows):
            warnings.append(issue("INVALID_TABLE", "warning", "Comparison table has invalid headers or rows.", "Provide headers and rows with matching column counts.", component="comparison_table"))

    if block_type == "prompt_block" and not str(raw.get("text") or "").strip():
        warnings.append(issue("EMPTY_PROMPT", "warning", "Prompt block is empty.", "Provide prompt text or remove the block.", component="prompt_block"))

    if block_type == "cta_box" and not str(raw.get("text") or "").strip():
        warnings.append(issue("EMPTY_CTA", "warning", "CTA block is empty.", "Provide CTA text or remove the block.", component="cta_box"))

    if block_type == "spacer" and str(raw.get("size") or "medium") not in {"small", "medium", "large"}:
        warnings.append(issue("INVALID_SPACER_SIZE", "warning", "Spacer size is invalid.", "Use small, medium, or large.", component="spacer"))

    return EbookBlock(
        type=block_type,
        text=str(raw.get("text") or "").strip(),
        title=str(raw.get("title") or "").strip(),
        items=[str(item).strip() for item in raw.get("items") or [] if str(item).strip()],
        headers=[str(item).strip() for item in raw.get("headers") or []],
        rows=[[str(cell).strip() for cell in row] for row in raw.get("rows") or []],
        size=str(raw.get("size") or "medium").strip(),
        metadata=dict(raw.get("metadata") or {}),
    )
