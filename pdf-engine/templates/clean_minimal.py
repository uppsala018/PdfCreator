"""
Clean Minimal PDF template.

Design spec (brief)
───────────────────
Cover      : white background, large deep-blue (#1A3A5C) title, thin gold rule line,
             subtitle and author below.
Header     : thin 1 pt grey line across the top of every content page;
             current chapter title centred in Helvetica 9 pt grey.
Body       : Helvetica 11 pt.
Heading    : Helvetica-Bold 20 pt, deep blue (#1A3A5C).
Subheading : Helvetica-Bold 13 pt, deep blue (#1A3A5C).
Pro Tip    : light-blue background (#EBF4FF), 3 pt deep-blue left border, dark text.
Prompt Card: white background, 3 pt gold left border, Courier 10 pt.
Table      : clean lines, bold header, no background colours.
Page nums  : bottom right, Helvetica 9 pt grey, starting at physical page 3.

Structural rules (same as dark-cinematic)
──────────────────────────────────────────
• Never break a heading from the paragraph that follows it (KeepTogether).
• Auto-generate cover → TOC → chapters.
• Page numbering starts at physical page 3.
"""

from __future__ import annotations
from io import BytesIO
from xml.sax.saxutils import escape as _xml_escape

from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
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

DEEP_BLUE  = HexColor("#1A3A5C")
GOLD       = HexColor("#C9A84C")
DARK_GREY  = HexColor("#333333")
MID_GREY   = HexColor("#888888")
LIGHT_GREY = HexColor("#F5F5F5")
LIGHT_BLUE = HexColor("#EBF4FF")
RULE_GREY  = HexColor("#CCCCCC")

# ── Page geometry ─────────────────────────────────────────────────────────────

PAGE_W, PAGE_H = A4
MARGIN   = 2 * cm
HEADER_H = 8 * mm      # space reserved at the top for header line + chapter title

FRAME_X = MARGIN
FRAME_Y = MARGIN
FRAME_W = PAGE_W - 2 * MARGIN
FRAME_H = PAGE_H - HEADER_H - 2 * MARGIN

# ── XML / newline helper ──────────────────────────────────────────────────────

def _esc(text: str) -> str:
    """Escape XML special chars; convert \\n to <br/> for ReportLab Paragraph."""
    if not text:
        return " "
    return _xml_escape(str(text)).replace("\n", "<br/>")

# ── Word-wrap helper for canvas drawing ──────────────────────────────────────

def _draw_centred_wrapped(
    canvas, text: str, font: str, size: float,
    cx: float, top_y: float, max_w: float,
    color, line_spacing: float,
) -> None:
    """Draw word-wrapped centred text starting at *top_y* (descending)."""
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

# ── Styles ────────────────────────────────────────────────────────────────────

def _make_styles() -> dict:
    return {
        "chapter_title": ParagraphStyle(
            "ChapterTitle",
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=26,
            textColor=DEEP_BLUE,
            spaceBefore=0,
            spaceAfter=14,
        ),
        "heading": ParagraphStyle(
            "Heading",
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=26,
            textColor=DEEP_BLUE,
            spaceBefore=12,
            spaceAfter=6,
        ),
        "subheading": ParagraphStyle(
            "Subheading",
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=17,
            textColor=DEEP_BLUE,
            spaceBefore=8,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "Body",
            fontName="Helvetica",
            fontSize=11,
            leading=15,
            textColor=DARK_GREY,
            spaceAfter=6,
        ),
        "toc_title": ParagraphStyle(
            "TOCTitle",
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=24,
            textColor=DEEP_BLUE,
            spaceAfter=16,
        ),
        "toc_entry": ParagraphStyle(
            "TOCEntry",
            fontName="Helvetica",
            fontSize=11,
            leading=18,
            textColor=DARK_GREY,
        ),
    }

# ── Custom flowables ──────────────────────────────────────────────────────────

class _ProTipBox(Flowable):
    """Light-blue box (#EBF4FF), 3 pt deep-blue left border, dark body text."""

    PAD    = 8
    BORDER = 3
    RADIUS = 3

    def __init__(self, text: str) -> None:
        super().__init__()
        self._text = text or " "

    def _lbl_s(self) -> ParagraphStyle:
        return ParagraphStyle(
            "_cm_lbl", fontName="Helvetica-Bold",
            fontSize=9, textColor=DEEP_BLUE, leading=11,
        )

    def _body_s(self) -> ParagraphStyle:
        return ParagraphStyle(
            "_cm_body", fontName="Helvetica",
            fontSize=11, textColor=DARK_GREY, leading=14,
        )

    def wrap(self, avail_w: float, avail_h: float):
        self._w = avail_w
        inner = avail_w - self.PAD * 2 - self.BORDER

        _, self._lh = Paragraph("PRO TIP", self._lbl_s()).wrap(inner, 9999)
        _, self._bh = Paragraph(_esc(self._text), self._body_s()).wrap(inner, 9999)

        self._h = self.PAD * 2 + self._lh + 4 + self._bh
        return avail_w, self._h

    def draw(self) -> None:
        c = self.canv
        w, h = self._w, self._h
        inner = w - self.PAD * 2 - self.BORDER
        c.saveState()

        # Light-blue background
        c.setFillColor(LIGHT_BLUE)
        c.roundRect(0, 0, w, h, self.RADIUS, fill=1, stroke=0)

        # Deep-blue left border
        c.setFillColor(DEEP_BLUE)
        c.roundRect(0, 0, self.BORDER, h, 1, fill=1, stroke=0)

        # Label
        lbl = Paragraph("PRO TIP", self._lbl_s())
        lbl.wrap(inner, 9999)
        lbl.drawOn(c, self.BORDER + self.PAD, h - self.PAD - self._lh)

        # Body
        bod = Paragraph(_esc(self._text), self._body_s())
        bod.wrap(inner, 9999)
        bod.drawOn(c, self.BORDER + self.PAD,
                   h - self.PAD - self._lh - 4 - self._bh)

        c.restoreState()


class _PromptCard(Flowable):
    """White box, 3 pt gold left border, Courier 10 pt, 8 pt padding."""

    PAD    = 8
    BORDER = 3
    RADIUS = 3

    def __init__(self, text: str) -> None:
        super().__init__()
        self._text = text or " "

    def _lbl_s(self) -> ParagraphStyle:
        return ParagraphStyle(
            "_cm_pclbl", fontName="Helvetica-Bold",
            fontSize=9, textColor=MID_GREY, leading=11,
        )

    def _body_s(self) -> ParagraphStyle:
        return ParagraphStyle(
            "_cm_pcbody", fontName="Courier",
            fontSize=10, textColor=DARK_GREY, leading=13,
        )

    def wrap(self, avail_w: float, avail_h: float):
        self._w = avail_w
        inner = avail_w - self.PAD * 2 - self.BORDER

        _, self._lh = Paragraph("PROMPT", self._lbl_s()).wrap(inner, 9999)
        _, self._bh = Paragraph(_esc(self._text), self._body_s()).wrap(inner, 9999)

        self._h = self.PAD * 2 + self._lh + 4 + self._bh
        return avail_w, self._h

    def draw(self) -> None:
        c = self.canv
        w, h = self._w, self._h
        inner = w - self.PAD * 2 - self.BORDER
        c.saveState()

        # White background with 1 pt light border
        c.setFillColor(white)
        c.setStrokeColor(RULE_GREY)
        c.setLineWidth(1)
        c.roundRect(0, 0, w, h, self.RADIUS, fill=1, stroke=1)

        # Gold left border (drawn on top of the white bg)
        c.setFillColor(GOLD)
        c.roundRect(0, 0, self.BORDER, h, 1, fill=1, stroke=0)

        # Label
        lbl = Paragraph("PROMPT", self._lbl_s())
        lbl.wrap(inner, 9999)
        lbl.drawOn(c, self.BORDER + self.PAD, h - self.PAD - self._lh)

        # Body
        bod = Paragraph(_esc(self._text), self._body_s())
        bod.wrap(inner, 9999)
        bod.drawOn(c, self.BORDER + self.PAD,
                   h - self.PAD - self._lh - 4 - self._bh)

        c.restoreState()


class _TOCAnchor(Flowable):
    """Zero-height; causes afterFlowable to register a TOC entry."""

    def __init__(self, level: int, text: str) -> None:
        super().__init__()
        self.toc_level = level
        self.toc_text  = text

    def wrap(self, *_):
        return (0, 0)

    def draw(self) -> None:
        pass


class _SetChapterTitle(Flowable):
    """
    Zero-height; placed BEFORE each chapter's PageBreak so that when the
    new page's onPage callback fires, doc._chapter_title is already updated.
    """

    def __init__(self, title: str) -> None:
        super().__init__()
        self.title = title

    def wrap(self, *_):
        return (0, 0)

    def draw(self) -> None:
        pass

# ── Page drawing callbacks ────────────────────────────────────────────────────

def _draw_cover(canvas, doc) -> None:
    """White cover: deep-blue title, thin gold rule, subtitle, author."""
    project = doc.project
    canvas.saveState()

    cx     = PAGE_W / 2
    max_w  = PAGE_W - 4 * MARGIN
    title  = project.get("title") or "Untitled"

    # White background
    canvas.setFillColor(white)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # Title (word-wrapped, deep blue)
    _draw_centred_wrapped(
        canvas, title, "Helvetica-Bold", 32,
        cx, PAGE_H * 0.62, max_w, DEEP_BLUE, line_spacing=40,
    )

    # Thin gold rule
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(1.5)
    canvas.line(cx - 3 * cm, PAGE_H * 0.56, cx + 3 * cm, PAGE_H * 0.56)

    # Subtitle
    subtitle = project.get("subtitle") or ""
    if subtitle:
        _draw_centred_wrapped(
            canvas, subtitle, "Helvetica", 14,
            cx, PAGE_H * 0.52, max_w, DARK_GREY, line_spacing=18,
        )

    # Author
    author = project.get("author") or ""
    if author:
        canvas.setFillColor(DARK_GREY)
        canvas.setFont("Helvetica", 12)
        canvas.drawCentredString(cx, PAGE_H * 0.16, author)

    # Website (small, below author)
    website = project.get("website") or ""
    if website:
        canvas.setFillColor(MID_GREY)
        canvas.setFont("Helvetica", 10)
        canvas.drawCentredString(cx, PAGE_H * 0.12, website)

    canvas.restoreState()


def _draw_content_header(canvas, doc) -> None:
    """
    1 pt grey rule across the top (inside margins), then current chapter
    title centred in 9 pt grey.  Page number bottom-right from page 3.
    """
    canvas.saveState()

    # Horizontal rule
    rule_y = PAGE_H - HEADER_H + (HEADER_H / 2)   # middle of the header zone
    canvas.setStrokeColor(RULE_GREY)
    canvas.setLineWidth(1)
    canvas.line(MARGIN, rule_y, PAGE_W - MARGIN, rule_y)

    # Chapter title centred above the rule
    chapter_title: str = getattr(doc, "_chapter_title", "")
    if chapter_title:
        canvas.setFillColor(MID_GREY)
        canvas.setFont("Helvetica", 9)
        canvas.drawCentredString(
            PAGE_W / 2,
            rule_y + 3,          # slightly above the rule
            chapter_title.upper(),
        )

    # Page number — bottom right from physical page 3
    if doc.page >= 3:
        canvas.setFillColor(MID_GREY)
        canvas.setFont("Helvetica", 9)
        canvas.drawRightString(PAGE_W - MARGIN, MARGIN / 2, str(doc.page))

    canvas.restoreState()


# ── Doc template ──────────────────────────────────────────────────────────────

class EbookDoc(BaseDocTemplate):
    """Registers chapter titles with the TOC and tracks the running header."""

    def __init__(self, buffer, project: dict) -> None:
        self.project        = project
        self._chapter_title = ""
        super().__init__(
            buffer,
            pagesize=A4,
            leftMargin=MARGIN,
            rightMargin=MARGIN,
            topMargin=HEADER_H + MARGIN,
            bottomMargin=MARGIN,
        )

        content_frame = Frame(
            FRAME_X, FRAME_Y, FRAME_W, FRAME_H,
            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        )
        full_frame = Frame(
            0, 0, PAGE_W, PAGE_H,
            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        )

        self.addPageTemplates([
            PageTemplate(id="Cover",   frames=[full_frame],    onPage=_draw_cover),
            PageTemplate(id="Content", frames=[content_frame], onPage=_draw_content_header),
            PageTemplate(id="TOCPage", frames=[content_frame], onPage=_draw_content_header),
        ])

    def afterFlowable(self, flowable) -> None:
        if isinstance(flowable, _SetChapterTitle):
            # Pre-set the chapter title so onPage sees it on the FIRST page of the chapter.
            self._chapter_title = flowable.title
        elif isinstance(flowable, _TOCAnchor):
            self.notify("TOCEntry", (flowable.toc_level, flowable.toc_text, self.page))

# ── Table ─────────────────────────────────────────────────────────────────────

def _make_table(rows: list[list[str]]) -> Table | Spacer:
    """Clean-minimal table: bold header row, grey grid lines, no backgrounds."""
    if not rows:
        return Spacer(1, 1)

    col_count = max(len(r) for r in rows)
    col_w = FRAME_W / col_count

    hdr_style = ParagraphStyle(
        "_cm_thdr", fontName="Helvetica-Bold",
        fontSize=10, leading=13, textColor=DEEP_BLUE,
    )
    bod_style = ParagraphStyle(
        "_cm_tbody", fontName="Helvetica",
        fontSize=10, leading=13, textColor=DARK_GREY,
    )

    table_data = []
    for ri, row in enumerate(rows):
        s = hdr_style if ri == 0 else bod_style
        padded = row + [""] * (col_count - len(row))
        table_data.append([Paragraph(_esc(cell), s) for cell in padded])

    tbl = Table(table_data, colWidths=[col_w] * col_count, repeatRows=1)
    tbl.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        # Header underline only — no background fill
        ("LINEBELOW",     (0, 0), (-1, 0),  1.5, DEEP_BLUE),
        # Outer box and inner grid in light grey
        ("BOX",           (0, 0), (-1, -1), 0.5, RULE_GREY),
        ("INNERGRID",     (0, 0), (-1, -1), 0.5, RULE_GREY),
    ]))
    return tbl

# ── Block → flowable converter ────────────────────────────────────────────────

def _blocks_to_flowables(blocks: list[dict], styles: dict) -> list:
    """
    Convert a chapter's block list to a list of ReportLab flowables.
    Headings and subheadings are wrapped with KeepTogether so they never
    split from the paragraph immediately following them.
    """
    raw: list = []

    for block in blocks:
        btype   = block.get("type", "paragraph")
        content = block.get("content", "")
        meta    = block.get("metadata") or {}

        if btype == "heading":
            raw.append(Paragraph(_esc(content), styles["heading"]))

        elif btype == "subheading":
            raw.append(Paragraph(_esc(content), styles["subheading"]))

        elif btype == "paragraph":
            raw.append(Paragraph(_esc(content), styles["body"]))

        elif btype == "pro_tip":
            raw.append(_ProTipBox(content))
            raw.append(Spacer(1, 4))

        elif btype == "prompt_card":
            raw.append(_PromptCard(content))
            raw.append(Spacer(1, 4))

        elif btype == "table":
            raw.append(_make_table(meta.get("rows", [])))
            raw.append(Spacer(1, 6))

        elif btype == "page_break":
            raw.append(NextPageTemplate("Content"))
            raw.append(PageBreak())

        elif btype == "chapter_divider":
            # Inline divider: a simple deep-blue rule (no full-page takeover)
            raw.append(Spacer(1, 6))
            raw.append(HRFlowable(
                width="100%", thickness=1.5,
                color=DEEP_BLUE, spaceAfter=6,
            ))

    # Keep every heading / subheading together with its following flowable.
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

# ── Story builder ─────────────────────────────────────────────────────────────

def _build_story(project: dict, styles: dict) -> list:
    chapters = project.get("chapters") or []
    story: list = []

    # ── Page 1: Cover ─────────────────────────────────────────────────────
    story.append(Spacer(1, 1))                    # prevent empty-frame warning
    story.append(NextPageTemplate("TOCPage"))
    story.append(PageBreak())

    # ── Page 2: Table of Contents ─────────────────────────────────────────
    story.append(Paragraph("Table of Contents", styles["toc_title"]))
    toc = TableOfContents()
    toc.levelStyles = [styles["toc_entry"]]
    toc.dotsMinLevel = 0
    story.append(toc)
    story.append(Spacer(1, 6))

    # ── Chapters ──────────────────────────────────────────────────────────
    for i, chapter in enumerate(chapters):
        ch_title = chapter.get("title", f"Chapter {i + 1}")
        blocks   = chapter.get("blocks") or []

        # _SetChapterTitle BEFORE the PageBreak so onPage sees the correct title
        # immediately on the first page of this chapter.
        story.append(_SetChapterTitle(ch_title))
        story.append(NextPageTemplate("Content"))
        story.append(PageBreak())

        # TOC anchor — registers page number
        story.append(_TOCAnchor(0, ch_title))

        # Chapter title heading at top of content
        story.append(Paragraph(_esc(ch_title), styles["chapter_title"]))

        if blocks:
            story.extend(_blocks_to_flowables(blocks, styles))
        else:
            story.append(Spacer(1, 1 * cm))

    return story

# ── Public entry point ────────────────────────────────────────────────────────

def generate(project: dict, buffer: BytesIO) -> None:
    """Build the clean-minimal PDF and write it to *buffer*."""
    styles = _make_styles()
    doc    = EbookDoc(buffer, project)
    story  = _build_story(project, styles)
    doc.multiBuild(story)
