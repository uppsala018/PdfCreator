import { describe, expect, it } from "vitest"
import { projectToProfessionalSchema } from "./project-to-schema"
import type { ProjectRow } from "@/lib/project-schema"

describe("projectToProfessionalSchema", () => {
  it("maps editor blocks into structured composer blocks", () => {
    const project: ProjectRow = {
      id: "p1",
      user_id: "u1",
      title: "Launch Guide",
      subtitle: "A practical system",
      author: "Ebook Studio",
      website: "ebook.studio",
      theme: "dark-cinematic",
      template: "dark-cinematic",
      created_at: "",
      updated_at: "",
      content: {
        chapters: [
          {
            id: "c1",
            title: "Chapter One",
            blocks: [
              { id: "b1", type: "paragraph", content: "Intro paragraph." },
              { id: "b2", type: "heading", content: "Main Section" },
              { id: "b3", type: "subheading", content: "Subsection" },
              { id: "b4", type: "pro_tip", content: "Use a launch checklist." },
              { id: "b5", type: "prompt_card", content: "Write launch copy." },
              {
                id: "b6",
                type: "table",
                content: "",
                metadata: { rows: [["Name", "Role"], ["Offer", "Promise"]] },
              },
            ],
          },
        ],
      },
    }

    const schema = projectToProfessionalSchema(project, "luxury-black-gold")
    expect(schema.theme).toBe("black_gold")
    expect(schema.chapters[0].intro).toBe("Intro paragraph.")
    expect(schema.chapters[0].sections[0].title).toBe("Main Section")
    expect(schema.chapters[0].sections[0].blocks.map((block) => block.type)).toEqual([
      "subheading",
      "tip_box",
      "prompt_block",
      "comparison_table",
    ])
  })
})
