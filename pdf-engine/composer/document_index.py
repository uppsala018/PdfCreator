"""Document hierarchy index for navigation-aware ebook rendering."""

from __future__ import annotations

from dataclasses import dataclass, field
import re


@dataclass(frozen=True)
class IndexEntry:
    title: str
    level: int
    entry_type: str
    order: int
    anchor_id: str
    estimated_page: int | None = None
    page_number: int | None = None


@dataclass
class DocumentIndex:
    entries: list[IndexEntry] = field(default_factory=list)
    _seen_ids: set[str] = field(default_factory=set)

    def register(self, title: str, level: int, entry_type: str, estimated_page: int | None = None) -> IndexEntry:
        base_id = slugify(title or entry_type)
        anchor_id = base_id
        suffix = 2
        while anchor_id in self._seen_ids:
            anchor_id = f"{base_id}-{suffix}"
            suffix += 1
        self._seen_ids.add(anchor_id)

        entry = IndexEntry(
            title=title,
            level=level,
            entry_type=entry_type,
            order=len(self.entries) + 1,
            anchor_id=anchor_id,
            estimated_page=estimated_page,
        )
        self.entries.append(entry)
        return entry

    def chapters(self) -> list[IndexEntry]:
        return [entry for entry in self.entries if entry.entry_type == "chapter"]


def slugify(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return normalized or "entry"
