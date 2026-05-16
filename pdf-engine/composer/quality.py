"""Layout quality diagnostics for the professional composer.

This module is intentionally metadata based for now. Future phases should add
rendered-page checks that can inspect pixels and actual post-pagination layout.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from reportlab.lib import colors
from reportlab.lib.units import mm

from .document_index import DocumentIndex
from .layout import content_width, cover_frame, safe_width
from .pagination import PaginationSummary
from .styles import build_styles
from .themes import ComposerTheme, DEFAULT_THEME

Severity = Literal["info", "warning", "error"]


@dataclass(frozen=True)
class QualityIssue:
    code: str
    severity: Severity
    message: str
    suggested_fix: str
    page_number: int | None = None
    component: str | None = None


@dataclass(frozen=True)
class ComponentMetric:
    name: str
    component_type: str
    width: float
    max_width: float
    page_number: int | None = None
    estimated_height: float | None = None
    split_sensitive: bool = False
    keep_with_next: bool = False
    minimum_safe_spacing: float | None = None
    pagination_priority: int = 0
    text_length: int = 0


@dataclass(frozen=True)
class RuleMetric:
    name: str
    width: float
    max_width: float
    page_number: int | None = None


@dataclass(frozen=True)
class QualityReport:
    issues: list[QualityIssue]

    @property
    def has_errors(self) -> bool:
        return any(issue.severity == "error" for issue in self.issues)

    def counts(self) -> dict[str, int]:
        return {
            "info": sum(issue.severity == "info" for issue in self.issues),
            "warning": sum(issue.severity == "warning" for issue in self.issues),
            "error": sum(issue.severity == "error" for issue in self.issues),
        }


def issue(
    code: str,
    severity: Severity,
    message: str,
    suggested_fix: str,
    page_number: int | None = None,
    component: str | None = None,
) -> QualityIssue:
    return QualityIssue(
        code=code,
        severity=severity,
        page_number=page_number,
        component=component,
        message=message,
        suggested_fix=suggested_fix,
    )


def detect_sparse_page(*_, **__) -> list[QualityIssue]:
    # TODO: Use rendered page density once page images are available.
    return []


def detect_blank_page(*_, **__) -> list[QualityIssue]:
    # TODO: Detect actual blank pages after rendering or PDF content inspection.
    return []


def detect_orphan_heading(*_, **__) -> list[QualityIssue]:
    # TODO: Inspect post-pagination heading positions after PDF generation.
    return []


def detect_oversized_block(metric: ComponentMetric) -> list[QualityIssue]:
    if metric.width <= metric.max_width:
        return []
    return [
        issue(
            "OVERSIZED_BLOCK",
            "error",
            f"{metric.name} width exceeds its safe layout width.",
            "Reduce component width or increase its safe container constraints.",
            page_number=metric.page_number,
            component=metric.name,
        )
    ]


def detect_rule_outside_bounds(metric: RuleMetric) -> list[QualityIssue]:
    if metric.width <= metric.max_width:
        return []
    return [
        issue(
            "RULE_OUTSIDE_BOUNDS",
            "error",
            f"{metric.name} decorative rule exceeds its allowed frame width.",
            "Use bounded_rule() or draw_bounded_rule() with frame/content width.",
            page_number=metric.page_number,
            component=metric.name,
        )
    ]


def detect_box_overflow_risk(metric: ComponentMetric) -> list[QualityIssue]:
    if not metric.split_sensitive:
        return []
    ratio = metric.width / metric.max_width if metric.max_width else 1
    if ratio < 0.98:
        return []
    return [
        issue(
            "BOX_OVERFLOW_RISK",
            "info",
            f"{metric.name} uses nearly the full safe width.",
            "Keep generous internal padding and avoid long unbreakable text.",
            page_number=metric.page_number,
            component=metric.name,
        )
    ]


def detect_table_split_risk(metric: ComponentMetric) -> list[QualityIssue]:
    if metric.component_type != "table":
        return []
    return [
        issue(
            "TABLE_SPLIT_REVIEW",
            "info",
            f"{metric.name} should be reviewed for row splitting in longer ebooks.",
            "Keep small tables together and add rendered QA for long tables.",
            page_number=metric.page_number,
            component=metric.name,
        )
    ]


def detect_cta_too_close_to_page_edge(metric: ComponentMetric, theme: ComposerTheme = DEFAULT_THEME) -> list[QualityIssue]:
    if metric.component_type != "cta":
        return []
    if theme.margin_x >= 16 * mm:
        return []
    return [
        issue(
            "CTA_EDGE_MARGIN",
            "warning",
            f"{metric.name} may sit too close to the page edge.",
            "Increase page margins or reduce CTA width.",
            page_number=metric.page_number,
            component=metric.name,
        )
    ]


def detect_excessive_whitespace(*_, **__) -> list[QualityIssue]:
    # TODO: Use rendered content density and flowable positions.
    return []


def detect_low_contrast_pair(foreground: colors.Color, background: colors.Color, name: str) -> list[QualityIssue]:
    ratio = _contrast_ratio(foreground, background)
    if ratio >= 4.5:
        return []
    return [
        issue(
            "LOW_CONTRAST",
            "warning",
            f"{name} contrast ratio is {ratio:.2f}:1, below body-text guidance.",
            "Use a lighter foreground or darker background for readable text.",
            component=name,
        )
    ]


def run_quality_checks(
    theme: ComposerTheme = DEFAULT_THEME,
    component_metrics: list[ComponentMetric] | None = None,
    rule_metrics: list[RuleMetric] | None = None,
    document_index: DocumentIndex | None = None,
    pagination_summary: PaginationSummary | None = None,
) -> QualityReport:
    issues: list[QualityIssue] = []
    component_metrics = component_metrics or sample_component_metrics(theme)
    rule_metrics = rule_metrics or sample_rule_metrics(theme)

    issues.extend(_detect_theme_sanity(theme))
    issues.extend(_detect_cover_geometry(theme))
    issues.extend(_detect_minimum_font_sizes(theme))

    for metric in component_metrics:
        issues.extend(detect_oversized_block(metric))
        issues.extend(detect_box_overflow_risk(metric))
        issues.extend(detect_table_split_risk(metric))
        issues.extend(detect_cta_too_close_to_page_edge(metric, theme))
        issues.extend(detect_orphan_heading_risk(metric))
        issues.extend(detect_oversized_grouped_component_risk(metric, theme))
        issues.extend(detect_long_unbroken_text_block(metric))
    issues.extend(detect_suspicious_blank_space_accumulation(component_metrics))

    for metric in rule_metrics:
        issues.extend(detect_rule_outside_bounds(metric))

    if document_index:
        issues.extend(detect_document_index_issues(document_index))
        issues.extend(detect_toc_monotonicity_issues(document_index))
        issues.extend(detect_chapter_ending_imbalance(document_index))
    if pagination_summary:
        issues.extend(detect_pagination_summary_issues(pagination_summary))
        issues.extend(detect_excessive_page_sparsity(pagination_summary, document_index))

    return QualityReport(issues)


def detect_pagination_summary_issues(summary: PaginationSummary) -> list[QualityIssue]:
    if summary.has_finalized_pages:
        return []
    return [
        issue(
            "PAGINATION_NOT_RECONCILED",
            "info",
            "Pagination metadata is estimated and has not been reconciled with final rendered page positions.",
            "Add post-render page map capture in the next pagination phase.",
        )
    ]


def detect_orphan_heading_risk(metric: ComponentMetric) -> list[QualityIssue]:
    if metric.component_type not in {"chapter", "section", "heading", "subheading"}:
        return []
    if metric.keep_with_next:
        return []
    return [
        issue(
            "ORPHAN_HEADING_RISK",
            "warning",
            f"{metric.name} is not marked keep-with-next.",
            "Wrap headings with keep_heading_with_next() or safe_section_start().",
            page_number=metric.page_number,
            component=metric.name,
        )
    ]


def detect_oversized_grouped_component_risk(metric: ComponentMetric, theme: ComposerTheme = DEFAULT_THEME) -> list[QualityIssue]:
    if not metric.split_sensitive or not metric.estimated_height:
        return []
    _, page_height = theme.page_size
    usable_height = page_height - theme.margin_top - theme.margin_bottom
    if metric.estimated_height < usable_height * 0.72:
        return []
    return [
        issue(
            "OVERSIZED_GROUP_RISK",
            "warning",
            f"{metric.name} is split-sensitive and may be too tall to keep together.",
            "Shorten the component or allow a controlled split with repeated context.",
            page_number=metric.page_number,
            component=metric.name,
        )
    ]


def detect_long_unbroken_text_block(metric: ComponentMetric) -> list[QualityIssue]:
    if metric.text_length < 700:
        return []
    return [
        issue(
            "LONG_TEXT_BLOCK",
            "info",
            f"{metric.name} contains a long text block.",
            "Consider splitting long prose into paragraphs, callouts, or lists.",
            page_number=metric.page_number,
            component=metric.name,
        )
    ]


def detect_suspicious_blank_space_accumulation(metrics: list[ComponentMetric]) -> list[QualityIssue]:
    spacer_count = sum(metric.component_type == "spacer" for metric in metrics)
    if spacer_count < 4:
        return []
    return [
        issue(
            "BLANK_SPACE_ACCUMULATION",
            "info",
            "Document contains multiple explicit spacers.",
            "Review spacing rhythm once rendered-page density checks are available.",
        )
    ]


def detect_document_index_issues(index: DocumentIndex) -> list[QualityIssue]:
    issues: list[QualityIssue] = []
    if not index.entries:
        issues.append(issue("EMPTY_TOC", "warning", "Table of contents has no registered entries.", "Register chapters and sections before building the TOC."))
        return issues

    if not index.chapters():
        issues.append(issue("MISSING_REGISTERED_CHAPTERS", "warning", "Document index has no chapter entries.", "Register each chapter with level=1."))

    seen: set[str] = set()
    duplicates: set[str] = set()
    for entry in index.entries:
        if entry.anchor_id in seen:
            duplicates.add(entry.anchor_id)
        seen.add(entry.anchor_id)
        if len(entry.title) > 90:
            issues.append(
                issue(
                    "LONG_TOC_ENTRY",
                    "info",
                    f"TOC entry '{entry.title[:48]}...' is long.",
                    "Use shorter section titles or allow a two-line TOC entry.",
                    page_number=entry.estimated_page,
                    component=entry.anchor_id,
                )
            )
        if entry.entry_type == "chapter" and entry.estimated_page is None:
            issues.append(issue("CHAPTER_PAGE_UNKNOWN", "info", f"Chapter '{entry.title}' has no estimated page.", "Attach pagination metadata during rendering.", component=entry.anchor_id))

    for anchor_id in duplicates:
        issues.append(issue("DUPLICATE_HEADING_ID", "error", f"Duplicate heading id '{anchor_id}' detected.", "Ensure slug generation creates unique anchor ids.", component=anchor_id))

    # TODO: Detect orphaned chapter starts and headings near page bottoms after real pagination metadata exists.
    return issues


def detect_toc_monotonicity_issues(index: DocumentIndex) -> list[QualityIssue]:
    issues: list[QualityIssue] = []
    previous_page = -1
    for entry in index.entries:
        current_page = entry.estimated_page or 0
        if previous_page and current_page and current_page < previous_page:
            issues.append(
                issue(
                    "TOC_PAGE_ORDER",
                    "warning",
                    "TOC entries are not monotonically ordered by estimated page.",
                    "Reconcile pagination metadata or adjust section/chapter placement.",
                    page_number=current_page,
                    component=entry.anchor_id,
                )
            )
        if current_page:
            previous_page = current_page
    return issues


def detect_chapter_ending_imbalance(index: DocumentIndex) -> list[QualityIssue]:
    issues: list[QualityIssue] = []
    chapters = index.chapters()
    for current, nxt in zip(chapters, chapters[1:]):
        if current.estimated_page and nxt.estimated_page and (nxt.estimated_page - current.estimated_page) > 6:
            issues.append(
                issue(
                    "CHAPTER_ENDING_IMBALANCE",
                    "info",
                    f"Chapter '{current.title}' ends far before the next chapter starts.",
                    "Review chapter pacing and section density for the final pages.",
                    page_number=current.estimated_page,
                    component=current.anchor_id,
                )
            )
    return issues


def detect_excessive_page_sparsity(summary: PaginationSummary, index: DocumentIndex | None = None) -> list[QualityIssue]:
    if not summary.finalized_page_count:
        return []
    entry_count = len(index.entries) if index else 0
    if summary.finalized_page_count < 6 or entry_count >= summary.finalized_page_count * 2:
        return []
    return [
        issue(
            "PAGE_SPARSITY",
            "info",
            "Final document appears sparse relative to registered content.",
            "Add more content, reduce forced page breaks, or rebalance chapter flow.",
        )
    ]


def sample_component_metrics(theme: ComposerTheme = DEFAULT_THEME) -> list[ComponentMetric]:
    max_width = content_width(theme)
    return [
        ComponentMetric("cover_text_frame", "cover", cover_frame(theme)["text_width"], cover_frame(theme)["frame_width"], page_number=1),
        ComponentMetric("callout_box", "callout", safe_width(theme), max_width),
        ComponentMetric("prompt_block", "prompt", safe_width(theme), max_width),
        ComponentMetric("cta_box", "cta", safe_width(theme), max_width),
        ComponentMetric("comparison_table", "table", safe_width(theme), max_width),
        ComponentMetric("back_cover_panel", "back_cover", safe_width(theme), max_width),
    ]


def sample_rule_metrics(theme: ComposerTheme = DEFAULT_THEME) -> list[RuleMetric]:
    frame = cover_frame(theme)
    return [
        RuleMetric("cover_center_divider", 26 * mm, frame["text_width"], page_number=1),
        RuleMetric("cover_top_accent", 20 * mm, frame["frame_width"], page_number=1),
        RuleMetric("cover_bottom_accent", 20 * mm, frame["frame_width"], page_number=1),
        RuleMetric("section_divider", 34 * mm, content_width(theme)),
        RuleMetric("page_header_accent", 11 * mm, content_width(theme)),
    ]


def format_quality_report(report: QualityReport) -> str:
    counts = report.counts()
    lines = [
        "Quality diagnostics:",
        f"  errors={counts['error']} warnings={counts['warning']} info={counts['info']}",
    ]
    if not report.issues:
        lines.append("  No metadata-level layout issues detected.")
        return "\n".join(lines)

    for item in report.issues:
        location = []
        if item.page_number is not None:
            location.append(f"page {item.page_number}")
        if item.component:
            location.append(item.component)
        suffix = f" ({', '.join(location)})" if location else ""
        lines.append(f"  [{item.severity.upper()}] {item.code}{suffix}: {item.message}")
        lines.append(f"    Fix: {item.suggested_fix}")
    return "\n".join(lines)


def _detect_theme_sanity(theme: ComposerTheme) -> list[QualityIssue]:
    issues: list[QualityIssue] = []
    required_colors = [
        ("near_black", theme.near_black),
        ("charcoal", theme.charcoal),
        ("gold", theme.gold),
        ("ivory", theme.ivory),
        ("ink", theme.ink),
        ("secondary_text", theme.secondary_text),
    ]
    for name, value in required_colors:
        if value is None:
            issues.append(issue("MISSING_THEME_COLOR", "error", f"Theme color {name} is missing.", "Define the color in ComposerTheme."))

    if theme.margin_x < 14 * mm or theme.margin_top < 14 * mm or theme.margin_bottom < 14 * mm:
        issues.append(
            issue(
                "MARGIN_TOO_SMALL",
                "warning",
                "One or more page margins are below the professional composer minimum.",
                "Use at least 14mm margins for long-form PDF reading.",
            )
        )
    return issues


def _detect_cover_geometry(theme: ComposerTheme) -> list[QualityIssue]:
    frame = cover_frame(theme)
    issues: list[QualityIssue] = []
    if frame["frame_width"] > frame["panel_width"]:
        issues.append(issue("COVER_FRAME_OVERFLOW", "error", "Cover frame exceeds panel width.", "Reduce frame inset or panel width."))
    if frame["text_width"] > frame["frame_width"]:
        issues.append(issue("COVER_TEXT_OVERFLOW", "error", "Cover text width exceeds frame width.", "Increase text inset or reduce text width."))
    if frame["text_width"] < 80 * mm:
        issues.append(issue("COVER_TEXT_TOO_NARROW", "warning", "Cover text frame may be too narrow for premium headings.", "Increase cover text width or reduce title size.", page_number=1, component="cover_text_frame"))
    return issues


def _detect_minimum_font_sizes(theme: ComposerTheme) -> list[QualityIssue]:
    styles = build_styles(theme)
    issues: list[QualityIssue] = []
    for name, style in styles.items():
        if style.fontSize < 7:
            issues.append(
                issue(
                    "FONT_TOO_SMALL",
                    "warning",
                    f"{name} font size is below 7pt.",
                    "Increase the font size for reliable print/PDF readability.",
                    component=name,
                )
            )
    return issues


def _contrast_ratio(foreground: colors.Color, background: colors.Color) -> float:
    fg = _relative_luminance(foreground)
    bg = _relative_luminance(background)
    lighter = max(fg, bg)
    darker = min(fg, bg)
    return (lighter + 0.05) / (darker + 0.05)


def _relative_luminance(color: colors.Color) -> float:
    channels = [_linearize(color.red), _linearize(color.green), _linearize(color.blue)]
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def _linearize(value: float) -> float:
    if value <= 0.03928:
        return value / 12.92
    return ((value + 0.055) / 1.055) ** 2.4


# TODO: Add visual/PDF-render QA:
# - render pages to images
# - detect actual pixel overflow
# - detect visual overlap
# - detect sparse pages by rendered content density
# - detect orphan headings after PDF generation
