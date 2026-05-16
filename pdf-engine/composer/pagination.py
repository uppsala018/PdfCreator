"""Estimated pagination metadata for professional composer rendering."""

from __future__ import annotations

from dataclasses import dataclass
from math import ceil
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .schema import EbookChapter, EbookSection


@dataclass
class PaginationState:
    estimated_page: int = 3
    estimated_units_on_page: int = 0
    units_per_page: int = 12

    def place(self, units: int) -> int:
        if self.estimated_units_on_page and self.estimated_units_on_page + units > self.units_per_page:
            self.estimated_page += 1
            self.estimated_units_on_page = 0
        page = self.estimated_page
        self.estimated_units_on_page += units
        extra_pages = max(0, ceil(self.estimated_units_on_page / self.units_per_page) - 1)
        if extra_pages:
            self.estimated_page += extra_pages
            self.estimated_units_on_page = self.estimated_units_on_page % self.units_per_page
        return page

    def start_new_page(self) -> int:
        if self.estimated_units_on_page:
            self.estimated_page += 1
            self.estimated_units_on_page = 0
        return self.estimated_page


@dataclass(frozen=True)
class PaginationSummary:
    estimated_content_start_page: int
    finalized_page_count: int | None = None
    has_finalized_pages: bool = False


def summarize_pagination(finalized_page_count: int | None = None) -> PaginationSummary:
    return PaginationSummary(
        estimated_content_start_page=3,
        finalized_page_count=finalized_page_count,
        has_finalized_pages=finalized_page_count is not None,
    )


def estimate_chapter_units(chapter: "EbookChapter") -> int:
    return 2 + sum(estimate_section_units(section) for section in chapter.sections)


def estimate_section_units(section: "EbookSection") -> int:
    return 1 + sum(_block_units(block.type) for block in section.blocks)


def _block_units(block_type: str) -> int:
    if block_type in {"comparison_table", "prompt_block", "cta_box"}:
        return 2
    if block_type in {"tip_box", "warning_box", "key_takeaway", "workflow_step"}:
        return 2
    if block_type in {"divider", "spacer"}:
        return 1
    return 1
