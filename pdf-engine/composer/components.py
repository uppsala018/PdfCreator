"""Reusable ReportLab components for professional ebook composition."""

from __future__ import annotations

from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle

from .layout import keep_together, safe_width
from .styles import build_styles, callout_table_style
from .themes import ComposerTheme, DEFAULT_THEME


def chapter_header(number: int, title: str, intro: str = "", theme: ComposerTheme = DEFAULT_THEME):
    styles = build_styles(theme)
    items = [
        Paragraph(f"Chapter {number}", styles["small"]),
        Paragraph(title, styles["chapter"]),
    ]
    if intro:
        items.append(Paragraph(intro, styles["chapter_intro"]))
    items.append(Spacer(1, 2 * mm))
    return keep_together(items)


def _box(
    label: str,
    body: str,
    background: colors.Color,
    border: colors.Color,
    theme: ComposerTheme = DEFAULT_THEME,
):
    styles = build_styles(theme)
    content = [
        Paragraph(label, styles["callout_title"]),
        Paragraph(body, styles["callout_body"]),
    ]
    table = Table([[content]], colWidths=[safe_width(theme)])
    table.setStyle(callout_table_style(background, border, theme))
    table.setStyle(
        TableStyle(
            [
                ("LINEBEFORE", (0, 0), (0, -1), 1.1, border),
                ("LEFTPADDING", (0, 0), (-1, -1), theme.box_padding_x + 1.5 * mm),
            ]
        )
    )
    return keep_together([table, Spacer(1, 6 * mm)])


def tip_box(body: str, theme: ComposerTheme = DEFAULT_THEME):
    return _box("Design Note", body, colors.HexColor("#FCF9F1"), theme.gold, theme)


def warning_box(body: str, theme: ComposerTheme = DEFAULT_THEME):
    return _box("Quality Rule", body, colors.HexColor("#F8F4EA"), theme.antique_gold, theme)


def key_takeaway_box(body: str, theme: ComposerTheme = DEFAULT_THEME):
    return _box("Key Takeaway", body, colors.HexColor("#F3F0EA"), theme.near_black, theme)


def prompt_block(prompt: str, theme: ComposerTheme = DEFAULT_THEME):
    styles = build_styles(theme)
    table = Table([[Paragraph(prompt, styles["code"])]], colWidths=[safe_width(theme)])
    table.setStyle(
        callout_table_style(
            background=theme.near_black,
            border=theme.gold,
            theme=theme,
        )
    )
    table.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), theme.box_padding_x + 1.5 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), theme.box_padding_x + 1.5 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), theme.box_padding_y + 1.2 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), theme.box_padding_y + 1.2 * mm),
                ("LINEBEFORE", (0, 0), (0, -1), 1.2, theme.gold),
            ]
        )
    )
    return keep_together([table, Spacer(1, 5 * mm)])


def cta_box(text: str, theme: ComposerTheme = DEFAULT_THEME):
    styles = build_styles(theme)
    table = Table([[Paragraph(text, styles["cta"])]], colWidths=[safe_width(theme)])
    table.setStyle(
        callout_table_style(
            background=theme.near_black,
            border=theme.gold,
            theme=theme,
        )
    )
    table.setStyle(
        TableStyle(
            [
                ("TOPPADDING", (0, 0), (-1, -1), theme.cta_padding_y),
                ("BOTTOMPADDING", (0, 0), (-1, -1), theme.cta_padding_y),
            ]
        )
    )
    return keep_together([table, Spacer(1, 7 * mm)])


def comparison_table(headers: list[str], rows: list[list[str]], theme: ComposerTheme = DEFAULT_THEME):
    styles = build_styles(theme)
    data = [[Paragraph(cell, styles["table_header"]) for cell in headers]]
    data.extend([[Paragraph(cell, styles["table_cell"]) for cell in row] for row in rows])

    table_width = safe_width(theme)
    table = Table(data, colWidths=[table_width * 0.31, table_width * 0.345, table_width * 0.345], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), theme.near_black),
                ("TEXTCOLOR", (0, 0), (-1, 0), theme.ivory),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [theme.white, colors.HexColor("#FBF7EF")]),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E3DDD2")),
                ("BOX", (0, 0), (-1, -1), 0.55, theme.antique_gold),
                ("LINEBELOW", (0, 0), (-1, 0), 0.8, theme.gold),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), theme.table_padding_y),
                ("BOTTOMPADDING", (0, 0), (-1, -1), theme.table_padding_y),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return keep_together([table, Spacer(1, 7 * mm)])


def back_cover(title: str, body: str, cta: str, theme: ComposerTheme = DEFAULT_THEME):
    styles = build_styles(theme)
    content = [
        Spacer(1, 14 * mm),
        Paragraph(title, styles["back_cover_title"]),
        Paragraph(body, styles["back_cover_body"]),
        Paragraph(cta, styles["cta"]),
        Spacer(1, 14 * mm),
    ]
    table = Table([[content]], colWidths=[safe_width(theme)])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), theme.near_black),
                ("BOX", (0, 0), (-1, -1), 0.65, theme.gold),
                ("LEFTPADDING", (0, 0), (-1, -1), 12 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 8 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8 * mm),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    return keep_together([Spacer(1, 34 * mm), table])
