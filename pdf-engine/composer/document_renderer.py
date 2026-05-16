"""Assemble structured ebook documents into ReportLab stories."""

from __future__ import annotations

from dataclasses import dataclass, field

from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, Spacer, Table, TableStyle

from .block_renderer import render_block
from .components import back_cover, chapter_header
from .document_index import DocumentIndex
from .layout import bounded_rule, cover_frame, safe_chapter_start, safe_section_block
from .pagination import PaginationState, estimate_chapter_units, estimate_section_units
from .quality import ComponentMetric, QualityIssue
from .schema import EbookDocument
from .styles import build_styles
from .themes import ComposerTheme, DEFAULT_THEME
from .toc import build_toc


@dataclass
class RenderedDocument:
    story: list = field(default_factory=list)
    component_metrics: list[ComponentMetric] = field(default_factory=list)
    issues: list[QualityIssue] = field(default_factory=list)
    index: DocumentIndex = field(default_factory=DocumentIndex)


def render_document(document: EbookDocument, theme: ComposerTheme = DEFAULT_THEME) -> RenderedDocument:
    rendered = RenderedDocument()
    pagination = PaginationState()
    rendered.story.extend(_cover_story(document, theme))
    rendered.component_metrics.append(ComponentMetric("cover_text_frame", "cover", cover_frame(theme)["text_width"], cover_frame(theme)["frame_width"], page_number=1))

    content_story = []

    for chapter_index, chapter in enumerate(document.chapters, start=1):
        chapter_page = pagination.start_new_page()
        rendered.index.register(chapter.title, 1, "chapter", estimated_page=chapter_page)
        content_story.append(safe_chapter_start([chapter_header(chapter_index, chapter.title, chapter.intro, theme)], theme))
        rendered.component_metrics.append(
            ComponentMetric(
                f"chapter_{chapter_index}",
                "chapter",
                cover_frame(theme)["frame_width"],
                cover_frame(theme)["frame_width"],
                estimated_height=42 * mm,
                keep_with_next=True,
                minimum_safe_spacing=58 * mm,
                pagination_priority=10,
            )
        )
        pagination.place(estimate_chapter_units(chapter))
        for section in chapter.sections:
            section_page = pagination.place(estimate_section_units(section))
            rendered.index.register(section.title, 2, "section", estimated_page=section_page)
            rendered.component_metrics.append(
                ComponentMetric(
                    section.title,
                    "section",
                    cover_frame(theme)["frame_width"],
                    cover_frame(theme)["frame_width"],
                    estimated_height=28 * mm,
                    keep_with_next=True,
                    minimum_safe_spacing=36 * mm,
                    pagination_priority=8,
                )
            )
            section_items = []
            for block in section.blocks:
                if block.type in {"heading", "subheading"} and (block.text or block.title):
                    rendered.index.register(block.text or block.title, 3 if block.type == "subheading" else 2, block.type, estimated_page=section_page)
                block_result = render_block(block, theme)
                section_items.extend(block_result.flowables)
                rendered.component_metrics.extend(block_result.metrics)
                rendered.issues.extend(block_result.issues)
            content_story.append(safe_section_block(section.title, section_items, theme))

    rendered.story.extend(build_toc(rendered.index, theme))
    rendered.story.extend(content_story)
    rendered.story.append(PageBreak())
    rendered.story.append(
        back_cover(
            document.back_cover_title or "Designed for digital products",
            document.back_cover_body or "Structured ebook content becomes elegant, branded, layout-safe PDFs.",
            document.back_cover_cta or f"{document.brand} / professional composer",
            theme,
        )
    )
    rendered.component_metrics.append(ComponentMetric("back_cover_panel", "back_cover", cover_frame(theme)["frame_width"], cover_frame(theme)["frame_width"]))
    return rendered


def _cover_story(document: EbookDocument, theme: ComposerTheme = DEFAULT_THEME) -> list:
    styles = build_styles(theme)
    geometry = cover_frame(theme)
    cover_content = [
        Paragraph((document.brand or "Ebook Studio").upper(), styles["cover_kicker"]),
        Paragraph(document.title.replace("\n", "<br/>"), styles["cover_title"]),
        bounded_rule(26 * mm, theme, thickness=0.45),
    ]
    if document.subtitle:
        cover_content.append(Paragraph(document.subtitle, styles["cover_subtitle"]))
    if document.author:
        cover_content.append(Paragraph(document.author, styles["cover_intro"]))
    cover_content.extend(
        [
            Spacer(1, 4 * mm),
            _cover_cta("Premium structure. Clean hierarchy. Ready for scalable ebook production.", theme),
        ]
    )

    cover_box = Table([[cover_content]], colWidths=[geometry["text_width"]])
    cover_box.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    return [Spacer(1, 54 * mm), cover_box, PageBreak()]


def _cover_cta(text: str, theme: ComposerTheme):
    styles = build_styles(theme)
    box = Table([[Paragraph(text, styles["cta"])]], colWidths=["100%"])
    box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), theme.near_black),
                ("BOX", (0, 0), (-1, -1), 0.45, theme.gold),
                ("LEFTPADDING", (0, 0), (-1, -1), 6 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), theme.cta_padding_y),
                ("BOTTOMPADDING", (0, 0), (-1, -1), theme.cta_padding_y),
            ]
        )
    )
    return box
