"""Public structured ebook rendering pipeline."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from reportlab.lib.units import mm

from .document_renderer import render_document
from .layout import cover_frame, create_document, draw_bounded_rule, draw_panel_frame, draw_page_header_footer
from .pagination import summarize_pagination
from .quality import QualityReport, format_quality_report, run_quality_checks
from .schema import EbookDocument, normalize_ebook
from .themes import BLACK_GOLD_THEME, DEFAULT_THEME, ComposerTheme


def resolve_theme(name: str | None) -> ComposerTheme:
    if not name or name == "black_gold":
        return BLACK_GOLD_THEME
    if name == "default":
        return DEFAULT_THEME
    return BLACK_GOLD_THEME


def render_ebook_pdf(data: dict[str, Any] | EbookDocument, path: str | Path, *, print_report: bool = True) -> tuple[str, QualityReport]:
    """Render structured ebook data to a professional PDF."""

    if isinstance(data, EbookDocument):
        document = data
        validation_issues = []
    else:
        document, validation_issues = normalize_ebook(data)

    theme = resolve_theme(document.theme)
    rendered = render_document(document, theme)
    doc = create_document(str(path), theme)
    doc.build(
        rendered.story,
        onFirstPage=lambda canvas, built_doc: draw_cover_page(canvas, built_doc, theme, document),
        onLaterPages=lambda canvas, built_doc: draw_page_header_footer(canvas, built_doc, theme),
    )

    report = run_quality_checks(
        theme,
        component_metrics=rendered.component_metrics,
        document_index=rendered.index,
        pagination_summary=summarize_pagination(getattr(doc, "page", None)),
    )
    report.issues.extend(validation_issues)
    report.issues.extend(rendered.issues)
    if print_report:
        print(format_quality_report(report))
    if report.has_errors:
        raise RuntimeError("Professional composer quality diagnostics found error-level layout issues.")
    return str(path), report


def draw_cover_page(canvas, doc, theme: ComposerTheme = DEFAULT_THEME, document: EbookDocument | None = None):
    """Draw cover background and bounded decorative frame."""

    canvas.saveState()
    width, _ = theme.page_size
    canvas.setFillColor(theme.near_black)
    canvas.rect(0, 0, *theme.page_size, stroke=0, fill=1)

    geometry = cover_frame(theme)
    draw_panel_frame(canvas, geometry, theme)
    draw_bounded_rule(
        canvas,
        geometry["frame_x"] + 9 * mm,
        geometry["frame_y"] + geometry["frame_height"] - 8 * mm,
        20 * mm,
        theme,
        thickness=0.45,
    )
    canvas.setFillColor(theme.antique_gold)
    canvas.rect(
        geometry["frame_x"] + geometry["frame_width"] - 29 * mm,
        geometry["frame_y"] + 8 * mm,
        20 * mm,
        0.45,
        stroke=0,
        fill=1,
    )

    footer = f"{document.brand} Professional Composer" if document else "Ebook Studio Professional Composer"
    canvas.setFillColor(theme.secondary_text)
    canvas.setFont(theme.body_font, 7.5)
    canvas.drawCentredString(width / 2, 18 * mm, footer)
    canvas.restoreState()
