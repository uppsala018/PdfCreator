"""Safe font registration for the professional composer.

Place open-source TTF files under ``pdf-engine/composer/assets/fonts`` to make
the composer embed them. No font files are committed by default.
"""

from __future__ import annotations

from pathlib import Path

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONT_ASSET_DIR = Path(__file__).resolve().parent / "assets" / "fonts"
SYSTEM_FONT_DIRS = [Path("C:/Windows/Fonts")]

DISPLAY_CANDIDATES = [
    (
        "ComposerDisplay",
        [
            "PlayfairDisplay-Regular.ttf",
            "CormorantGaramond-Regular.ttf",
            "EBGaramond-Regular.ttf",
            "LibreBaskerville-Regular.ttf",
            "georgia.ttf",
        ],
    ),
    (
        "ComposerDisplayBold",
        [
            "PlayfairDisplay-Bold.ttf",
            "CormorantGaramond-Bold.ttf",
            "EBGaramond-Bold.ttf",
            "LibreBaskerville-Bold.ttf",
            "georgiab.ttf",
        ],
    ),
]

BODY_CANDIDATES = [
    (
        "ComposerBody",
        [
            "Inter-Regular.ttf",
            "SourceSans3-Regular.ttf",
            "DMSans-Regular.ttf",
            "Lato-Regular.ttf",
            "Montserrat-Regular.ttf",
            "Poppins-Regular.ttf",
        ],
    ),
    (
        "ComposerBodyBold",
        [
            "Inter-Bold.ttf",
            "SourceSans3-Bold.ttf",
            "DMSans-Bold.ttf",
            "Lato-Bold.ttf",
            "Montserrat-Bold.ttf",
            "Poppins-Bold.ttf",
        ],
    ),
]


def _find_font(filename: str) -> Path | None:
    for directory in [FONT_ASSET_DIR, *SYSTEM_FONT_DIRS]:
        path = directory / filename
        if path.exists():
            return path
    return None


def _register_font(font_name: str, candidates: list[str], fallback: str) -> str:
    if font_name in pdfmetrics.getRegisteredFontNames():
        return font_name

    for filename in candidates:
        path = _find_font(filename)
        if not path:
            continue
        try:
            pdfmetrics.registerFont(TTFont(font_name, str(path)))
            return font_name
        except Exception:
            continue

    return fallback


def resolve_premium_fonts() -> dict[str, str]:
    """Return registered premium font names with built-in fallbacks."""

    display = _register_font(DISPLAY_CANDIDATES[0][0], DISPLAY_CANDIDATES[0][1], "Times-Roman")
    display_bold = _register_font(DISPLAY_CANDIDATES[1][0], DISPLAY_CANDIDATES[1][1], "Times-Bold")
    body = _register_font(BODY_CANDIDATES[0][0], BODY_CANDIDATES[0][1], "Helvetica")
    body_bold = _register_font(BODY_CANDIDATES[1][0], BODY_CANDIDATES[1][1], "Helvetica-Bold")

    return {
        "display": display,
        "display_bold": display_bold,
        "body": body,
        "body_bold": body_bold,
        "mono": "Courier",
    }
