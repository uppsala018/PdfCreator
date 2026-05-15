"""
Text ↔ block-list converter (Python).

Mirrors the TypeScript version in lib/text-converter.ts exactly so that
text round-trips identically through both implementations.

Rules
─────
  ## text       → subheading  (checked before heading)
  # text        → heading
  > text        → pro_tip
  PROMPT: text  → prompt_card
  ---           → page_break   (exact match)
  ===           → chapter_divider (exact match)
  col | col     → table row   (consecutive pipe-lines → one table block)
  blank line    → flush open accumulator
  anything else → paragraph   (consecutive plain lines → one paragraph)
"""

import uuid


def _make(block_type: str, content: str, metadata: dict | None = None) -> dict:
    block = {"id": str(uuid.uuid4()), "type": block_type, "content": content}
    if metadata is not None:
        block["metadata"] = metadata
    return block


def text_to_blocks(text: str) -> list[dict]:
    """Convert plain text to a list of block dicts."""
    lines = text.split("\n")
    blocks: list[dict] = []
    para_lines: list[str] = []
    table_rows: list[list[str]] = []

    def flush_para():
        if para_lines:
            blocks.append(_make("paragraph", "\n".join(para_lines)))
            para_lines.clear()

    def flush_table():
        if table_rows:
            blocks.append(_make("table", "", {"rows": [row[:] for row in table_rows]}))
            table_rows.clear()

    for raw in lines:
        line = raw.strip()

        # ── blank line ─────────────────────────────────────────────────────
        if not line:
            flush_table()
            flush_para()
            continue

        # ── subheading (## — must come before heading) ─────────────────────
        if line.startswith("## "):
            flush_table(); flush_para()
            blocks.append(_make("subheading", line[3:].strip()))
            continue

        # ── heading (# ) ───────────────────────────────────────────────────
        if line.startswith("# "):
            flush_table(); flush_para()
            blocks.append(_make("heading", line[2:].strip()))
            continue

        # ── pro tip (> ) ───────────────────────────────────────────────────
        if line.startswith("> "):
            flush_table(); flush_para()
            blocks.append(_make("pro_tip", line[2:].strip()))
            continue

        # ── prompt card (PROMPT: ) ─────────────────────────────────────────
        if line.startswith("PROMPT: "):
            flush_table(); flush_para()
            blocks.append(_make("prompt_card", line[8:].strip()))
            continue

        # ── page break (exactly ---) ───────────────────────────────────────
        if line == "---":
            flush_table(); flush_para()
            blocks.append(_make("page_break", ""))
            continue

        # ── chapter divider (exactly ===) ──────────────────────────────────
        if line == "===":
            flush_table(); flush_para()
            blocks.append(_make("chapter_divider", ""))
            continue

        # ── table row (contains |) ─────────────────────────────────────────
        if "|" in line:
            flush_para()
            table_rows.append([c.strip() for c in line.split("|")])
            continue

        # ── paragraph ──────────────────────────────────────────────────────
        flush_table()
        para_lines.append(line)

    flush_table()
    flush_para()
    return blocks


def blocks_to_text(blocks: list[dict]) -> str:
    """Convert a list of block dicts back to plain text."""
    segments: list[str] = []

    for block in blocks:
        btype = block.get("type", "paragraph")
        content = block.get("content", "")

        if btype == "heading":
            segments.append(f"# {content}")
        elif btype == "subheading":
            segments.append(f"## {content}")
        elif btype == "paragraph":
            segments.append(content)
        elif btype == "pro_tip":
            segments.append(f"> {content}")
        elif btype == "prompt_card":
            segments.append(f"PROMPT: {content}")
        elif btype == "table":
            rows = (block.get("metadata") or {}).get("rows", [])
            if rows:
                segments.append("\n".join(" | ".join(row) for row in rows))
        elif btype == "page_break":
            segments.append("---")
        elif btype == "chapter_divider":
            segments.append("===")

    return "\n\n".join(segments)
