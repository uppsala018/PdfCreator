"""Layout helpers and document shell for the professional composer."""

from __future__ import annotations

from collections.abc import Iterable

from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    CondPageBreak,
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)

from .styles import build_styles
from .themes import ComposerTheme, DEFAULT_THEME

SMALL_SPACE = Spacer(1, 2.5 * mm)
MEDIUM_SPACE = Spacer(1, 5.5 * mm)
LARGE_SPACE = Spacer(1, 9 * mm)
SECTION_DIVIDER = HRFlowable(width="100%", thickness=0.45, color=DEFAULT_THEME.off_white, spaceBefore=3 * mm, spaceAfter=4 * mm)


def content_width(theme: ComposerTheme = DEFAULT_THEME) -> float:
    """Usable page width inside document margins."""

    page_width, _ = theme.page_size
    return page_width - (theme.margin_x * 2)


def safe_width(theme: ComposerTheme = DEFAULT_THEME, inset: float = 0) -> float:
    """Width inside page margins after an optional inset."""

    return max(0, content_width(theme) - (2 * inset))


def cover_frame(theme: ComposerTheme = DEFAULT_THEME) -> dict[str, float]:
    """Shared cover geometry so text, panels, and rules use one constraint box."""

    page_width, page_height = theme.page_size
    panel_inset = theme.margin_x - 2 * mm
    panel_x = panel_inset
    panel_y = 34 * mm
    panel_width = page_width - (2 * panel_inset)
    panel_height = page_height - 66 * mm
    frame_inset = 10 * mm
    text_inset = 22 * mm

    return {
        "panel_x": panel_x,
        "panel_y": panel_y,
        "panel_width": panel_width,
        "panel_height": panel_height,
        "frame_x": panel_x + frame_inset,
        "frame_y": panel_y + frame_inset,
        "frame_width": panel_width - (2 * frame_inset),
        "frame_height": panel_height - (2 * frame_inset),
        "text_width": panel_width - (2 * text_inset),
        "text_inset": text_inset,
    }


def bounded_rule(width: float, theme: ComposerTheme = DEFAULT_THEME, thickness: float = 0.5, align: str = "CENTER") -> HRFlowable:
    """Create a horizontal rule that is explicitly bounded by caller geometry."""

    return HRFlowable(width=width, thickness=thickness, color=theme.gold, hAlign=align, spaceBefore=0, spaceAfter=theme.title_to_subtitle)


def draw_bounded_rule(canvas, x: float, y: float, width: float, theme: ComposerTheme = DEFAULT_THEME, thickness: float = 0.45):
    """Draw a decorative rule inside the provided width only."""

    canvas.setFillColor(theme.gold)
    canvas.rect(x, y, width, thickness, stroke=0, fill=1)


def draw_panel_frame(canvas, geometry: dict[str, float], theme: ComposerTheme = DEFAULT_THEME):
    """Draw a cover panel and inner frame without exceeding shared bounds."""

    canvas.setFillColor(theme.charcoal)
    canvas.roundRect(
        geometry["panel_x"],
        geometry["panel_y"],
        geometry["panel_width"],
        geometry["panel_height"],
        theme.radius,
        stroke=0,
        fill=1,
    )

    canvas.setStrokeColor(theme.gold)
    canvas.setLineWidth(0.38)
    canvas.rect(
        geometry["frame_x"],
        geometry["frame_y"],
        geometry["frame_width"],
        geometry["frame_height"],
        stroke=1,
        fill=0,
    )


# TODO: Add automated PDF layout QA for generated pages:
# - detect drawn elements outside their assigned frame
# - detect text overflow or clipping inside constrained tables
# - detect box overlap after ReportLab pagination
# - detect decorative rule overflow beyond text/frame bounds


def keep_together(items: Iterable) -> KeepTogether:
    """Keep a logical block together when ReportLab can fit it on a page."""

    return KeepTogether(list(items))


def conditional_page_break(height: float) -> CondPageBreak:
    """Request a page break when less than *height* remains."""

    return CondPageBreak(height)


def section_divider(theme: ComposerTheme = DEFAULT_THEME) -> HRFlowable:
    """Subtle divider for transitions inside a chapter."""

    return HRFlowable(width=34 * mm, thickness=0.45, color=theme.gold, hAlign="LEFT", spaceBefore=5 * mm, spaceAfter=6 * mm)


def safe_section_block(title: str, body_items: Iterable, theme: ComposerTheme = DEFAULT_THEME):
    """Keep a section heading with its first content items to avoid orphans."""

    styles = build_styles(theme)
    return safe_section_start(title, body_items, theme)


def keep_heading_with_next(heading, following_items: Iterable, minimum_space: float = 32 * mm) -> KeepTogether:
    """Keep a heading with the next logical content so it cannot stand alone."""

    return keep_together([conditional_page_break(minimum_space), heading, *list(following_items)])


def prevent_orphan_heading(heading, following_items: Iterable, minimum_space: float = 32 * mm) -> KeepTogether:
    """Alias for explicit publishing intent at call sites."""

    return keep_heading_with_next(heading, following_items, minimum_space)


def minimum_lines_after_heading(line_height: float, lines: int = 2) -> float:
    """Return minimum space needed after a heading before allowing a page bottom."""

    return max(lines, 1) * line_height


def safe_chapter_start(items: Iterable, theme: ComposerTheme = DEFAULT_THEME):
    """Start a chapter with enough remaining space for title plus intro."""

    return keep_together([conditional_page_break(58 * mm), *list(items)])


def safe_section_start(title: str, body_items: Iterable, theme: ComposerTheme = DEFAULT_THEME):
    """Start a section with enough space for heading and at least two body lines."""

    styles = build_styles(theme)
    minimum_space = 24 * mm + minimum_lines_after_heading(styles["body"].leading, 2)
    return prevent_orphan_heading(Paragraph(title, styles["section"]), body_items, minimum_space)


def minimum_space_before_large_component(component_type: str, theme: ComposerTheme = DEFAULT_THEME):
    """CondPageBreak thresholds by component type without hardcoding call sites."""

    thresholds = {
        "comparison_table": 70 * mm,
        "prompt_block": 48 * mm,
        "cta_box": 38 * mm,
        "callout": 42 * mm,
        "back_cover": 82 * mm,
    }
    return conditional_page_break(thresholds.get(component_type, 32 * mm))


def create_document(path: str, theme: ComposerTheme = DEFAULT_THEME) -> SimpleDocTemplate:
    """Create the default professional guide document template."""

    return SimpleDocTemplate(
        path,
        pagesize=theme.page_size,
        leftMargin=theme.margin_x,
        rightMargin=theme.margin_x,
        topMargin=theme.margin_top + 5 * mm,
        bottomMargin=theme.margin_bottom + 5 * mm,
        title="Professional Ebook Composer Sample",
        author="Ebook Studio",
    )


def draw_page_header_footer(canvas, doc, theme: ComposerTheme = DEFAULT_THEME):
    """Minimal branded header/footer for sample composer output."""

    canvas.saveState()
    width, height = theme.page_size
    canvas.setStrokeColor(colors.HexColor("#EEE7DB"))
    canvas.setLineWidth(0.35)
    canvas.line(theme.margin_x, height - 13 * mm, width - theme.margin_x, height - 13 * mm)
    canvas.setFillColor(theme.gold)
    canvas.rect(theme.margin_x, height - 13.25 * mm, 11 * mm, 0.45 * mm, stroke=0, fill=1)
    canvas.setFillColor(theme.muted)
    canvas.setFont(theme.body_font, 7.2)
    canvas.drawString(theme.margin_x, 9 * mm, "Ebook Studio Professional Composer")
    canvas.setFont(theme.body_font, 7.5)
    canvas.drawRightString(width - theme.margin_x, 9 * mm, f"{doc.page:02d}")
    canvas.restoreState()
