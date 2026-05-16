#!/usr/bin/env python3
"""
Comprehensive smoke tests for the Ebook Studio PDF engine.

Checks:
  - Both templates generate valid PDFs
  - All 8 block types render without error
  - Multi-line paragraph content (\\n) renders correctly
  - XML special characters in content are safe
  - Flask API: /health, /generate, template validation, unknown template 400
  - Empty chapters handled gracefully
  - Long titles word-wrap on the cover

Run from inside pdf-engine/: python test_pdf.py
"""

import sys
import os
import json
import re

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pdf_generator import generate_pdf

# â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

PASS = "PASS"
FAIL = "FAIL"
results = []

def check(name, condition, detail=""):
    status = PASS if condition else FAIL
    results.append((status, name, detail))
    print(f"  [{status}] {name}" + (f" â€” {detail}" if detail else ""))
    return condition

def page_count(pdf_bytes):
    text = pdf_bytes.decode("latin-1", errors="replace")
    return len(re.findall(r"/Type\s*/Page\b", text))

# â”€â”€ Sample projects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ALL_BLOCKS_CHAPTER = {
    "id": "ch1",
    "title": "All Block Types",
    "blocks": [
        {"id": "b1",  "type": "heading",
         "content": "Main Heading â€” Test"},
        {"id": "b2",  "type": "paragraph",
         "content": "A paragraph of body text."},
        {"id": "b3",  "type": "subheading",
         "content": "A Subheading"},
        {"id": "b4",  "type": "paragraph",
         "content": "Paragraph after the subheading."},
        {"id": "b5",  "type": "pro_tip",
         "content": "This is a pro tip with gold/blue left border."},
        {"id": "b6",  "type": "prompt_card",
         "content": "Write a compelling opening scene."},
        {"id": "b7",  "type": "table",
         "content": "",
         "metadata": {"rows": [
             ["Feature", "Dark Cinematic", "Clean Minimal"],
             ["Background", "Navy", "White"],
             ["Headings", "White/Navy", "Deep Blue"],
             ["Pro Tip", "Navy box", "Light blue box"],
         ]}},
        {"id": "b8",  "type": "page_break", "content": ""},
        {"id": "b9",  "type": "heading",
         "content": "After Page Break"},
        {"id": "b10", "type": "paragraph",
         "content": "Content after the page break."},
        {"id": "b11", "type": "chapter_divider", "content": ""},
        {"id": "b12", "type": "paragraph",
         "content": "Content after the chapter divider."},
    ],
}

FULL_PROJECT = {
    "title": "100 ChatGPT Prompts for Writers",
    "subtitle": "A Complete Creative Writing Companion",
    "author": "Jane Smith",
    "website": "ebookstudio.io",
    "theme": "dark-cinematic",
    "chapters": [
        ALL_BLOCKS_CHAPTER,
        {
            "id": "ch2",
            "title": "Character Development",
            "blocks": [
                {"id": "b13", "type": "heading",
                 "content": "Building Vivid Characters"},
                {"id": "b14", "type": "paragraph",
                 "content": "Great characters have contradictions."},
                {"id": "b15", "type": "pro_tip",
                 "content": "Give your protagonist a ghost from their past."},
                {"id": "b16", "type": "prompt_card",
                 "content": "Write a scene where your hero discovers a lie."},
            ],
        },
        {
            "id": "ch3",
            "title": "Plot & Structure",
            "blocks": [
                {"id": "b17", "type": "heading",
                 "content": "The Architecture of Story"},
                {"id": "b18", "type": "paragraph",
                 "content": "Story structure is not a cage â€” it is a skeleton."},
            ],
        },
    ],
}

# â”€â”€ Test 1: Dark-cinematic template â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

print("\n-- dark-cinematic template --")
try:
    dc_pdf = generate_pdf(FULL_PROJECT, "dark-cinematic")
    check("generates valid PDF bytes", len(dc_pdf) > 1000)
    check("starts with PDF signature", dc_pdf[:4] == b"%PDF")
    dc_pages = page_count(dc_pdf)
    # Cover(1) + TOC(1) + 3 chapters * (divider + content) = 1+1+6 = 8 minimum
    check("has >= 8 pages", dc_pages >= 8, f"got {dc_pages}")
    with open("dark_cinematic_test.pdf", "wb") as f:
        f.write(dc_pdf)
    check("saved to disk", True, f"{len(dc_pdf):,} bytes, {dc_pages} pages")
except Exception as exc:
    check("no exception", False, str(exc))

# â”€â”€ Test 2: Clean-minimal template â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

print("\n-- clean-minimal template --")
cm_project = {**FULL_PROJECT, "theme": "clean-minimal"}
try:
    cm_pdf = generate_pdf(cm_project, "clean-minimal")
    check("generates valid PDF bytes", len(cm_pdf) > 1000)
    check("starts with PDF signature", cm_pdf[:4] == b"%PDF")
    cm_pages = page_count(cm_pdf)
    # Cover(1) + TOC(1) + 3 chapters (content only, no dividers) = 1+1+3+ = 5+
    check("has >= 5 pages", cm_pages >= 5, f"got {cm_pages}")
    with open("clean_minimal_test.pdf", "wb") as f:
        f.write(cm_pdf)
    check("saved to disk", True, f"{len(cm_pdf):,} bytes, {cm_pages} pages")
except Exception as exc:
    check("no exception", False, str(exc))

# â”€â”€ Test 3: All 8 block types in clean-minimal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

print("\n-- all block types (clean-minimal) --")
try:
    single_chapter_project = {
        "title": "Block Type Test",
        "chapters": [ALL_BLOCKS_CHAPTER],
    }
    pdf = generate_pdf(single_chapter_project, "clean-minimal")
    check("all block types render", pdf[:4] == b"%PDF",
          f"{len(pdf):,} bytes")
except Exception as exc:
    check("no exception", False, str(exc))

# â”€â”€ Test 4: XML / special characters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

print("\n-- special characters in content --")
try:
    special_project = {
        "title": "Test: Ampersands & Angles",
        "subtitle": "Handling <tags> & 'quotes'",
        "author": "A & B",
        "chapters": [{
            "id": "c1",
            "title": "Special Chars",
            "blocks": [
                {"id": "s1", "type": "heading",
                 "content": "Chapter with & < > \" '"},
                {"id": "s2", "type": "paragraph",
                 "content": "Paragraph with <XML> & ampersands."},
                {"id": "s3", "type": "pro_tip",
                 "content": "Tip: use 'quotes' and <brackets> freely."},
                {"id": "s4", "type": "prompt_card",
                 "content": "Write about A & B > C and x < y."},
                {"id": "s5", "type": "table", "content": "",
                 "metadata": {"rows": [
                     ["A & B", "C > D"],
                     ["x < y", "<em>test</em>"],
                 ]}},
            ],
        }],
    }
    for tmpl in ("dark-cinematic", "clean-minimal"):
        pdf = generate_pdf(special_project, tmpl)
        check(f"{tmpl} handles special chars", pdf[:4] == b"%PDF")
except Exception as exc:
    check("no exception", False, str(exc))

# â”€â”€ Test 5: Multi-line paragraph (\\n in content) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

print("\n-- multi-line paragraph content --")
try:
    multiline_project = {
        "title": "Multi-line Test",
        "chapters": [{
            "id": "c1",
            "title": "Multi-line Paragraphs",
            "blocks": [
                {"id": "m1", "type": "paragraph",
                 "content": "Line one.\nLine two.\nLine three."},
                {"id": "m2", "type": "pro_tip",
                 "content": "Tip line one.\nTip line two."},
                {"id": "m3", "type": "prompt_card",
                 "content": "Prompt line 1.\nPrompt line 2."},
            ],
        }],
    }
    for tmpl in ("dark-cinematic", "clean-minimal"):
        pdf = generate_pdf(multiline_project, tmpl)
        check(f"{tmpl} handles multi-line content", pdf[:4] == b"%PDF")
except Exception as exc:
    check("no exception", False, str(exc))

# â”€â”€ Test 6: Long title (word-wrap on cover) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

print("\n-- long title word-wrap on cover --")
try:
    long_title_project = {
        "title": ("The Ultimate Complete Comprehensive Guide to Writing "
                  "Fiction That Actually Sells in Today's Market"),
        "subtitle": "Everything you need to know and more",
        "chapters": [{"id": "c1", "title": "Intro", "blocks": []}],
    }
    for tmpl in ("dark-cinematic", "clean-minimal"):
        pdf = generate_pdf(long_title_project, tmpl)
        check(f"{tmpl} word-wraps long title", pdf[:4] == b"%PDF")
except Exception as exc:
    check("no exception", False, str(exc))

# â”€â”€ Test 7: Empty chapters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

print("\n-- empty chapters --")
try:
    empty_project = {
        "title": "Empty Chapters",
        "chapters": [
            {"id": "c1", "title": "Empty One", "blocks": []},
            {"id": "c2", "title": "Empty Two", "blocks": []},
        ],
    }
    for tmpl in ("dark-cinematic", "clean-minimal"):
        pdf = generate_pdf(empty_project, tmpl)
        check(f"{tmpl} handles empty chapters", pdf[:4] == b"%PDF")
except Exception as exc:
    check("no exception", False, str(exc))

# â”€â”€ Test 8: No chapters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

print("\n-- no chapters --")
try:
    no_chapters = {"title": "No Chapters", "chapters": []}
    for tmpl in ("dark-cinematic", "clean-minimal"):
        pdf = generate_pdf(no_chapters, tmpl)
        check(f"{tmpl} handles zero chapters", pdf[:4] == b"%PDF")
except Exception as exc:
    check("no exception", False, str(exc))

# â”€â”€ Test 9: Flask API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

print("\n-- Flask API --")
from app import app as flask_app

client = flask_app.test_client()

# /health
r = client.get("/health")
data = r.get_json()
check("GET /health â†’ 200", r.status_code == 200)
check("/health returns status:ok", data.get("status") == "ok")
check("/health lists templates", "dark-cinematic" in data.get("templates", []))

# Unknown template â†’ 400
r = client.post(
    "/generate",
    data=json.dumps({"project": FULL_PROJECT, "template": "nonexistent"}),
    content_type="application/json",
)
check("Unknown template â†’ 400", r.status_code == 400)
check("400 body has 'error' key", "error" in (r.get_json() or {}))

# Missing project â†’ 400
r = client.post(
    "/generate",
    data=json.dumps({"template": "dark-cinematic"}),
    content_type="application/json",
)
check("Missing project â†’ 400", r.status_code == 400)

# Non-JSON body â†’ 400
r = client.post("/generate", data="not json", content_type="text/plain")
check("Non-JSON body â†’ 400", r.status_code == 400)

# dark-cinematic via API
r = client.post(
    "/generate",
    data=json.dumps({"project": FULL_PROJECT, "template": "dark-cinematic"}),
    content_type="application/json",
)
check("POST /generate dark-cinematic â†’ 200", r.status_code == 200)
check("Response content-type is PDF", "application/pdf" in r.content_type)
check("PDF body starts with %PDF", r.data[:4] == b"%PDF")

# clean-minimal via API (using project.theme instead of explicit template key)
cm_via_theme = {**FULL_PROJECT, "theme": "clean-minimal"}
r = client.post(
    "/generate",
    data=json.dumps({"project": cm_via_theme}),
    content_type="application/json",
)
check("POST /generate via project.theme clean-minimal â†’ 200", r.status_code == 200)
check("clean-minimal response is PDF", r.data[:4] == b"%PDF")

# Underscore variant normalised: "dark_cinematic" â†’ "dark-cinematic"
r = client.post(
    "/generate",
    data=json.dumps({"project": FULL_PROJECT, "template": "dark_cinematic"}),
    content_type="application/json",
)
check("dark_cinematic (underscores) accepted â†’ 200", r.status_code == 200)

# Professional composer endpoint
professional_ebook = {
    "title": "Professional Export Test",
    "subtitle": "Structured composer route",
    "brand": "Ebook Studio",
    "theme": "black_gold",
    "chapters": [{
        "title": "Composer Chapter",
        "intro": "A short structured chapter.",
        "sections": [{
            "title": "Composer Section",
            "blocks": [
                {"type": "paragraph", "text": "Professional composer paragraph."},
                {"type": "tip_box", "text": "Professional composer tip."},
                {"type": "cta_box", "text": "Export with the professional composer."},
            ],
        }],
    }],
}
r = client.post(
    "/generate-professional",
    data=json.dumps({"ebook": professional_ebook}),
    content_type="application/json",
)
check("POST /generate-professional â†’ 200", r.status_code == 200)
check("professional response content-type is PDF", "application/pdf" in r.content_type)
check("professional PDF body starts with %PDF", r.data[:4] == b"%PDF")
check("professional diagnostics header present", bool(r.headers.get("X-Composer-Diagnostics")))

# â”€â”€ Summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

total  = len(results)
passed = sum(1 for s, *_ in results if s == PASS)
failed = total - passed

print(f"\n{'='*50}")
print(f"Results: {passed}/{total} passed", end="")
if failed:
    print(f"  ({failed} FAILED)")
    for status, name, detail in results:
        if status == FAIL:
            print(f"  FAIL: {name}" + (f" â€” {detail}" if detail else ""))
else:
    print("  â€” all green")
print(f"{'='*50}")

sys.exit(0 if failed == 0 else 1)

