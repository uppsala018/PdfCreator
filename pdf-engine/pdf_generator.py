"""Entry point — dispatches to the correct template."""

from __future__ import annotations
import io


def generate_pdf(project: dict, template: str) -> bytes:
    """
    Generate a PDF for *project* using the named template.
    Returns raw PDF bytes.
    """
    buffer = io.BytesIO()

    if template == "clean-minimal":
        from templates.clean_minimal import generate
    else:
        # Default / 'dark-cinematic'
        from templates.dark_cinematic import generate

    generate(project, buffer)
    return buffer.getvalue()
