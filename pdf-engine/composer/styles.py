"""ReportLab style helpers for the professional ebook composer."""

from __future__ import annotations

from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import TableStyle
from reportlab.lib import colors

from .themes import ComposerTheme, DEFAULT_THEME


def build_styles(theme: ComposerTheme = DEFAULT_THEME) -> dict[str, ParagraphStyle]:
    """Return paragraph styles keyed by semantic role."""

    return {
        "cover_kicker": ParagraphStyle(
            "ComposerCoverKicker",
            fontName=theme.body_bold_font,
            fontSize=7.8,
            leading=9.5,
            textColor=theme.secondary_text,
            alignment=TA_CENTER,
            spaceAfter=6 * mm,
        ),
        "cover_title": ParagraphStyle(
            "ComposerCoverTitle",
            fontName=theme.display_bold_font,
            fontSize=51,
            leading=53,
            textColor=theme.gold,
            alignment=TA_CENTER,
            spaceAfter=6.5 * mm,
        ),
        "cover_subtitle": ParagraphStyle(
            "ComposerCoverSubtitle",
            fontName=theme.body_bold_font,
            fontSize=12.6,
            leading=18.2,
            textColor=theme.ivory,
            alignment=TA_CENTER,
            spaceAfter=3.5 * mm,
        ),
        "cover_intro": ParagraphStyle(
            "ComposerCoverIntro",
            fontName=theme.body_font,
            fontSize=9.8,
            leading=15.5,
            textColor=theme.secondary_text,
            alignment=TA_CENTER,
            spaceAfter=10 * mm,
        ),
        "title": ParagraphStyle(
            "ComposerTitle",
            fontName=theme.heading_font,
            fontSize=30,
            leading=34,
            textColor=theme.white,
            alignment=TA_CENTER,
            spaceAfter=8 * mm,
        ),
        "subtitle": ParagraphStyle(
            "ComposerSubtitle",
            fontName=theme.body_font,
            fontSize=13,
            leading=18,
            textColor=colors.HexColor("#DDE3EE"),
            alignment=TA_CENTER,
        ),
        "chapter": ParagraphStyle(
            "ComposerChapter",
            fontName=theme.display_bold_font,
            fontSize=29,
            leading=34,
            textColor=theme.near_black,
            spaceBefore=2 * mm,
            spaceAfter=theme.heading_to_body,
            keepWithNext=True,
        ),
        "toc_title": ParagraphStyle(
            "ComposerTocTitle",
            fontName=theme.display_bold_font,
            fontSize=27,
            leading=32,
            textColor=theme.near_black,
            spaceAfter=5 * mm,
        ),
        "toc_chapter": ParagraphStyle(
            "ComposerTocChapter",
            fontName=theme.body_bold_font,
            fontSize=10.2,
            leading=13.5,
            textColor=theme.near_black,
        ),
        "toc_section": ParagraphStyle(
            "ComposerTocSection",
            fontName=theme.body_font,
            fontSize=9.2,
            leading=12.5,
            textColor=theme.muted,
        ),
        "toc_page": ParagraphStyle(
            "ComposerTocPage",
            fontName=theme.body_font,
            fontSize=9.2,
            leading=12.5,
            textColor=theme.antique_gold,
            alignment=TA_RIGHT,
        ),
        "chapter_intro": ParagraphStyle(
            "ComposerChapterIntro",
            fontName=theme.body_font,
            fontSize=10.8,
            leading=16.6,
            textColor=colors.HexColor("#4B463E"),
            spaceAfter=theme.paragraph_to_section,
        ),
        "section": ParagraphStyle(
            "ComposerSection",
            fontName=theme.body_bold_font,
            fontSize=13.2,
            leading=17.8,
            textColor=theme.near_black,
            spaceBefore=theme.paragraph_to_section,
            spaceAfter=2.5 * mm,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "ComposerBody",
            fontName=theme.body_font,
            fontSize=10,
            leading=15.9,
            textColor=theme.ink,
            spaceAfter=3.7 * mm,
            allowWidows=0,
            allowOrphans=0,
        ),
        "small": ParagraphStyle(
            "ComposerSmall",
            fontName=theme.body_bold_font,
            fontSize=8.5,
            leading=12,
            textColor=theme.antique_gold,
            spaceAfter=2 * mm,
        ),
        "caption": ParagraphStyle(
            "ComposerCaption",
            fontName=theme.body_font,
            fontSize=8,
            leading=10,
            textColor=theme.muted,
            alignment=TA_LEFT,
        ),
        "callout_title": ParagraphStyle(
            "ComposerCalloutTitle",
            fontName=theme.body_bold_font,
            fontSize=9.9,
            leading=12.2,
            textColor=theme.near_black,
            spaceAfter=2 * mm,
        ),
        "callout_body": ParagraphStyle(
            "ComposerCalloutBody",
            fontName=theme.body_font,
            fontSize=9.35,
            leading=14.1,
            textColor=theme.ink,
            allowWidows=0,
            allowOrphans=0,
        ),
        "code": ParagraphStyle(
            "ComposerCode",
            fontName=theme.mono_font,
            fontSize=8.6,
            leading=13.4,
            textColor=theme.ivory,
        ),
        "cta": ParagraphStyle(
            "ComposerCTA",
            fontName=theme.body_bold_font,
            fontSize=10.8,
            leading=14.8,
            textColor=theme.ivory,
            alignment=TA_CENTER,
        ),
        "table_header": ParagraphStyle(
            "ComposerTableHeader",
            fontName=theme.body_bold_font,
            fontSize=8.5,
            leading=10.8,
            textColor=theme.ivory,
            alignment=TA_LEFT,
        ),
        "table_cell": ParagraphStyle(
            "ComposerTableCell",
            fontName=theme.body_font,
            fontSize=8.55,
            leading=12.6,
            textColor=theme.ink,
            alignment=TA_LEFT,
        ),
        "back_cover_title": ParagraphStyle(
            "ComposerBackCoverTitle",
            fontName=theme.display_bold_font,
            fontSize=31,
            leading=36,
            textColor=theme.gold,
            alignment=TA_CENTER,
            spaceAfter=6 * mm,
        ),
        "back_cover_body": ParagraphStyle(
            "ComposerBackCoverBody",
            fontName=theme.body_font,
            fontSize=11,
            leading=16,
            textColor=theme.secondary_text,
            alignment=TA_CENTER,
            spaceAfter=8 * mm,
        ),
    }


def callout_table_style(
    background: colors.Color,
    border: colors.Color,
    theme: ComposerTheme = DEFAULT_THEME,
) -> TableStyle:
    """Shared boxed style for callouts and small feature panels."""

    return TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, -1), background),
            ("BOX", (0, 0), (-1, -1), 0.65, border),
            ("LEFTPADDING", (0, 0), (-1, -1), theme.box_padding_x),
            ("RIGHTPADDING", (0, 0), (-1, -1), theme.box_padding_x),
            ("TOPPADDING", (0, 0), (-1, -1), theme.box_padding_y),
            ("BOTTOMPADDING", (0, 0), (-1, -1), theme.box_padding_y),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]
    )
