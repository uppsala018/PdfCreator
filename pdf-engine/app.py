"""Flask API for the Ebook Studio PDF engine."""

import io
from flask import Flask, request, jsonify, send_file
from pdf_generator import generate_pdf

app = Flask(__name__)

VALID_TEMPLATES = {"dark-cinematic", "clean-minimal"}


@app.route("/health")
def health():
    return jsonify({"status": "ok", "templates": sorted(VALID_TEMPLATES)})


@app.route("/generate", methods=["POST"])
def generate():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    project = data.get("project")
    if not project or not isinstance(project, dict):
        return jsonify({"error": "Missing or invalid 'project' field"}), 400

    # Template resolution order:
    #   1. Explicit 'template' key in the request body
    #   2. project.theme
    #   3. default to "dark-cinematic"
    raw_template: str = (
        data.get("template")
        or project.get("theme")
        or "dark-cinematic"
    )

    # Normalise (accept "dark_cinematic" as well as "dark-cinematic")
    template = raw_template.replace("_", "-").lower()

    if template not in VALID_TEMPLATES:
        return jsonify({
            "error": (
                f"Unknown template '{raw_template}'. "
                f"Valid values: {sorted(VALID_TEMPLATES)}"
            )
        }), 400

    try:
        pdf_bytes = generate_pdf(project, template)
    except Exception as exc:  # noqa: BLE001
        app.logger.exception("PDF generation failed")
        return jsonify({"error": str(exc)}), 500

    safe_title = (project.get("title") or "ebook").replace(" ", "_")
    filename = f"{safe_title}.pdf"

    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=filename,
    )


if __name__ == "__main__":
    app.run(debug=True, port=8000)
