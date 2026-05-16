"""Theme-aware table of contents generation."""

from __future__ import annotations

from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, Spacer, Table, TableStyle

from .document_index import DocumentIndex
from .layout import conditional_page_break, keep_together, safe_width
from .styles import build_styles
from .themes import ComposerTheme, DEFAULT_THEME


def build_toc(index: DocumentIndex, theme: ComposerTheme = DEFAULT_THEME) -> list:
    styles = build_styles(theme)
    rows = []
    for entry in index.entries:
        indent = 0 if entry.level == 1 else 7 * mm
        title_style = styles["toc_chapter"] if entry.level == 1 else styles["toc_section"]
        title = Paragraph(entry.title, title_style)
        page = Paragraph(str(entry.page_number or entry.estimated_page or ""), styles["toc_page"])
        rows.append([title, page, indent])

    toc_rows = []
    for title, page, indent in rows:
        toc_rows.append([title, page])

    story = [
        Paragraph("Contents", styles["toc_title"]),
        Spacer(1, 6 * mm),
    ]
    if toc_rows:
        table = Table(toc_rows, colWidths=[safe_width(theme) - 18 * mm, 18 * mm], repeatRows=0)
        commands = [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
            ("LINEBELOW", (0, 0), (-1, -1), 0.25, theme.off_white),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ]
        for row_index, entry in enumerate(index.entries):
            if entry.level > 1:
                commands.append(("LEFTPADDING", (0, row_index), (0, row_index), 7 * mm))
        table.setStyle(TableStyle(commands))
        story.extend([conditional_page_break(45 * mm), keep_together([table])])
    else:
        story.append(Paragraph("No chapters registered yet.", styles["body"]))
    story.append(PageBreak())
    return story
