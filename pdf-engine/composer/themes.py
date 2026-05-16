"""Theme tokens for the professional ebook composer."""

from __future__ import annotations

from dataclasses import dataclass

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm

from .fonts import resolve_premium_fonts

PREMIUM_FONTS = resolve_premium_fonts()


@dataclass(frozen=True)
class ComposerTheme:
    """Visual and spacing tokens shared across composer components."""

    dark_navy: colors.Color
    near_black: colors.Color
    charcoal: colors.Color
    teal: colors.Color
    gold: colors.Color
    antique_gold: colors.Color
    white: colors.Color
    ivory: colors.Color
    off_white: colors.Color
    ink: colors.Color
    muted: colors.Color
    secondary_text: colors.Color
    danger: colors.Color
    page_size: tuple[float, float]
    margin_x: float
    margin_top: float
    margin_bottom: float
    gutter: float
    radius: float
    box_padding_x: float
    box_padding_y: float
    table_padding_y: float
    title_to_subtitle: float
    heading_to_body: float
    paragraph_to_section: float
    cta_padding_y: float
    display_font: str
    display_bold_font: str
    body_bold_font: str
    body_font: str
    heading_font: str
    mono_font: str


DEFAULT_THEME = ComposerTheme(
    dark_navy=colors.HexColor("#1A1A2E"),
    near_black=colors.HexColor("#080808"),
    charcoal=colors.HexColor("#121217"),
    teal=colors.HexColor("#20808D"),
    gold=colors.HexColor("#D4A84B"),
    antique_gold=colors.HexColor("#B8860B"),
    white=colors.white,
    ivory=colors.HexColor("#F7F1E3"),
    off_white=colors.HexColor("#F7F8FA"),
    ink=colors.HexColor("#202334"),
    muted=colors.HexColor("#667085"),
    secondary_text=colors.HexColor("#C8C0B0"),
    danger=colors.HexColor("#B54708"),
    page_size=A4,
    margin_x=18 * mm,
    margin_top=18 * mm,
    margin_bottom=16 * mm,
    gutter=6 * mm,
    radius=4,
    box_padding_x=5 * mm,
    box_padding_y=4 * mm,
    table_padding_y=3 * mm,
    title_to_subtitle=8 * mm,
    heading_to_body=3 * mm,
    paragraph_to_section=7 * mm,
    cta_padding_y=6 * mm,
    display_font=PREMIUM_FONTS["display"],
    display_bold_font=PREMIUM_FONTS["display_bold"],
    body_font=PREMIUM_FONTS["body"],
    body_bold_font=PREMIUM_FONTS["body_bold"],
    heading_font=PREMIUM_FONTS["body_bold"],
    mono_font=PREMIUM_FONTS["mono"],
)


BLACK_GOLD_THEME = ComposerTheme(
    dark_navy=colors.HexColor("#1A1A2E"),
    near_black=colors.HexColor("#080808"),
    charcoal=colors.HexColor("#121217"),
    teal=colors.HexColor("#20808D"),
    gold=colors.HexColor("#C9A227"),
    antique_gold=colors.HexColor("#9F7A22"),
    white=colors.white,
    ivory=colors.HexColor("#F7F1E3"),
    off_white=colors.HexColor("#FAF7F0"),
    ink=colors.HexColor("#191919"),
    muted=colors.HexColor("#6F6A60"),
    secondary_text=colors.HexColor("#C8C0B0"),
    danger=colors.HexColor("#9A5B13"),
    page_size=A4,
    margin_x=21 * mm,
    margin_top=21 * mm,
    margin_bottom=19 * mm,
    gutter=7 * mm,
    radius=3,
    box_padding_x=6.5 * mm,
    box_padding_y=5.2 * mm,
    table_padding_y=3.8 * mm,
    title_to_subtitle=7.5 * mm,
    heading_to_body=4 * mm,
    paragraph_to_section=8.5 * mm,
    cta_padding_y=6.2 * mm,
    display_font=PREMIUM_FONTS["display"],
    display_bold_font=PREMIUM_FONTS["display_bold"],
    body_font=PREMIUM_FONTS["body"],
    body_bold_font=PREMIUM_FONTS["body_bold"],
    heading_font=PREMIUM_FONTS["display_bold"],
    mono_font=PREMIUM_FONTS["mono"],
)
