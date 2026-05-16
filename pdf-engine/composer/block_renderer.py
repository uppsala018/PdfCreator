"""Render structured ebook blocks into composer flowables."""

from __future__ import annotations

from dataclasses import dataclass, field

from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, Spacer

from .components import comparison_table, cta_box, key_takeaway_box, prompt_block, tip_box, warning_box
from .layout import (
    LARGE_SPACE,
    MEDIUM_SPACE,
    SMALL_SPACE,
    conditional_page_break,
    keep_together,
    minimum_space_before_large_component,
    safe_width,
    section_divider,
)
from .quality import ComponentMetric, QualityIssue, issue
from .schema import EbookBlock, SUPPORTED_BLOCK_TYPES
from .styles import build_styles
from .themes import ComposerTheme, DEFAULT_THEME


@dataclass
class RenderedBlock:
    flowables: list = field(default_factory=list)
    metrics: list[ComponentMetric] = field(default_factory=list)
    issues: list[QualityIssue] = field(default_factory=list)


def render_block(block: EbookBlock, theme: ComposerTheme = DEFAULT_THEME) -> RenderedBlock:
    styles = build_styles(theme)
    width = safe_width(theme)

    if block.type not in SUPPORTED_BLOCK_TYPES:
        return _unsupported_block(block, theme)

    if block.type == "paragraph":
        return RenderedBlock(
            [Paragraph(block.text, styles["body"])],
            [ComponentMetric("paragraph", "paragraph", width, width, estimated_height=_text_height(block.text, styles["body"].leading), text_length=len(block.text))],
        )

    if block.type in {"heading", "subheading"}:
        style = styles["section"] if block.type == "heading" else styles["callout_title"]
        heading_type = "subheading" if block.type == "subheading" else "heading"
        return RenderedBlock(
            [keep_together([conditional_page_break(28 * mm), Paragraph(block.text or block.title, style)])],
            [ComponentMetric(heading_type, heading_type, width, width, estimated_height=16 * mm, keep_with_next=True, minimum_safe_spacing=28 * mm, pagination_priority=8)],
        )

    if block.type in {"bullet_list", "numbered_list"}:
        return _render_list(block, theme)

    if block.type == "tip_box":
        return RenderedBlock([minimum_space_before_large_component("callout", theme), tip_box(block.text, theme)], [_metric("tip_box", "callout", width, block.text)])

    if block.type == "warning_box":
        return RenderedBlock([minimum_space_before_large_component("callout", theme), warning_box(block.text, theme)], [_metric("warning_box", "callout", width, block.text)])

    if block.type == "key_takeaway":
        return RenderedBlock([minimum_space_before_large_component("callout", theme), key_takeaway_box(block.text, theme)], [_metric("key_takeaway", "callout", width, block.text)])

    if block.type == "prompt_block":
        issues = []
        if not block.text:
            issues.append(issue("EMPTY_PROMPT", "warning", "Prompt block is empty.", "Provide prompt text or remove the block.", component="prompt_block"))
        text = block.text or "Prompt content coming soon."
        return RenderedBlock([minimum_space_before_large_component("prompt_block", theme), prompt_block(text, theme)], [_metric("prompt_block", "prompt", width, text, split_sensitive=True, priority=7)], issues)

    if block.type == "comparison_table":
        return _render_table(block, theme)

    if block.type == "workflow_step":
        title = block.title or "Workflow Step"
        body = block.text or "Step details coming soon."
        text = f"{title} {body}"
        return RenderedBlock([minimum_space_before_large_component("callout", theme), tip_box(f"<b>{title}</b><br/>{body}", theme)], [_metric("workflow_step", "callout", width, text)])

    if block.type == "cta_box":
        issues = []
        if not block.text:
            issues.append(issue("EMPTY_CTA", "warning", "CTA block is empty.", "Provide CTA text or remove the block.", component="cta_box"))
        text = block.text or "Add a clear next action."
        return RenderedBlock([minimum_space_before_large_component("cta_box", theme), cta_box(text, theme)], [_metric("cta_box", "cta", width, text, split_sensitive=True, priority=9)], issues)

    if block.type == "divider":
        return RenderedBlock([section_divider(theme)])

    if block.type == "spacer":
        spacer = {"small": SMALL_SPACE, "medium": MEDIUM_SPACE, "large": LARGE_SPACE}.get(block.size, MEDIUM_SPACE)
        issue_list = []
        if block.size not in {"small", "medium", "large"}:
            issue_list.append(issue("INVALID_SPACER_SIZE", "warning", "Spacer size is invalid.", "Use small, medium, or large.", component="spacer"))
        return RenderedBlock([spacer], [ComponentMetric("spacer", "spacer", 0, width, estimated_height={"small": 3 * mm, "medium": 6 * mm, "large": 10 * mm}.get(block.size, 6 * mm))], issue_list)

    return _unsupported_block(block, theme)


def _render_list(block: EbookBlock, theme: ComposerTheme) -> RenderedBlock:
    styles = build_styles(theme)
    if not block.items:
        return RenderedBlock(issues=[issue("EMPTY_LIST", "warning", f"{block.type} has no items.", "Add list items or remove the block.", component=block.type)])

    flowables = []
    for index, item in enumerate(block.items, start=1):
        bullet = f"{index}." if block.type == "numbered_list" else "•"
        flowables.append(Paragraph(item, styles["body"], bulletText=bullet))
    flowables.append(Spacer(1, 2 * mm))
    return RenderedBlock([keep_together(flowables)])


def _render_table(block: EbookBlock, theme: ComposerTheme) -> RenderedBlock:
    width = safe_width(theme)
    issues = []
    headers = block.headers
    rows = block.rows
    if not headers or not rows or any(len(row) != len(headers) for row in rows):
        issues.append(issue("INVALID_TABLE", "warning", "Comparison table has invalid headers or rows.", "Rendering a placeholder table.", component="comparison_table"))
        headers = ["Item", "Role", "Rule"]
        rows = [["Missing data", "Needs structure", "Provide equal column counts."]]
    estimated_text = " ".join(headers + [cell for row in rows for cell in row])
    return RenderedBlock(
        [minimum_space_before_large_component("comparison_table", theme), comparison_table(headers, rows, theme)],
        [_metric("comparison_table", "table", width, estimated_text, split_sensitive=True, priority=8)],
        issues,
    )


def _unsupported_block(block: EbookBlock, theme: ComposerTheme) -> RenderedBlock:
    warning = issue(
        "UNSUPPORTED_BLOCK_TYPE",
        "warning",
        f"Unsupported block type '{block.type}' rendered as a placeholder.",
        "Add a renderer for this block type.",
        component=block.type,
    )
    return RenderedBlock([warning_box(f"Unsupported block type: {block.type}", theme)], [ComponentMetric(block.type, "unsupported", safe_width(theme), safe_width(theme))], [warning])


def _metric(
    name: str,
    component_type: str,
    width: float,
    text: str,
    *,
    split_sensitive: bool = True,
    priority: int = 5,
) -> ComponentMetric:
    return ComponentMetric(
        name,
        component_type,
        width,
        width,
        estimated_height=max(24 * mm, _text_height(text, 14)),
        split_sensitive=split_sensitive,
        keep_with_next=True,
        minimum_safe_spacing=32 * mm,
        pagination_priority=priority,
        text_length=len(text),
    )


def _text_height(text: str, line_height: float) -> float:
    approx_lines = max(1, len(text) // 82 + 1)
    return approx_lines * line_height
