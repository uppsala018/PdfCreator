"""
Dark Cinematic PDF template.

Design spec
───────────
Cover      : full navy (#0D1B2A), gold title (#C9A84C), white subtitle, author at bottom.
Header bar : 8 mm navy at top of every content/TOC page; white title left, gold website right.
Body       : Helvetica 11 pt / 14 pt leading, dark grey (#2C2C2C).
Heading    : Helvetica-Bold 18 pt, navy, 12 pt space before; never breaks from next paragraph.
Subheading : Helvetica-Bold 14 pt, gold.
Pro Tip    : navy box, 3 pt gold left border, 8 pt padding, rounded corners, white text.
Prompt Card: light-grey (#F5F5F5) box, 1 pt dark border, Courier 10 pt, 8 pt padding.
Table      : alternating white / very-light navy rows; bold navy header row with white text.
Page nums  : bottom centre, Helvetica 9 pt grey, starting at physical page 3.
TOC        : gold dot leaders, chapter titles + page numbers.
Ch. divider: full navy page, large gold number top-centre, white title below.
"""

from __future__ import annotations
from io import BytesIO
from xml.sax.saxutils import escape as _xml_escape

from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.platypus.flowables import Flowable

# ── Palette ───────────────────────────────────────────────────────────────────

NAVY       = HexColor("#0D1B2A")
GOLD       = HexColor("#C9A84C")
DARK_GREY  = HexColor("#2C2C2C")
MID_GREY   = HexColor("#888888")
LIGHT_GREY = HexColor("#F5F5F5")
ALT_NAVY   = HexColor("#0F2236")   # table alternating row

# ── Page geometry ─────────────────────────────────────────────────────────────

PAGE_W, PAGE_H = A4
MARGIN   = 2 * cm
HEADER_H = 8 * mm

FRAME_X = MARGIN
FRAME_Y = MARGIN
FRAME_W = PAGE_W - 2 * MARGIN
FRAME_H = PAGE_H - HEADER_H - 2 * MARGIN

# ── Styles ────────────────────────────────────────────────────────────────────

def _make_styles() -> dict:
    return {
        "chapter_title": ParagraphStyle(
            "ChapterTitle",
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=28,
            textColor=NAVY,
            spaceBefore=0,
            spaceAfter=14,
        ),
        "heading": ParagraphStyle(
            "Heading",
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=24,
            textColor=NAVY,
            spaceBefore=12,
            spaceAfter=6,
        ),
        "subheading": ParagraphStyle(
            "Subheading",
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=GOLD,
            spaceBefore=8,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "Body",
            fontName="Helvetica",
            fontSize=11,
            leading=14,
            textColor=DARK_GREY,
            spaceAfter=6,
        ),
        "toc_title": ParagraphStyle(
            "TOCTitle",
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=26,
            textColor=NAVY,
            spaceAfter=20,
        ),
        "toc_entry": ParagraphStyle(
            "TOCEntry",
            fontName="Helvetica",
            fontSize=12,
            leading=20,
            textColor=DARK_GREY,
        ),
    }

# ── Helpers ───────────────────────────────────────────────────────────────────

def _esc(text: str) -> str:
    """Escape XML special characters and convert \\n to <br/> for Paragraph."""
    if not text:
        return " "
    return _xml_escape(str(text)).replace("\n", "<br/>")

# ── Custom flowables ──────────────────────────────────────────────────────────

class _ProTipBox(Flowable):
    """Navy box with 3 pt gold left border, 8 pt padding, rounded corners."""

    PAD    = 8
    BORDER = 3
    RADIUS = 4

    def __init__(self, text: str) -> None:
        super().__init__()
        self._text = text or " "

    def _label_style(self):
        return ParagraphStyle(
            "_ptlabel", fontName="Helvetica-Bold",
            fontSize=9, textColor=GOLD, leading=11,
        )

    def _body_style(self):
        return ParagraphStyle(
            "_ptbody", fontName="Helvetica",
            fontSize=11, textColor=white, leading=14,
        )

    def wrap(self, avail_w, avail_h):
        self._w = avail_w
        inner = avail_w - self.PAD * 2 - self.BORDER

        lbl = Paragraph("PRO TIP", self._label_style())
        _, self._lh = lbl.wrap(inner, 9999)

        bod = Paragraph(_esc(self._text), self._body_style())
        _, self._bh = bod.wrap(inner, 9999)

        self._h = self.PAD * 2 + self._lh + 4 + self._bh
        return avail_w, self._h

    def draw(self):
        c = self.canv
        w, h = self._w, self._h
        inner = w - self.PAD * 2 - self.BORDER
        c.saveState()

        # Navy background
        c.setFillColor(NAVY)
        c.roundRect(0, 0, w, h, self.RADIUS, fill=1, stroke=0)

        # Gold left border
        c.setFillColor(GOLD)
        c.roundRect(0, 0, self.BORDER, h, 1, fill=1, stroke=0)

        # Label
        lbl = Paragraph("PRO TIP", self._label_style())
        lbl.wrap(inner, 9999)
        lbl.drawOn(c, self.BORDER + self.PAD, h - self.PAD - self._lh)

        # Body
        bod = Paragraph(_esc(self._text), self._body_style())
        bod.wrap(inner, 9999)
        bod.drawOn(c, self.BORDER + self.PAD,
                   h - self.PAD - self._lh - 4 - self._bh)

        c.restoreState()


class _PromptCard(Flowable):
    """Light-grey box, 1 pt dark border, Courier 10 pt, 8 pt padding."""

    PAD    = 8
    RADIUS = 4

    def __init__(self, text: str) -> None:
        super().__init__()
        self._text = text or " "

    def _label_style(self):
        return ParagraphStyle(
            "_pclabel", fontName="Helvetica-Bold",
            fontSize=9, textColor=MID_GREY, leading=11,
        )

    def _body_style(self):
        return ParagraphStyle(
            "_pcbody", fontName="Courier",
            fontSize=10, textColor=DARK_GREY, leading=13,
        )

    def wrap(self, avail_w, avail_h):
        self._w = avail_w
        inner = avail_w - self.PAD * 2

        lbl = Paragraph("PROMPT", self._label_style())
        _, self._lh = lbl.wrap(inner, 9999)

        bod = Paragraph(_esc(self._text), self._body_style())
        _, self._bh = bod.wrap(inner, 9999)

        self._h = self.PAD * 2 + self._lh + 4 + self._bh
        return avail_w, self._h

    def draw(self):
        c = self.canv
        w, h = self._w, self._h
        inner = w - self.PAD * 2
        c.saveState()

        # Light-grey background with dark border
        c.setFillColor(LIGHT_GREY)
        c.setStrokeColor(DARK_GREY)
        c.setLineWidth(1)
        c.roundRect(0, 0, w, h, self.RADIUS, fill=1, stroke=1)

        # Label
        lbl = Paragraph("PROMPT", self._label_style())
        lbl.wrap(inner, 9999)
        lbl.drawOn(c, self.PAD, h - self.PAD - self._lh)

        # Body
        bod = Paragraph(_esc(self._text), self._body_style())
        bod.wrap(inner, 9999)
        bod.drawOn(c, self.PAD, h - self.PAD - self._lh - 4 - self._bh)

        c.restoreState()


class _TOCAnchor(Flowable):
    """
    Zero-height flowable that causes EbookDoc.afterFlowable to register
    a TOC entry at the current page.
    """

    def __init__(self, level: int, text: str) -> None:
        super().__init__()
        self.toc_level = level
        self.toc_text  = text

    def wrap(self, *_):
        return (0, 0)

    def draw(self):
        pass  # registration happens in afterFlowable


# ── Page drawing callbacks ────────────────────────────────────────────────────

def _draw_cover(canvas, doc):
    """Full-navy cover page."""
    project = doc.project
    canvas.saveState()

    # Background
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    cx = PAGE_W / 2

    # Decorative top accent bar
    canvas.setFillColor(GOLD)
    canvas.rect(0, PAGE_H - 6 * mm, PAGE_W, 4 * mm, fill=1, stroke=0)

    # Title
    title = project.get("title", "Untitled")
    canvas.setFillColor(GOLD)
    canvas.setFont("Helvetica-Bold", 36)
    # Wrap long titles manually
    max_w = PAGE_W - 4 * MARGIN
    _draw_centred_wrapped(canvas, title, "Helvetica-Bold", 36, cx,
                          PAGE_H * 0.58, max_w, GOLD, line_spacing=44)

    # Gold rule
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(1.5)
    canvas.line(cx - 3 * cm, PAGE_H * 0.50, cx + 3 * cm, PAGE_H * 0.50)

    # Subtitle
    subtitle = project.get("subtitle") or ""
    if subtitle:
        canvas.setFillColor(white)
        canvas.setFont("Helvetica-Oblique", 14)
        _draw_centred_wrapped(canvas, subtitle, "Helvetica-Oblique", 14, cx,
                              PAGE_H * 0.45, max_w, white, line_spacing=18)

    # Author
    author = project.get("author") or ""
    if author:
        canvas.setFillColor(white)
        canvas.setFont("Helvetica", 12)
        canvas.drawCentredString(cx, PAGE_H * 0.15, author)

    # Website
    website = project.get("website") or ""
    if website:
        canvas.setFillColor(GOLD)
        canvas.setFont("Helvetica", 10)
        canvas.drawCentredString(cx, PAGE_H * 0.11, website)

    # Bottom gold bar
    canvas.setFillColor(GOLD)
    canvas.rect(0, 0, PAGE_W, 3 * mm, fill=1, stroke=0)

    canvas.restoreState()


def _draw_content_header(canvas, doc):
    """8 mm navy header bar + page number for content and TOC pages."""
    project = doc.project
    canvas.saveState()

    # Header bar
    canvas.setFillColor(NAVY)
    canvas.rect(0, PAGE_H - HEADER_H, PAGE_W, HEADER_H, fill=1, stroke=0)

    # Text baseline: vertically centred in bar
    text_y = PAGE_H - HEADER_H + (HEADER_H - 9) / 2

    # Book title (left, white)
    canvas.setFillColor(white)
    canvas.setFont("Helvetica", 9)
    canvas.drawString(MARGIN, text_y, project.get("title", ""))

    # Website (right, gold)
    website = project.get("website") or ""
    if website:
        canvas.setFillColor(GOLD)
        canvas.drawRightString(PAGE_W - MARGIN, text_y, website)

    # Page number — shown from physical page 3 onward
    if doc.page >= 3:
        canvas.setFillColor(MID_GREY)
        canvas.setFont("Helvetica", 9)
        canvas.drawCentredString(PAGE_W / 2, MARGIN / 2, str(doc.page))

    canvas.restoreState()


def _make_chapter_divider_callback(chapter_num: int, chapter_title: str):
    """Return an onPage callback that draws a chapter divider page."""

    def _draw(canvas, doc):
        canvas.saveState()

        # Full-navy background
        canvas.setFillColor(NAVY)
        canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

        cx = PAGE_W / 2

        # Large chapter number (e.g. "01")
        num_str = f"{chapter_num:02d}"
        canvas.setFillColor(GOLD)
        canvas.setFont("Helvetica-Bold", 72)
        canvas.drawCentredString(cx, PAGE_H * 0.56, num_str)

        # Gold rule
        canvas.setStrokeColor(GOLD)
        canvas.setLineWidth(1.5)
        canvas.line(cx - 3 * cm, PAGE_H * 0.50, cx + 3 * cm, PAGE_H * 0.50)

        # Chapter title (white)
        canvas.setFillColor(white)
        canvas.setFont("Helvetica-Bold", 24)
        max_w = PAGE_W - 4 * MARGIN
        _draw_centred_wrapped(canvas, chapter_title, "Helvetica-Bold", 24,
                              cx, PAGE_H * 0.44, max_w, white, line_spacing=30)

        canvas.restoreState()

    return _draw


# ── Helper: centred word-wrapped text on canvas ───────────────────────────────

def _draw_centred_wrapped(canvas, text, font, size, cx, top_y,
                          max_w, color, line_spacing):
    """Draw word-wrapped text centred horizontally, starting at top_y."""
    from reportlab.pdfbase.pdfmetrics import stringWidth

    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        test = f"{current} {word}".strip()
        if stringWidth(test, font, size) <= max_w:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)

    canvas.setFillColor(color)
    canvas.setFont(font, size)
    y = top_y
    for line in lines:
        canvas.drawCentredString(cx, y, line)
        y -= line_spacing


# ── Doc template ──────────────────────────────────────────────────────────────

class EbookDoc(BaseDocTemplate):
    """Custom doc template that registers chapter titles with the TOC."""

    def __init__(self, buffer, project: dict, chapters: list[dict]) -> None:
        self.project = project
        super().__init__(
            buffer,
            pagesize=A4,
            leftMargin=MARGIN,
            rightMargin=MARGIN,
            topMargin=HEADER_H + MARGIN,
            bottomMargin=MARGIN,
        )
        self._build_templates(chapters)

    def _build_templates(self, chapters: list[dict]) -> None:
        # Frame for normal content (under the header bar)
        content_frame = Frame(
            FRAME_X, FRAME_Y, FRAME_W, FRAME_H,
            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        )

        # Minimal frame for cover / chapter-divider pages (full-page canvas drawings)
        full_frame = Frame(0, 0, PAGE_W, PAGE_H,
                           leftPadding=0, rightPadding=0,
                           topPadding=0, bottomPadding=0)

        templates = [
            PageTemplate(id="Cover",   frames=[full_frame],    onPage=_draw_cover),
            PageTemplate(id="Content", frames=[content_frame], onPage=_draw_content_header),
            PageTemplate(id="TOCPage", frames=[content_frame], onPage=_draw_content_header),
        ]

        for i, chapter in enumerate(chapters):
            cb = _make_chapter_divider_callback(i + 1, chapter.get("title", ""))
            templates.append(
                PageTemplate(id=f"ChapterDivider_{i + 1}",
                             frames=[full_frame], onPage=cb)
            )

        self.addPageTemplates(templates)

    def afterFlowable(self, flowable) -> None:
        if isinstance(flowable, _TOCAnchor):
            self.notify("TOCEntry", (flowable.toc_level, flowable.toc_text, self.page))


# ── Table builder ─────────────────────────────────────────────────────────────

def _make_table(rows: list[list[str]]) -> Table:
    if not rows:
        return Spacer(1, 1)

    col_count = max(len(r) for r in rows)
    col_w = FRAME_W / col_count

    # Wrap every cell in a Paragraph for text wrapping
    body_style = ParagraphStyle(
        "_tbcell", fontName="Helvetica", fontSize=10,
        leading=13, textColor=DARK_GREY,
    )
    header_style = ParagraphStyle(
        "_tbhdr", fontName="Helvetica-Bold", fontSize=10,
        leading=13, textColor=white,
    )

    table_data = []
    for ri, row in enumerate(rows):
        style = header_style if ri == 0 else body_style
        # Pad rows to col_count
        padded = row + [""] * (col_count - len(row))
        table_data.append([Paragraph(cell, style) for cell in padded])

    tbl = Table(table_data, colWidths=[col_w] * col_count, repeatRows=1)
    num_rows = len(rows)

    style_cmds = [
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        # Header row
        ("BACKGROUND",    (0, 0), (-1, 0),  NAVY),
        ("LINEBELOW",     (0, 0), (-1, 0),  1,   GOLD),
        # Grid lines
        ("INNERGRID",     (0, 0), (-1, -1), 0.5, HexColor("#1e3a52")),
        ("BOX",           (0, 0), (-1, -1), 0.5, HexColor("#1e3a52")),
    ]

    # Alternating rows (skip header)
    for ri in range(1, num_rows):
        if ri % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, ri), (-1, ri), ALT_NAVY))

    tbl.setStyle(TableStyle(style_cmds))
    return tbl


# ── Story builder ─────────────────────────────────────────────────────────────

def _blocks_to_flowables(
    blocks: list[dict],
    styles: dict,
    allow_page_break: bool = True,
) -> list:
    """
    Convert a chapter's block list to a list of flowables.
    Headings and subheadings are wrapped with KeepTogether so they never split
    from the paragraph that follows them.
    """
    raw: list = []

    for block in blocks:
        btype   = block.get("type", "paragraph")
        content = block.get("content", "")
        meta    = block.get("metadata") or {}

        if btype == "heading":
            raw.append(Paragraph(content or " ", styles["heading"]))

        elif btype == "subheading":
            raw.append(Paragraph(content or " ", styles["subheading"]))

        elif btype == "paragraph":
            raw.append(Paragraph(content or " ", styles["body"]))

        elif btype == "pro_tip":
            raw.append(_ProTipBox(content))
            raw.append(Spacer(1, 4))

        elif btype == "prompt_card":
            raw.append(_PromptCard(content))
            raw.append(Spacer(1, 4))

        elif btype == "table":
            rows = meta.get("rows", [])
            raw.append(_make_table(rows))
            raw.append(Spacer(1, 6))

        elif btype == "page_break":
            if allow_page_break:
                raw.append(NextPageTemplate("Content"))
                raw.append(PageBreak())

        elif btype == "chapter_divider":
            # Inline chapter-divider block (not the same as the inter-chapter page)
            raw.append(Spacer(1, 6))
            from reportlab.platypus import HRFlowable
            raw.append(HRFlowable(width="100%", thickness=1.5,
                                  color=GOLD, spaceAfter=6))

    # ── Keep headings with the paragraph that immediately follows ───────────
    result: list = []
    i = 0
    while i < len(raw):
        f = raw[i]
        is_heading = (
            isinstance(f, Paragraph)
            and hasattr(f, "style")
            and f.style.name in ("Heading", "Subheading")
        )
        if is_heading and i + 1 < len(raw):
            result.append(KeepTogether([f, raw[i + 1]]))
            i += 2
        else:
            result.append(f)
            i += 1

    return result


def _build_story(project: dict, styles: dict) -> list:
    chapters = project.get("chapters") or []
    story: list = []

    # ── Page 1: Cover ──────────────────────────────────────────────────────
    # The Cover template is first, so page 1 uses it automatically.
    # We put a Spacer so the frame isn't empty, then break to the TOC.
    story.append(Spacer(1, 1))
    story.append(NextPageTemplate("TOCPage"))
    story.append(PageBreak())

    # ── Page 2: TOC ────────────────────────────────────────────────────────
    story.append(Paragraph("Table of Contents", styles["toc_title"]))

    toc = TableOfContents()
    toc.levelStyles = [styles["toc_entry"]]
    toc.dotsMinLevel = 0   # draw dot leaders for level 0
    story.append(toc)
    story.append(Spacer(1, 6))

    # ── Chapters ───────────────────────────────────────────────────────────
    for i, chapter in enumerate(chapters):
        chapter_num   = i + 1
        chapter_title = chapter.get("title", f"Chapter {chapter_num}")
        blocks        = chapter.get("blocks") or []

        # Chapter-divider page (full navy, decorative)
        story.append(NextPageTemplate(f"ChapterDivider_{chapter_num}"))
        story.append(PageBreak())

        # First content page of the chapter
        story.append(NextPageTemplate("Content"))
        story.append(PageBreak())

        # TOC anchor — registers this page number with the TOC
        story.append(_TOCAnchor(0, chapter_title))

        # Chapter title heading (visible at top of content)
        story.append(Paragraph(_esc(chapter_title), styles["chapter_title"]))

        # Block flowables
        if blocks:
            story.extend(_blocks_to_flowables(blocks, styles))
        else:
            story.append(Spacer(1, 1 * cm))

    return story


# ── Public entry point ────────────────────────────────────────────────────────

def generate(project: dict, buffer: BytesIO) -> None:
    """Build the dark-cinematic PDF and write it to *buffer*."""
    chapters = project.get("chapters") or []
    styles   = _make_styles()

    doc   = EbookDoc(buffer, project, chapters)
    story = _build_story(project, styles)

    doc.multiBuild(story)


