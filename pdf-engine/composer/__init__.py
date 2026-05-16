"""Professional ebook composer foundation.

This package is intentionally standalone for now. It is not wired into the
existing Ebook Studio export route until the composer path is proven stable.
"""

__all__ = ["generate_sample_pdf"]


def __getattr__(name: str):
    if name == "generate_sample_pdf":
        from .professional_guide import generate_sample_pdf

        return generate_sample_pdf
    raise AttributeError(name)
